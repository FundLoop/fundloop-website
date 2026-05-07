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

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0
}

function toStringArray(value) {
  return asArray(value).filter((item) => typeof item === "string")
}

function safeNumber(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function warning(scope, error) {
  if (error?.message) {
    console.warn(JSON.stringify({ event: "mcp_workflow_read_warning", scope, message: error.message }))
  }
  return {
    scope,
    message: "Workspace data could not be loaded.",
  }
}

async function softRead(scope, query, warnings, fallback) {
  try {
    const { data, error, count } = await query
    if (error) {
      warnings.push(warning(scope, error))
      return fallback
    }

    if (typeof count === "number") return count
    return data ?? fallback
  } catch (error) {
    warnings.push(warning(scope, error instanceof Error ? error : null))
    return fallback
  }
}

function computeProfileCompletion(profile, snapshot, interestCount) {
  let percent = 0
  const missingItems = []
  const localChecks = [
    ["display_name", hasText(profile?.display_name)],
    ["profile_headline", hasText(profile?.profile_headline)],
    ["bio", hasText(profile?.bio)],
    ["occupation", profile?.occupation_id !== null && profile?.occupation_id !== undefined],
    ["location", profile?.location_id !== null && profile?.location_id !== undefined],
    ["interests", interestCount > 0],
  ]

  for (const [key, complete] of localChecks) {
    if (complete) percent += 10
    else missingItems.push(key)
  }

  const status = profile?.cubid_identity_status ?? "unlinked"
  if (status === "linked" || status === "verified") percent += 20
  else missingItems.push("cubid_link")

  const verifiedStampTypes = new Set(toStringArray(snapshot?.verified_stamp_types).map((stamp) => stamp.toLowerCase()))
  if (hasText(snapshot?.primary_phone) || verifiedStampTypes.has("phone")) percent += 10
  else missingItems.push("cubid_phone")

  const providerStamps = ["google", "github", "linkedin", "twitter", "discord"]
  if (providerStamps.some((stamp) => verifiedStampTypes.has(stamp))) percent += 10
  else missingItems.push("cubid_provider")

  return { percent, missingItems }
}

function summarizePayoutRoutes(routes) {
  const rows = asArray(routes)
  const activeRows = rows.filter((route) => route.status === "active")
  const rails = Array.from(new Set(rows.map((route) => route.rail).filter((rail) => typeof rail === "string"))).sort()
  const hasDefaultRoute = rows.some((route) => route.is_default === true && route.status === "active")
  let nextAction = "Add a payout route before monthly payouts are ready."
  if (hasDefaultRoute) nextAction = "Default payout route is configured."
  else if (activeRows.length > 0) nextAction = "Choose a default payout route."

  return {
    routeCount: rows.length,
    activeRouteCount: activeRows.length,
    hasDefaultRoute,
    rails,
    nextAction,
  }
}

function summarizeWorkspaceNextActions({ profileCompletion, participantRows, latestResult, payoutReadiness }) {
  const actions = []
  if (profileCompletion.percent < 100) actions.push("Complete profile and identity readiness in the workspace account area.")
  if (participantRows.length === 0) actions.push("Explore active public projects and join one to build participation signal.")
  if (!latestResult) actions.push("Check back after published monthly results are available.")
  if (!payoutReadiness.hasDefaultRoute) actions.push(payoutReadiness.nextAction)
  if (actions.length === 0) actions.push("Review current results and keep participation current.")
  return actions
}

async function userWorkspaceSummary(adminClient, user) {
  const warnings = []
  const [
    profile,
    snapshot,
    interestCount,
    participantRows,
    publishedResults,
    payoutRoutes,
    recommendedProjects,
  ] = await Promise.all([
    softRead(
      "profile",
      adminClient
        .from("users")
        .select("email, display_name, profile_headline, bio, occupation_id, location_id, cubid_identity_status, cubid_score")
        .eq("user_id", user.id)
        .maybeSingle(),
      warnings,
      null,
    ),
    softRead(
      "cubid-snapshot",
      adminClient
        .from("cubid_identity_snapshots")
        .select("primary_email, primary_phone, cubid_score, verified_stamp_types, last_synced_at, last_sync_error_code")
        .eq("user_id", user.id)
        .maybeSingle(),
      warnings,
      null,
    ),
    softRead(
      "interests",
      adminClient.from("user_interests").select("user_id", { count: "exact", head: true }).eq("user_id", user.id),
      warnings,
      0,
    ),
    softRead(
      "participation",
      adminClient
        .from("participants")
        .select("is_admin, is_favorite, joined_at, projects(slug,name)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(12),
      warnings,
      [],
    ),
    softRead(
      "results",
      adminClient
        .from("zkas_published_user_results")
        .select("allocation_usd, aggregate_score, published_at, run_id, zkas_runs(month)")
        .eq("user_id", user.id)
        .order("published_at", { ascending: false }),
      warnings,
      [],
    ),
    softRead(
      "payout-routes",
      adminClient.from("user_payout_routes").select("rail, status, is_default").eq("user_id", user.id),
      warnings,
      [],
    ),
    softRead(
      "discovery",
      adminClient
        .from("projects")
        .select("slug, name")
        .eq("status", "active")
        .eq("is_public", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(3),
      warnings,
      [],
    ),
  ])

  const profileCompletion = computeProfileCompletion(profile, snapshot, interestCount)
  const participants = asArray(participantRows)
  const results = asArray(publishedResults)
  const latestResult = results[0] ?? null
  const payoutReadiness = summarizePayoutRoutes(payoutRoutes)
  const recentProjects = participants.slice(0, 3).map((participant) => {
    const project = readProject(participant.projects)
    return {
      slug: typeof project?.slug === "string" ? project.slug : null,
      name: project?.name ?? project?.slug ?? "Project",
      joinedAt: participant.joined_at ?? null,
      isFavorite: participant.is_favorite === true,
      isFounderRole: participant.is_admin === true,
    }
  })
  const verifiedStampTypes = toStringArray(snapshot?.verified_stamp_types)

  return {
    ok: true,
    data: {
      profileStatus: {
        signedInEmail: profile?.email ?? user.email ?? null,
        cubidIdentityStatus: profile?.cubid_identity_status ?? "unlinked",
        cubidScore: snapshot?.cubid_score ?? profile?.cubid_score ?? null,
        completionPercent: profileCompletion.percent,
        missingItems: profileCompletion.missingItems,
        identitySnapshot: snapshot
          ? {
              primaryEmailPresent: hasText(snapshot.primary_email),
              primaryPhonePresent: hasText(snapshot.primary_phone),
              verifiedStampTypes,
              lastSyncedAt: snapshot.last_synced_at ?? null,
              lastSyncErrorCode: snapshot.last_sync_error_code ?? null,
            }
          : null,
      },
      participation: {
        joinedProjectCount: participants.length,
        founderProjectCount: participants.filter((participant) => participant.is_admin === true).length,
        favoriteProjectCount: participants.filter((participant) => participant.is_favorite === true).length,
        recentProjects,
      },
      results: {
        latest: latestResult
          ? {
              allocationUsd: safeNumber(latestResult.allocation_usd),
              aggregateScore: safeNumber(latestResult.aggregate_score),
              monthLabel: readProject(latestResult.zkas_runs)?.month ?? `Run ${latestResult.run_id}`,
              publishedAt: latestResult.published_at,
            }
          : null,
        totalAllocationUsd: Number(results.reduce((sum, result) => sum + safeNumber(result.allocation_usd), 0).toFixed(2)),
        resultCount: results.length,
        detailHref: "/workspace/earnings",
      },
      payoutReadiness,
      discovery: {
        recommendedProjects: asArray(recommendedProjects).map((project) => ({
          slug: typeof project.slug === "string" ? project.slug : null,
          name: project.name ?? project.slug ?? "Project",
        })),
        nextActions: summarizeWorkspaceNextActions({ profileCompletion, participantRows: participants, latestResult, payoutReadiness }),
      },
      warnings,
    },
  }
}

async function userPayoutRoutesList(adminClient, user) {
  const warnings = []
  const payoutRoutes = await softRead(
    "payout-routes",
    adminClient
      .from("user_payout_routes")
      .select("label, rail, currency_code, status, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    warnings,
    [],
  )
  const rows = asArray(payoutRoutes)

  return {
    ok: true,
    data: {
      summary: summarizePayoutRoutes(rows),
      routes: rows.map((route) => ({
        label: hasText(route.label) ? route.label.trim() : route.rail,
        rail: route.rail,
        currencyCode: route.currency_code,
        status: route.status,
        isDefault: route.is_default === true,
      })),
      warnings,
    },
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
  if (input.operation === "user.workspace.summary") result = await userWorkspaceSummary(adminClient, auth.user)
  if (input.operation === "user.payout.routes.list") result = await userPayoutRoutesList(adminClient, auth.user)
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
