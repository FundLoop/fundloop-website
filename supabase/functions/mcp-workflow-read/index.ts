import { validateMcpWorkflowReadInput } from "../../../lib/edge-functions/mcp-workflow-read-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, corsHeaders, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function readProject(value) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function normalizeProject(project) {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name ?? project.slug ?? `Project ${project.id}`,
  }
}

async function requireManagedProject(adminClient, userId, projectSlug) {
  const { data: project, error: projectError } = await adminClient
    .from("projects")
    .select("id, slug, name, organization_id")
    .eq("slug", projectSlug)
    .maybeSingle()
  if (projectError) return { ok: false, code: "query_failed", message: projectError.message }
  if (!project) return { ok: false, code: "project_not_found", message: "Project not found." }

  const { data: participant, error: participantError } = await adminClient
    .from("participants")
    .select("id")
    .eq("project_id", project.id)
    .eq("user_id", userId)
    .eq("is_admin", true)
    .maybeSingle()
  if (participantError) return { ok: false, code: "query_failed", message: participantError.message }
  if (participant?.id) return { ok: true, project }

  const { data: roleRows, error: roleError } = await adminClient.from("ref_roles").select("id").in("name", ["Founder", "Admin"])
  if (roleError) return { ok: false, code: "query_failed", message: roleError.message }
  const roleIds = asArray(roleRows).map((role) => role.id)
  if (project.organization_id && roleIds.length > 0) {
    const { data: membership, error: membershipError } = await adminClient
      .from("organization_members")
      .select("id")
      .eq("organization_id", project.organization_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role_id", roleIds)
      .maybeSingle()
    if (membershipError) return { ok: false, code: "query_failed", message: membershipError.message }
    if (membership?.id) return { ok: true, project }
  }

  return { ok: false, code: "forbidden", message: "You do not manage this project." }
}

async function requireProjectMember(adminClient, userId, projectSlug) {
  const { data: project, error: projectError } = await adminClient
    .from("projects")
    .select("id, slug, name")
    .eq("slug", projectSlug)
    .maybeSingle()
  if (projectError) return { ok: false, code: "query_failed", message: projectError.message }
  if (!project) return { ok: false, code: "project_not_found", message: "Project not found." }

  const { data: participant, error: participantError } = await adminClient
    .from("participants")
    .select("id")
    .eq("project_id", project.id)
    .eq("user_id", userId)
    .maybeSingle()
  if (participantError) return { ok: false, code: "query_failed", message: participantError.message }
  if (!participant?.id) return { ok: false, code: "forbidden", message: "You are not a member of this project." }

  return { ok: true, project }
}

async function listManagedProjects(adminClient, userId) {
  const [{ data: participantRows, error: participantError }, { data: roleRows, error: roleError }] = await Promise.all([
    adminClient.from("participants").select("projects(id,slug,name)").eq("user_id", userId).eq("is_admin", true),
    adminClient.from("ref_roles").select("id").in("name", ["Founder", "Admin"]),
  ])
  if (participantError) return { ok: false, code: "query_failed", message: participantError.message }
  if (roleError) return { ok: false, code: "query_failed", message: roleError.message }

  const roleIds = asArray(roleRows).map((role) => role.id)
  const organizationProjects =
    roleIds.length > 0
      ? await (async () => {
          const { data: memberships, error: membershipError } = await adminClient
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", userId)
            .eq("status", "active")
            .in("role_id", roleIds)
          if (membershipError) return { ok: false, code: "query_failed", message: membershipError.message }

          const organizationIds = Array.from(new Set(asArray(memberships).map((membership) => membership.organization_id).filter(Boolean)))
          if (organizationIds.length === 0) return { ok: true, data: [] }

          const { data: projects, error: projectsError } = await adminClient
            .from("projects")
            .select("id, slug, name")
            .in("organization_id", organizationIds)
          if (projectsError) return { ok: false, code: "query_failed", message: projectsError.message }
          return { ok: true, data: asArray(projects) }
        })()
      : { ok: true, data: [] }

  if (!organizationProjects.ok) return organizationProjects

  const projectsById = new Map()
  for (const project of [
    ...asArray(participantRows).map((row) => readProject(row.projects)).filter((project) => Boolean(project?.id)),
    ...organizationProjects.data,
  ]) {
    projectsById.set(project.id, normalizeProject(project))
  }

  return { ok: true, data: [...projectsById.values()].sort((left, right) => left.name.localeCompare(right.name)) }
}

async function readLatestOrSelectedCycle(adminClient, cycleKey) {
  const query = adminClient.from("monthly_cycles").select("id, cycle_key, status")
  const { data, error } = cycleKey
    ? await query.eq("cycle_key", cycleKey).limit(1)
    : await query.order("period_start", { ascending: false }).limit(1)
  if (error) return { ok: false, code: "query_failed", message: error.message }
  if (cycleKey && !data?.[0]) return { ok: false, code: "cycle_not_found", message: "Monthly cycle not found." }
  return { ok: true, cycle: data?.[0] ?? null }
}

async function founderCycleStatus(adminClient, userId, input) {
  const access = await requireManagedProject(adminClient, userId, input.projectSlug)
  if (!access.ok) return access
  const cycleResult = await readLatestOrSelectedCycle(adminClient, input.cycleKey)
  if (!cycleResult.ok) return cycleResult
  const cycle = cycleResult.cycle
  const cycleFilter = cycle ? (query) => query.eq("monthly_cycle_id", cycle.id) : (query) => query

  const [paymentsResult, routesResult] = await Promise.all([
    cycleFilter(
      adminClient
        .from("payments")
        .select("payment_amount, ref_payment_statuses(code)")
        .eq("project_id", access.project.id),
    ),
    adminClient.from("project_crypto_payment_methods").select("is_enabled, is_default").eq("project_id", access.project.id),
  ])
  if (paymentsResult.error) return { ok: false, code: "query_failed", message: paymentsResult.error.message }
  if (routesResult.error) return { ok: false, code: "query_failed", message: routesResult.error.message }

  const payments = paymentsResult.data ?? []
  const routes = routesResult.data ?? []
  return {
    ok: true,
    data: {
      project: normalizeProject(access.project),
      cycle: { cycleKey: cycle?.cycle_key ?? null, status: cycle?.status ?? null },
      payments: {
        count: payments.length,
        confirmedCount: payments.filter((payment) => payment.ref_payment_statuses?.code === "confirmed").length,
        awaitingConfirmationCount: payments.filter((payment) => payment.ref_payment_statuses?.code === "awaiting_confirmation").length,
        totalContributionAmount: payments.reduce((sum, payment) => sum + Number(payment.payment_amount ?? 0), 0),
      },
      routes: {
        enabledCount: routes.filter((route) => route.is_enabled).length,
        defaultCount: routes.filter((route) => route.is_default).length,
      },
    },
  }
}

async function projectMemberReportingStatus(adminClient, userId, input) {
  const access = await requireProjectMember(adminClient, userId, input.projectSlug)
  if (!access.ok) return access
  const cycleResult = await readLatestOrSelectedCycle(adminClient, input.cycleKey)
  if (!cycleResult.ok) return cycleResult
  const cycle = cycleResult.cycle
  const cycleFilter = cycle ? (query) => query.eq("monthly_cycle_id", cycle.id) : (query) => query

  const [reportsResult, datasetsResult] = await Promise.all([
    cycleFilter(
      adminClient
        .from("monthly_cycle_reports")
        .select("audience, artifact_path")
        .eq("subject_project_id", access.project.id),
    ),
    cycleFilter(adminClient.from("zkas_datasets").select("status").eq("project_id", access.project.id)),
  ])
  if (reportsResult.error) return { ok: false, code: "query_failed", message: reportsResult.error.message }
  if (datasetsResult.error) return { ok: false, code: "query_failed", message: datasetsResult.error.message }
  const reports = reportsResult.data ?? []
  const datasets = datasetsResult.data ?? []
  return {
    ok: true,
    data: {
      projectSlug: access.project.slug,
      cycleKey: cycle?.cycle_key ?? null,
      reports: {
        founderReportCount: reports.filter((report) => report.audience === "founder").length,
        artifactCount: reports.filter((report) => report.artifact_path).length,
      },
      attribution: {
        approvedDatasetCount: datasets.filter((dataset) => ["approved", "included"].includes(dataset.status)).length,
        pendingDatasetCount: datasets.filter((dataset) => !["approved", "included"].includes(dataset.status)).length,
      },
    },
  }
}

function requireOperator(user) {
  return user?.email && isInternalAdminEmail(user.email, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))
}

async function operatorCycles(adminClient) {
  const { data, error } = await adminClient
    .from("monthly_cycles")
    .select("cycle_key, status, locked_at, calculation_started_at, distribution_started_at, reporting_published_at")
    .order("period_start", { ascending: false })
    .limit(12)
  if (error) return { ok: false, code: "query_failed", message: error.message }
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      cycleKey: row.cycle_key,
      status: row.status,
      lockedAt: row.locked_at,
      calculationStartedAt: row.calculation_started_at,
      distributionStartedAt: row.distribution_started_at,
      reportingPublishedAt: row.reporting_published_at,
    })),
  }
}

async function operatorEvents(adminClient, input) {
  let query = adminClient
    .from("monthly_cycle_events")
    .select("cycle_key, event_type, outcome, severity, attempt_id, message, created_at")
    .order("created_at", { ascending: false })
    .limit(input.attemptId ? 500 : 50)
  if (input.cycleKey) query = query.eq("cycle_key", input.cycleKey)
  if (input.attemptId) query = query.eq("attempt_id", input.attemptId)
  const { data, error } = await query
  if (error) return { ok: false, code: "query_failed", message: error.message }
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      cycleKey: row.cycle_key,
      eventType: row.event_type,
      outcome: row.outcome,
      severity: row.severity,
      attemptId: row.attempt_id,
      message: row.message,
      createdAt: row.created_at,
    })),
  }
}

async function reconciliationVisibility(adminClient) {
  const statuses = ["submitted", "confirming", "awaiting_confirmation", "confirmed", "failed"]
  const results = await Promise.all(
    statuses.map((status) => adminClient.from("onchain_payment_submissions").select("id", { count: "exact", head: true }).eq("status", status)),
  )

  const failed = results.find((result) => result.error)
  if (failed?.error) return { ok: false, code: "query_failed", message: failed.error.message }

  const counts = Object.fromEntries(statuses.map((status, index) => [status, results[index].count ?? 0]))
  return {
    ok: true,
    data: {
      submitted: counts.submitted,
      confirming: counts.confirming,
      awaitingConfirmation: counts.awaiting_confirmation,
      confirmed: counts.confirmed,
      failed: counts.failed,
    },
  }
}

async function reportingCoverage(adminClient, input) {
  const cycleResult = input.cycleKey ? await readLatestOrSelectedCycle(adminClient, input.cycleKey) : { ok: true, cycle: null }
  if (!cycleResult.ok) return cycleResult
  let query = adminClient.from("monthly_cycle_reports").select("audience, artifact_path")
  if (cycleResult.cycle) query = query.eq("monthly_cycle_id", cycleResult.cycle.id)
  const { data, error } = await query
  if (error) return { ok: false, code: "query_failed", message: error.message }
  const reports = data ?? []
  return {
    ok: true,
    data: {
      cycleKey: cycleResult.cycle?.cycle_key ?? input.cycleKey ?? null,
      publicReports: reports.filter((report) => report.audience === "public").length,
      userReports: reports.filter((report) => report.audience === "user").length,
      founderReports: reports.filter((report) => report.audience === "founder").length,
      operatorReports: reports.filter((report) => report.audience === "operator").length,
      artifactCount: reports.filter((report) => report.artifact_path).length,
    },
  }
}

async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))

  const bodyResult = await parseJsonBody(request)
  if (!bodyResult.ok) return json(edgeCommandFailure("invalid_payload", bodyResult.error))

  const auth = await authenticateRequest(request)
  if (!auth.ok) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))

  const validation = validateMcpWorkflowReadInput(bodyResult.body)
  if (!validation.ok) return json(validation)
  const input = validation.data

  const adminClient = auth.adminClient
  let result
  if (input.operation === "founder.projects.list") result = await listManagedProjects(adminClient, auth.user.id)
  if (input.operation === "founder.project.cycle_status") result = await founderCycleStatus(adminClient, auth.user.id, input)
  if (input.operation === "project_member.project.reporting_status") result = await projectMemberReportingStatus(adminClient, auth.user.id, input)

  if (input.operation.startsWith("operator.")) {
    if (!requireOperator(auth.user)) return json(edgeCommandFailure("forbidden", "You do not have internal operator access."))
    if (input.operation === "operator.cycles.list") result = await operatorCycles(adminClient)
    if (input.operation === "operator.cycle.observability") result = await operatorEvents(adminClient, input)
    if (input.operation === "operator.payments.reconciliation_visibility") result = await reconciliationVisibility(adminClient)
    if (input.operation === "operator.reporting.coverage") result = await reportingCoverage(adminClient, input)
  }

  if (!result) return json(edgeCommandFailure("invalid_payload", "operation is not supported."))
  if (!result.ok) return json(edgeCommandFailure(result.code, result.message))
  return json(edgeCommandSuccess(result.data))
}

serve(handleRequest)

export { handleRequest }
