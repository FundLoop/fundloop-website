"use server"

import { revalidatePath } from "next/cache"
import { parseMonthlyCycleKey } from "@/lib/monthly-cycles"
import {
  buildZkasDatasetArtifactPath,
  buildZkasIdentityArtifactPath,
  buildZkasRunArtifactPath,
} from "@/lib/storage/artifacts"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  getAuthenticatedActor,
  getCachedZkasRoleId,
  getProjectAdmins,
  getProjectMembershipForActor,
  isInternalAdminEmail,
  isZkasSuperadminEmail,
  requireInternalZkasOperator,
  requireProjectAdmin,
  requireProjectZkasManager,
  requireZkasSuperadmin,
} from "@/lib/zkas/auth"
import {
  ZKAS_DATASET_BUCKET,
  ZKAS_IDENTITY_BUCKET,
  ZKAS_PUBLISHED_RESULT_NOTIFICATION_CODE,
  ZKAS_RUN_BUCKET,
  ZKAS_SCHEMA_VERSION,
} from "@/lib/zkas/constants"
import { hashManifest, serializeManifest } from "@/lib/zkas/manifest"
import { getMonthBounds } from "@/lib/zkas/month"
import { buildPublicationMaterialization } from "@/lib/zkas/publication"
import { runLocalZkasExecution } from "@/lib/zkas/runner"
import { downloadTextArtifact, hashTextContent, uploadBinaryArtifact, uploadTextArtifact } from "@/lib/zkas/storage"
import { parseIdentityArtifact, validateDatasetContent } from "@/lib/zkas/validation"
import type {
  LocalExecutionManifest,
  ZkasProjectCubidBucket,
  ZkasProjectAnalyticsSummary,
  ZkasPublishedResultNotificationPayload,
  ZkasRunManifest,
  ZkasValidationIssue,
} from "@/types/zkas"

async function replaceDatasetIssues(datasetId: number, issues: ZkasValidationIssue[]) {
  const supabase = getAdminSupabaseClient()
  await supabase.from("zkas_dataset_issues").delete().eq("dataset_id", datasetId)

  if (issues.length === 0) {
    return
  }

  const { error } = await supabase.from("zkas_dataset_issues").insert(
    issues.map((issue) => ({
      dataset_id: datasetId,
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      row_number: issue.rowNumber ?? null,
      field_name: issue.field ?? null,
      metadata: issue.metadata ?? null,
    })),
  )

  if (error) {
    throw new Error(error.message)
  }
}

async function getNotificationTypeId(code: string) {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase.from("ref_notification_types").select("id").eq("code", code).single()

  if (error || !data) {
    throw new Error(error?.message ?? `Notification type ${code} is not configured`)
  }

  return data.id
}

async function getRunProjectSlugs(projectIds: number[]) {
  if (projectIds.length === 0) {
    return []
  }

  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase.from("projects").select("slug").in("id", projectIds)
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((project) => project.slug).filter((slug): slug is string => Boolean(slug))
}

function revalidateZkasPaths(runId: number, projectSlugs: string[] = []) {
  revalidatePath("/admin/zkas")
  revalidatePath("/admin/zkas/runs")
  revalidatePath(`/admin/zkas/runs/${runId}`)
  revalidatePath("/admin/superadmin/zkas")
  revalidatePath(`/admin/superadmin/zkas/runs/${runId}`)
  revalidatePath("/workspace")
  revalidatePath("/workspace/reporting")

  for (const slug of projectSlugs) {
    revalidatePath(`/projects/${slug}/zkas`)
  }
}

function revalidateMonthlyCycleZkasPaths(month: string) {
  revalidatePath("/admin/cycles")
  revalidatePath(`/admin/cycles/${month}/prep`)
  revalidatePath(`/admin/cycles/${month}/zkas`)
}

async function getOrCreateMonthlyCycleIdForMonth(month: string, actorUserId: string | null = null) {
  const supabase = getAdminSupabaseClient()
  const parsed = parseMonthlyCycleKey(month)
  const { data, error } = await supabase
    .from("monthly_cycles")
    .upsert({
      cycle_key: parsed.cycleKey,
      year: parsed.year,
      month: parsed.month,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId,
    }, {
      onConflict: "cycle_key",
      ignoreDuplicates: true,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (data) {
    return data.id
  }

  const { data: existing, error: existingError } = await supabase
    .from("monthly_cycles")
    .select("id")
    .eq("cycle_key", parsed.cycleKey)
    .maybeSingle()

  if (existingError || !existing) {
    throw new Error(existingError?.message ?? `Could not resolve monthly cycle ${month}`)
  }

  return existing.id
}

async function getConfirmedPaymentsForMonth(month: string) {
  const supabase = getAdminSupabaseClient()
  const { startIso, endIso } = getMonthBounds(month)
  const { data: confirmedStatus, error: statusError } = await supabase
    .from("ref_payment_statuses")
    .select("id")
    .eq("code", "confirmed")
    .single()

  if (statusError || !confirmedStatus) {
    throw new Error(statusError?.message ?? "Confirmed payment status is not configured")
  }

  const { data, error } = await supabase
    .from("payments")
    .select("id, project_id, payment_amount, period_end")
    .eq("status_id", confirmedStatus.id)
    .gte("period_end", startIso.slice(0, 10))
    .lt("period_end", endIso.slice(0, 10))
    .order("period_end", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const payments = data ?? []
  for (const payment of payments) {
    if (!Number.isInteger(payment.project_id)) {
      throw new Error(`Payment ${payment.id} is missing a project_id snapshot`)
    }
  }

  return payments as Array<{
    id: number
    project_id: number
    payment_amount: number
    period_end: string
  }>
}

async function getApprovedIdentityArtifact(month: string) {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase
    .from("zkas_identity_artifacts")
    .select("*")
    .eq("month", month)
    .eq("status", "approved")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? `No approved identity artifact exists for ${month}`)
  }

  return data
}

async function getLockedRunContext(runId: number) {
  const supabase = getAdminSupabaseClient()
  const { data: run, error: runError } = await supabase.from("zkas_runs").select("*").eq("id", runId).single()
  if (runError || !run) {
    throw new Error(runError?.message ?? "Run not found")
  }

  const [{ data: datasets, error: datasetsError }, { data: payments, error: paymentsError }, { data: identityArtifact }] =
    await Promise.all([
      supabase.from("zkas_run_datasets").select("*").eq("run_id", runId).order("project_id"),
      supabase.from("zkas_run_payments").select("*").eq("run_id", runId).order("payment_id"),
      run.identity_artifact_id
        ? supabase.from("zkas_identity_artifacts").select("*").eq("id", run.identity_artifact_id).single()
        : Promise.resolve({ data: null, error: null }),
    ])

  if (datasetsError) {
    throw new Error(datasetsError.message)
  }

  if (paymentsError) {
    throw new Error(paymentsError.message)
  }

  if (!identityArtifact) {
    throw new Error("Run is missing its identity artifact")
  }

  return {
    run,
    datasets: datasets ?? [],
    payments: payments ?? [],
    identityArtifact,
  }
}

async function getRunPublicationContext(runId: number) {
  const supabase = getAdminSupabaseClient()
  const { run, datasets, payments, identityArtifact } = await getLockedRunContext(runId)
  const { data: resultRows, error: resultError } = await supabase
    .from("zkas_run_results")
    .select("zkas_user_id, eligibility, aggregate_score, allocation_usd, app_count, project_count, output_row_hash")
    .eq("run_id", runId)

  if (resultError) {
    throw new Error(resultError.message)
  }

  const datasetArtifacts = await Promise.all(
    datasets.map(async (dataset) => {
      const format = dataset.object_path.endsWith(".csv") ? "csv" : "json"
      const content = await downloadTextArtifact(ZKAS_DATASET_BUCKET, dataset.object_path)
      const parsed = validateDatasetContent({
        content,
        expectedMonth: run.month,
        expectedProjectId: dataset.project_id,
        format,
      })

      return {
        datasetId: dataset.dataset_id,
        projectId: dataset.project_id,
        rows: parsed.rows,
      }
    }),
  )

  const identityContent = await downloadTextArtifact(ZKAS_IDENTITY_BUCKET, identityArtifact.object_path)
  const mappings = parseIdentityArtifact(identityContent)
  const resolvedUserIds = Array.from(
    new Set(mappings.map((mapping) => mapping.fundloop_user_id).filter((value): value is string => Boolean(value))),
  )

  const { data: users, error: usersError } = resolvedUserIds.length
    ? await supabase.from("users").select("user_id, cubid_score").in("user_id", resolvedUserIds)
    : { data: [], error: null }

  if (usersError) {
    throw new Error(usersError.message)
  }

  return {
    run,
    datasets,
    payments,
    datasetArtifacts,
    resultRows: resultRows ?? [],
    mappings,
    cubidScoresByUserId: new Map((users ?? []).map((user) => [user.user_id, user.cubid_score])),
  }
}

export async function assignProjectZkasAccess(formData: FormData): Promise<void> {
  const projectSlug = String(formData.get("projectSlug") ?? "")
  const participantId = Number.parseInt(String(formData.get("participantId") ?? ""), 10)
  const { membership } = await requireProjectAdmin(projectSlug)

  if (!Number.isInteger(participantId)) {
    throw new Error("Participant is required")
  }

  const adminSet = await getProjectAdmins(projectSlug)
  const eligibleAdmin = adminSet.admins.find((admin) => admin.participantId === participantId)
  if (!eligibleAdmin) {
    throw new Error("Only project admins can receive zkAS access")
  }

  const supabase = getAdminSupabaseClient()
  const zkasRoleId = await getCachedZkasRoleId()
  const { error } = await supabase.from("participant_roles").upsert(
    {
      participant_id: participantId,
      role_id: zkasRoleId,
    },
    { onConflict: "participant_id,role_id" },
  )

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/projects/${projectSlug}/zkas`)
  revalidatePath(`/projects/${projectSlug}`)
  if (membership.projectSlug) {
    revalidatePath(`/projects/${membership.projectSlug}/zkas`)
  }
}

export async function revokeProjectZkasAccess(formData: FormData): Promise<void> {
  const projectSlug = String(formData.get("projectSlug") ?? "")
  const participantId = Number.parseInt(String(formData.get("participantId") ?? ""), 10)
  await requireProjectAdmin(projectSlug)

  if (!Number.isInteger(participantId)) {
    throw new Error("Participant is required")
  }

  const adminSet = await getProjectAdmins(projectSlug)
  const eligibleAdmin = adminSet.admins.find((admin) => admin.participantId === participantId)
  if (!eligibleAdmin) {
    throw new Error("Only project admins on this project can have zkAS access revoked")
  }

  const supabase = getAdminSupabaseClient()
  const zkasRoleId = await getCachedZkasRoleId()
  const { error } = await supabase
    .from("participant_roles")
    .delete()
    .eq("participant_id", participantId)
    .eq("role_id", zkasRoleId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/projects/${projectSlug}/zkas`)
}

export async function uploadZkasDataset(formData: FormData): Promise<void> {
  const projectSlug = String(formData.get("projectSlug") ?? "")
  const month = String(formData.get("month") ?? "")
  const format = String(formData.get("format") ?? "") as "csv" | "json"
  const note = String(formData.get("note") ?? "").trim() || null
  const file = formData.get("file")

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A dataset file is required")
  }

  const { actor, membership } = await requireProjectZkasManager(projectSlug)
  const supabase = getAdminSupabaseClient()
  const content = await file.text()
  const fileHash = hashTextContent(content)
  const objectPath = buildZkasDatasetArtifactPath({
    cycleKey: month,
    projectId: membership.projectId,
    fileHash,
    format,
  })
  const monthlyCycleId = await getOrCreateMonthlyCycleIdForMonth(month, actor.userId)

  const { data: dataset, error: insertError } = await supabase
    .from("zkas_datasets")
    .insert({
      project_id: membership.projectId,
      month,
      monthly_cycle_id: monthlyCycleId,
      format,
      file_name: file.name,
      object_path: objectPath,
      file_hash: fileHash,
      note,
      uploaded_by_user_id: actor.userId,
    })
    .select("*")
    .single()

  if (insertError || !dataset) {
    throw new Error(insertError?.message ?? "Could not create dataset record")
  }

  try {
    const parsed = validateDatasetContent({
      content,
      expectedMonth: month,
      expectedProjectId: membership.projectId,
      format,
    })

    await uploadBinaryArtifact(ZKAS_DATASET_BUCKET, objectPath, file, format === "csv" ? "text/csv" : "application/json")
    await replaceDatasetIssues(dataset.id, parsed.issues)

    const nextStatus = parsed.summary.issueCounts.errors === 0 ? "validated" : "failed"
    const { error: updateError } = await supabase
      .from("zkas_datasets")
      .update({
        row_count: parsed.summary.rowCount,
        validation_summary: parsed.summary,
        status: nextStatus,
      })
      .eq("id", dataset.id)

    if (updateError) {
      throw new Error(updateError.message)
    }
  } catch (error) {
    await replaceDatasetIssues(dataset.id, [
      {
        severity: "error",
        code: "parse_failed",
        message: error instanceof Error ? error.message : "The dataset could not be parsed",
        field: "file",
      },
    ])

    await supabase
      .from("zkas_datasets")
      .update({
        status: "failed",
        validation_summary: {
          rowCount: 0,
          detectedColumns: [],
          usedOptionalColumns: [],
          issueCounts: { errors: 1, warnings: 0 },
        },
      })
      .eq("id", dataset.id)

    throw error
  }

  revalidatePath(`/projects/${projectSlug}/zkas`)
  revalidateMonthlyCycleZkasPaths(month)
}

export async function uploadZkasIdentityArtifact(formData: FormData): Promise<void> {
  const actor = await requireInternalZkasOperator()
  const month = String(formData.get("month") ?? "")
  const provider = String(formData.get("provider") ?? "").trim() || "cubid"
  const note = String(formData.get("note") ?? "").trim() || null
  const file = formData.get("file")

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("An identity artifact file is required")
  }

  const content = await file.text()
  parseIdentityArtifact(content)

  const artifactHash = hashTextContent(content)
  const objectPath = buildZkasIdentityArtifactPath({
    cycleKey: month,
    artifactHash,
  })
  await uploadBinaryArtifact(ZKAS_IDENTITY_BUCKET, objectPath, file, "application/json")

  const supabase = getAdminSupabaseClient()
  const monthlyCycleId = await getOrCreateMonthlyCycleIdForMonth(month, actor.userId)
  const { data: existing } = await supabase
    .from("zkas_identity_artifacts")
    .select("id")
    .eq("month", month)
    .eq("status", "approved")
    .maybeSingle()

  if (existing) {
    await supabase.from("zkas_identity_artifacts").update({ status: "archived" }).eq("id", existing.id)
  }

  const { error } = await supabase
    .from("zkas_identity_artifacts")
    .insert({
      month,
      monthly_cycle_id: monthlyCycleId,
      file_name: file.name,
      object_path: objectPath,
      artifact_hash: artifactHash,
      provider,
      note,
      uploaded_by_user_id: actor.userId,
      status: "approved",
    })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/zkas/uploads")
  revalidateMonthlyCycleZkasPaths(month)
}

export async function approveZkasDataset(formData: FormData): Promise<void> {
  const actor = await requireInternalZkasOperator()
  const datasetId = Number.parseInt(String(formData.get("datasetId") ?? ""), 10)
  if (!Number.isInteger(datasetId)) {
    throw new Error("Dataset is required")
  }

  const supabase = getAdminSupabaseClient()
  const { data: dataset, error: datasetError } = await supabase.from("zkas_datasets").select("*").eq("id", datasetId).single()
  if (datasetError || !dataset) {
    throw new Error(datasetError?.message ?? "Dataset not found")
  }

  if (dataset.status !== "validated") {
    throw new Error("Only validated datasets can be approved")
  }

  const { data: activeApproved } = await supabase
    .from("zkas_datasets")
    .select("id, status")
    .eq("project_id", dataset.project_id)
    .eq("month", dataset.month)
    .neq("id", dataset.id)
    .in("status", ["approved", "included"])

  const lockedDataset = activeApproved?.find((row) => row.status === "included")
  if (lockedDataset) {
    throw new Error("This month already has a locked dataset for the same project")
  }

  if (activeApproved && activeApproved.length > 0) {
    const { error: replaceError } = await supabase
      .from("zkas_datasets")
      .update({
        status: "replaced",
        replaced_by_dataset_id: dataset.id,
      })
      .in("id", activeApproved.map((entry) => entry.id))

    if (replaceError) {
      throw new Error(replaceError.message)
    }
  }

  const monthlyCycleId = dataset.monthly_cycle_id ?? (await getOrCreateMonthlyCycleIdForMonth(dataset.month, actor.userId))
  const { error } = await supabase
    .from("zkas_datasets")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_user_id: actor.userId,
      monthly_cycle_id: monthlyCycleId,
    })
    .eq("id", dataset.id)
    .eq("status", "validated")

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/zkas/uploads")
  revalidatePath(`/admin/zkas/uploads/${dataset.id}`)
  revalidateMonthlyCycleZkasPaths(dataset.month)
}

export async function rejectZkasDataset(formData: FormData): Promise<void> {
  await requireInternalZkasOperator()
  const datasetId = Number.parseInt(String(formData.get("datasetId") ?? ""), 10)
  if (!Number.isInteger(datasetId)) {
    throw new Error("Dataset is required")
  }

  const supabase = getAdminSupabaseClient()
  const { data: dataset } = await supabase.from("zkas_datasets").select("month").eq("id", datasetId).maybeSingle()
  const { error } = await supabase.from("zkas_datasets").update({ status: "failed" }).eq("id", datasetId)
  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/zkas/uploads")
  revalidatePath(`/admin/zkas/uploads/${datasetId}`)
  if (dataset?.month) {
    revalidateMonthlyCycleZkasPaths(dataset.month)
  }
}

export async function createZkasRunDraft(formData: FormData): Promise<void> {
    const actor = await requireInternalZkasOperator()
    const month = String(formData.get("month") ?? "")
    const datasetIds = formData
      .getAll("datasetIds")
      .map((value) => Number.parseInt(String(value), 10))
      .filter((value) => Number.isInteger(value))

    if (datasetIds.length === 0) {
      throw new Error("Select at least one approved dataset")
    }

    const supabase = getAdminSupabaseClient()
    const { data: datasets, error: datasetsError } = await supabase
      .from("zkas_datasets")
      .select("*")
      .in("id", datasetIds)
      .eq("status", "approved")

    if (datasetsError) {
      throw new Error(datasetsError.message)
    }

    if ((datasets ?? []).length !== datasetIds.length) {
      throw new Error("All selected datasets must be approved")
    }

    const duplicateProjects = new Set<number>()
    const seenProjects = new Set<number>()
    for (const dataset of datasets ?? []) {
      if (dataset.month !== month) {
        throw new Error("All selected datasets must match the run month")
      }
      if (seenProjects.has(dataset.project_id)) {
        duplicateProjects.add(dataset.project_id)
      }
      seenProjects.add(dataset.project_id)
    }

    if (duplicateProjects.size > 0) {
      throw new Error("Only one dataset per project can be included in a run")
    }

    const payments = await getConfirmedPaymentsForMonth(month)
    const usdPool = payments.reduce((total, payment) => total + Number(payment.payment_amount), 0)
    const identityArtifact = await getApprovedIdentityArtifact(month)
    const monthlyCycleId = await getOrCreateMonthlyCycleIdForMonth(month, actor.userId)
    const [{ error: datasetCycleError }, { error: artifactCycleError }] = await Promise.all([
      supabase.from("zkas_datasets").update({ monthly_cycle_id: monthlyCycleId }).in("id", datasetIds),
      supabase.from("zkas_identity_artifacts").update({ monthly_cycle_id: monthlyCycleId }).eq("id", identityArtifact.id),
    ])

    if (datasetCycleError) {
      throw new Error(datasetCycleError.message)
    }

    if (artifactCycleError) {
      throw new Error(artifactCycleError.message)
    }

    const { data: run, error: runError } = await supabase
      .from("zkas_runs")
      .insert({
        month,
        monthly_cycle_id: monthlyCycleId,
        status: "draft",
        usd_pool: usdPool,
        identity_artifact_id: identityArtifact.id,
        engine_git_ref: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "local-dev",
        engine_image_ref: "zkas/local",
        engine_config_version: "local-v1",
        schema_version: ZKAS_SCHEMA_VERSION,
        created_by_user_id: actor.userId,
      })
      .select("*")
      .single()

    if (runError || !run) {
      throw new Error(runError?.message ?? "Could not create run")
    }

    const runDatasetsPayload = (datasets ?? []).map((dataset) => ({
      run_id: run.id,
      dataset_id: dataset.id,
      project_id: dataset.project_id,
      object_path: dataset.object_path,
      file_hash: dataset.file_hash,
      row_count: dataset.row_count,
    }))
    const runPaymentsPayload = payments.map((payment) => ({
      run_id: run.id,
      payment_id: payment.id,
      project_id: payment.project_id,
      amount_usd: Number(payment.payment_amount),
      period_end: payment.period_end,
    }))

    if (runDatasetsPayload.length > 0) {
      const { error } = await supabase.from("zkas_run_datasets").insert(runDatasetsPayload)
      if (error) {
        throw new Error(error.message)
      }
    }

    if (runPaymentsPayload.length > 0) {
      const { error } = await supabase.from("zkas_run_payments").insert(runPaymentsPayload)
      if (error) {
        throw new Error(error.message)
      }
    }

    revalidatePath("/admin/zkas/runs")
    revalidatePath(`/admin/zkas/runs/${run.id}`)
    revalidateMonthlyCycleZkasPaths(month)
}

export async function lockZkasRun(formData: FormData): Promise<void> {
    await requireInternalZkasOperator()
    const runId = Number.parseInt(String(formData.get("runId") ?? ""), 10)
    if (!Number.isInteger(runId)) {
      throw new Error("Run is required")
    }

    const supabase = getAdminSupabaseClient()
    const { run, datasets, payments, identityArtifact } = await getLockedRunContext(runId)
    if (run.status !== "draft") {
      throw new Error("Only draft runs can be locked")
    }
    const monthlyCycleId = run.monthly_cycle_id ?? (await getOrCreateMonthlyCycleIdForMonth(run.month))

    const manifest: ZkasRunManifest = {
      version: "run-manifest.v1",
      run_id: run.id,
      month: run.month,
      usd_pool: Number(run.usd_pool),
      allocation_policy: "proportional_pool",
      engine_bundle: {
        git_ref: run.engine_git_ref,
        image_ref: run.engine_image_ref,
        config_version: run.engine_config_version,
      },
      schema_version: run.schema_version,
      datasets: datasets.map((dataset) => ({
        dataset_id: dataset.dataset_id,
        project_id: dataset.project_id,
        format: dataset.object_path.endsWith(".csv") ? "csv" : "json",
        object_path: dataset.object_path,
        file_hash: dataset.file_hash,
        row_count: dataset.row_count,
      })),
      payments: payments.map((payment) => ({
        payment_id: payment.payment_id,
        project_id: payment.project_id,
        amount_usd: Number(payment.amount_usd),
        period_end: payment.period_end,
      })),
      identity_artifact: {
        artifact_id: identityArtifact.id,
        object_path: identityArtifact.object_path,
        artifact_hash: identityArtifact.artifact_hash,
        schema_version: identityArtifact.schema_version,
      },
    }

    const manifestText = serializeManifest(manifest)
    const manifestHash = hashManifest(manifest)
    const manifestPath = buildZkasRunArtifactPath({
      cycleKey: run.month,
      runId: run.id,
      artifact: "run-manifest",
    })
    await uploadTextArtifact(ZKAS_RUN_BUCKET, manifestPath, manifestText, "application/json")

    const { error: runUpdateError } = await supabase
      .from("zkas_runs")
      .update({
        monthly_cycle_id: monthlyCycleId,
        status: "locked",
        locked_at: new Date().toISOString(),
        locked_manifest: manifest,
        locked_manifest_hash: manifestHash,
      })
      .eq("id", run.id)

    if (runUpdateError) {
      throw new Error(runUpdateError.message)
    }

    const { error: datasetUpdateError } = await supabase
      .from("zkas_datasets")
      .update({ status: "included", monthly_cycle_id: monthlyCycleId })
      .in(
        "id",
        datasets.map((dataset) => dataset.dataset_id),
      )

    if (datasetUpdateError) {
      throw new Error(datasetUpdateError.message)
    }

    revalidatePath("/admin/zkas/runs")
    revalidatePath(`/admin/zkas/runs/${run.id}`)
    revalidateMonthlyCycleZkasPaths(run.month)
}

export async function dispatchZkasRun(formData: FormData): Promise<void> {
    await requireInternalZkasOperator()
    const runId = Number.parseInt(String(formData.get("runId") ?? ""), 10)
    if (!Number.isInteger(runId)) {
      throw new Error("Run is required")
    }

    const supabase = getAdminSupabaseClient()
    const { run, datasets, identityArtifact } = await getLockedRunContext(runId)
    if (!["locked", "failed"].includes(run.status)) {
      throw new Error("Only locked or failed runs can be dispatched")
    }
    const monthlyCycleId = run.monthly_cycle_id ?? (await getOrCreateMonthlyCycleIdForMonth(run.month))

    const { data: attempt, error: attemptError } = await supabase
      .from("zkas_run_attempts")
      .insert({
        run_id: run.id,
        mode: "local",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (attemptError || !attempt) {
      throw new Error(attemptError?.message ?? "Could not create run attempt")
    }

    await supabase.from("zkas_runs").update({ status: "running" }).eq("id", run.id)

    try {
      const datasetFiles = await Promise.all(
        datasets.map(async (dataset) => ({
          objectPath: dataset.object_path,
          content: await downloadTextArtifact(ZKAS_DATASET_BUCKET, dataset.object_path),
        })),
      )
      const identityContent = await downloadTextArtifact(ZKAS_IDENTITY_BUCKET, identityArtifact.object_path)

      const localManifest: LocalExecutionManifest = {
        version: "local-run-manifest.v1",
        run_id: run.id,
        month: run.month,
        usd_pool: Number(run.usd_pool),
        allocation_policy: "proportional_pool",
        datasets: datasets.map((dataset) => ({
          dataset_id: dataset.dataset_id,
          project_id: dataset.project_id,
          format: dataset.object_path.endsWith(".csv") ? "csv" : "json",
          file_path: dataset.object_path,
          file_hash: dataset.file_hash,
        })),
        identity_artifact: {
          artifact_id: identityArtifact.id,
          file_path: identityArtifact.object_path,
          artifact_hash: identityArtifact.artifact_hash,
        },
      }

      const { result, logs } = await runLocalZkasExecution({
        manifest: localManifest,
        datasetFiles,
        identityArtifactContent: identityContent,
      })

      const resultText = JSON.stringify(result, null, 2)
      const resultPath = buildZkasRunArtifactPath({
        cycleKey: run.month,
        runId: run.id,
        artifact: "run-result",
      })
      await uploadTextArtifact(ZKAS_RUN_BUCKET, resultPath, resultText, "application/json")

      await supabase.from("zkas_run_results").delete().eq("run_id", run.id)
      const { error: resultsError } = await supabase.from("zkas_run_results").insert(
        result.rows.map((row) => ({
          run_id: run.id,
          monthly_cycle_id: monthlyCycleId,
          zkas_user_id: row.zkas_user_id,
          eligibility: row.eligibility,
          aggregate_score: row.aggregate_score,
          allocation_usd: row.allocation_usd,
          app_count: row.app_count,
          project_count: row.project_count,
          output_row_hash: row.output_row_hash,
        })),
      )

      if (resultsError) {
        throw new Error(resultsError.message)
      }

      const resultHash = hashTextContent(resultText)
      await supabase
        .from("zkas_run_attempts")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          logs,
        })
        .eq("id", attempt.id)

      await supabase
        .from("zkas_runs")
        .update({
          monthly_cycle_id: monthlyCycleId,
          status: "completed",
          verification_status: "pending",
          verified_by_user_id: null,
          verified_at: null,
          verification_note: null,
          published_by_user_id: null,
          published_at: null,
          publication_note: null,
          finalized_at: null,
          result_artifact_path: resultPath,
          result_artifact_hash: resultHash,
          total_score: result.total_score,
          total_allocated_usd: result.total_allocated_usd,
          user_count: result.user_count,
        })
        .eq("id", run.id)
    } catch (error) {
      await supabase
        .from("zkas_run_attempts")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          failure_reason: error instanceof Error ? error.message : "Local execution failed",
        })
        .eq("id", attempt.id)

      await supabase.from("zkas_runs").update({ status: "failed" }).eq("id", run.id)
      throw error
    }

    revalidatePath("/admin/zkas/runs")
    revalidatePath(`/admin/zkas/runs/${run.id}`)
    revalidateMonthlyCycleZkasPaths(run.month)
}

export async function verifyZkasRun(formData: FormData): Promise<void> {
  const actor = await requireZkasSuperadmin()
  const runId = Number.parseInt(String(formData.get("runId") ?? ""), 10)
  const note = String(formData.get("verificationNote") ?? "").trim() || null

  if (!Number.isInteger(runId)) {
    throw new Error("Run is required")
  }

  const supabase = getAdminSupabaseClient()
  const { data: run, error } = await supabase
    .from("zkas_runs")
    .select("id, month, status, verification_status, published_at")
    .eq("id", runId)
    .single()

  if (error || !run) {
    throw new Error(error?.message ?? "Run not found")
  }

  if (run.status !== "completed") {
    throw new Error("Only completed runs can be verified")
  }

  if (run.published_at) {
    throw new Error("Published runs cannot be re-verified")
  }

  const { error: updateError } = await supabase
    .from("zkas_runs")
    .update({
      verification_status: "verified",
      verified_by_user_id: actor.userId,
      verified_at: new Date().toISOString(),
      verification_note: note,
    })
    .eq("id", runId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const { datasets } = await getLockedRunContext(runId)
  const projectSlugs = await getRunProjectSlugs(datasets.map((dataset) => dataset.project_id))
  revalidateZkasPaths(runId, projectSlugs)
  revalidateMonthlyCycleZkasPaths(run.month)
}

export async function rejectZkasRunVerification(formData: FormData): Promise<void> {
  const actor = await requireZkasSuperadmin()
  const runId = Number.parseInt(String(formData.get("runId") ?? ""), 10)
  const note = String(formData.get("verificationNote") ?? "").trim() || null

  if (!Number.isInteger(runId)) {
    throw new Error("Run is required")
  }

  const supabase = getAdminSupabaseClient()
  const { data: run, error } = await supabase
    .from("zkas_runs")
    .select("id, month, status, published_at")
    .eq("id", runId)
    .single()

  if (error || !run) {
    throw new Error(error?.message ?? "Run not found")
  }

  if (run.status !== "completed") {
    throw new Error("Only completed runs can be marked rejected")
  }

  if (run.published_at) {
    throw new Error("Published runs cannot be rejected")
  }

  const { error: updateError } = await supabase
    .from("zkas_runs")
    .update({
      verification_status: "rejected",
      verified_by_user_id: actor.userId,
      verified_at: new Date().toISOString(),
      verification_note: note,
    })
    .eq("id", runId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const { datasets } = await getLockedRunContext(runId)
  const projectSlugs = await getRunProjectSlugs(datasets.map((dataset) => dataset.project_id))
  revalidateZkasPaths(runId, projectSlugs)
  revalidateMonthlyCycleZkasPaths(run.month)
}

export async function publishZkasRun(formData: FormData): Promise<void> {
  const actor = await requireZkasSuperadmin()
  const runId = Number.parseInt(String(formData.get("runId") ?? ""), 10)
  const note = String(formData.get("publicationNote") ?? "").trim() || null

  if (!Number.isInteger(runId)) {
    throw new Error("Run is required")
  }

  const supabase = getAdminSupabaseClient()
  const context = await getRunPublicationContext(runId)

  if (context.run.status !== "completed") {
    throw new Error("Only completed runs can be published")
  }

  if (context.run.verification_status !== "verified") {
    throw new Error("Run must be verified before publication")
  }

  if (context.run.published_at) {
    throw new Error("Run has already been published")
  }

  const publishedAt = new Date().toISOString()
  const monthlyCycleId = context.run.monthly_cycle_id ?? (await getOrCreateMonthlyCycleIdForMonth(context.run.month, actor.userId))
  const materialization = buildPublicationMaterialization({
    runId: context.run.id,
    publishedAt,
    datasets: context.datasetArtifacts,
    payments: context.payments.map((payment) => ({
      project_id: payment.project_id,
      amount_usd: Number(payment.amount_usd),
    })),
    mappings: context.mappings,
    resultRows: context.resultRows.map((row) => ({
      zkas_user_id: row.zkas_user_id,
      eligibility: row.eligibility,
      aggregate_score: Number(row.aggregate_score),
      allocation_usd: Number(row.allocation_usd),
      app_count: row.app_count,
      project_count: row.project_count,
      output_row_hash: row.output_row_hash,
    })),
    cubidScoresByUserId: context.cubidScoresByUserId,
  })

  const projectSlugs = await getRunProjectSlugs(context.datasets.map((dataset) => dataset.project_id))
  const notificationTypeId = await getNotificationTypeId(ZKAS_PUBLISHED_RESULT_NOTIFICATION_CODE)
  const notificationPayloads = materialization.publishedUserResults.map((row) => ({
    user_id: row.user_id,
    type_id: notificationTypeId,
    is_read: false,
    read_at: null,
    content: {
      type: "zkas_published_result",
      run_id: context.run.id,
      month: context.run.month,
      allocation_usd: row.allocation_usd,
      destination: "/workspace/reporting",
    } satisfies ZkasPublishedResultNotificationPayload,
  }))

  let insertedNotificationIds: number[] = []
  try {
    const insertedNotifications = notificationPayloads.length
      ? await supabase
          .from("user_notifications")
          .insert(notificationPayloads)
          .select("id, user_id")
      : { data: [], error: null }

    if (insertedNotifications.error) {
      throw new Error(insertedNotifications.error.message)
    }

    insertedNotificationIds = (insertedNotifications.data ?? []).map((notification) => notification.id)
    const notificationIdByUserId = new Map(
      (insertedNotifications.data ?? []).map((notification) => [notification.user_id, notification.id]),
    )

    const publishedRowsPayload = materialization.publishedUserResults.map((row) => ({
      run_id: row.run_id,
      monthly_cycle_id: monthlyCycleId,
      user_id: row.user_id,
      zkas_user_id: row.zkas_user_id,
      allocation_usd: row.allocation_usd,
      aggregate_score: row.aggregate_score,
      published_at: row.published_at,
      notification_id: notificationIdByUserId.get(row.user_id) ?? null,
    }))

    if (publishedRowsPayload.length > 0) {
      const { error } = await supabase.from("zkas_published_user_results").insert(publishedRowsPayload)
      if (error) {
        throw new Error(error.message)
      }
    }

    if (materialization.projectSummaries.length > 0) {
      const { error } = await supabase.from("zkas_run_project_summaries").insert(
        materialization.projectSummaries.map((summary: ZkasProjectAnalyticsSummary) => ({
          run_id: summary.run_id,
          monthly_cycle_id: monthlyCycleId,
          project_id: summary.project_id,
          dataset_id: summary.dataset_id,
          contributed_amount_usd: summary.contributed_amount_usd,
          active_user_count: summary.active_user_count,
          avg_contribution_per_active_user_usd: summary.avg_contribution_per_active_user_usd,
          published_user_count: summary.published_user_count,
          attributed_payout_usd: summary.attributed_payout_usd,
          avg_attributed_payout_per_published_user_usd: summary.avg_attributed_payout_per_published_user_usd,
        })),
      )

      if (error) {
        throw new Error(error.message)
      }
    }

    if (materialization.cubidBuckets.length > 0) {
      const { error } = await supabase.from("zkas_run_project_cubid_buckets").insert(
        materialization.cubidBuckets.map((bucket: ZkasProjectCubidBucket) => ({
          run_id: bucket.run_id,
          project_id: bucket.project_id,
          bucket_key: bucket.bucket_key,
          bucket_label: bucket.bucket_label,
          user_count: bucket.user_count,
        })),
      )

      if (error) {
        throw new Error(error.message)
      }
    }

    const { error: updateError } = await supabase
      .from("zkas_runs")
      .update({
        status: "finalized",
        monthly_cycle_id: monthlyCycleId,
        finalized_at: publishedAt,
        published_by_user_id: actor.userId,
        published_at: publishedAt,
        publication_note: note,
      })
      .eq("id", runId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  } catch (error) {
    await supabase.from("zkas_published_user_results").delete().eq("run_id", runId)
    await supabase.from("zkas_run_project_summaries").delete().eq("run_id", runId)
    await supabase.from("zkas_run_project_cubid_buckets").delete().eq("run_id", runId)
    if (insertedNotificationIds.length > 0) {
      await supabase.from("user_notifications").delete().in("id", insertedNotificationIds)
    }
    throw error
  }

  revalidateZkasPaths(runId, projectSlugs)
  revalidateMonthlyCycleZkasPaths(context.run.month)
}

export async function finalizeZkasRun(formData: FormData): Promise<void> {
    await requireZkasSuperadmin()
    const runId = Number.parseInt(String(formData.get("runId") ?? ""), 10)
    if (!Number.isInteger(runId)) {
      throw new Error("Run is required")
    }

    const supabase = getAdminSupabaseClient()
    const { data: run, error } = await supabase
      .from("zkas_runs")
      .select("id, month, status, published_at")
      .eq("id", runId)
      .single()
    if (error || !run) {
      throw new Error(error?.message ?? "Run not found")
    }

    if (!run.published_at) {
      throw new Error("Only published runs can be finalized")
    }

    const { error: updateError } = await supabase
        .from("zkas_runs")
        .update({
        status: "finalized",
        finalized_at: new Date().toISOString(),
      })
      .eq("id", runId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    revalidatePath("/admin/zkas/runs")
    revalidatePath(`/admin/zkas/runs/${runId}`)
    revalidateMonthlyCycleZkasPaths(run.month)
}

export async function getCurrentZkasViewerProjects() {
  const actor = await getAuthenticatedActor()
  const supabase = getAdminSupabaseClient()

  const { data: participants } = await supabase
    .from("participants")
    .select("id, project_id, is_admin")
    .eq("user_id", actor.userId)
    .eq("is_admin", true)

  const participantIds = participants?.map((participant) => participant.id) ?? []
  const projectIds = participants?.map((participant) => participant.project_id) ?? []
  const zkasRoleId = await getCachedZkasRoleId()

  const [{ data: roles }, { data: projects }] = await Promise.all([
    participantIds.length > 0
      ? supabase.from("participant_roles").select("participant_id").in("participant_id", participantIds).eq("role_id", zkasRoleId)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, slug, name").in("id", projectIds).order("name")
      : Promise.resolve({ data: [], error: null }),
  ])

  const allowedParticipants = new Set((roles ?? []).map((entry) => entry.participant_id))
  const allowedProjects = new Set(
    (participants ?? [])
      .filter((participant) => allowedParticipants.has(participant.id))
      .map((participant) => participant.project_id),
  )

  return {
    isInternalAdmin: isInternalAdminEmail(actor.email),
    projects: (projects ?? []).filter((project) => allowedProjects.has(project.id)),
  }
}

export async function getZkasDatasetDetail(datasetId: number) {
  const actor = await getAuthenticatedActor()
  const supabase = getAdminSupabaseClient()
  const { data: dataset, error } = await supabase.from("zkas_datasets").select("*").eq("id", datasetId).single()
  if (error || !dataset) {
    throw new Error(error?.message ?? "Dataset not found")
  }

  if (!isInternalAdminEmail(actor.email) && !isZkasSuperadminEmail(actor.email)) {
    const membership = await getProjectMembershipForActor(
      (await supabase.from("projects").select("slug").eq("id", dataset.project_id).single()).data?.slug ?? "",
      actor.userId,
    )
    if (!membership?.hasZkasAccess) {
      throw new Error("You do not have access to this dataset")
    }
  }

  const { data: issues } = await supabase
    .from("zkas_dataset_issues")
    .select("*")
    .eq("dataset_id", datasetId)
    .order("id", { ascending: true })

  return {
    dataset,
    issues: issues ?? [],
  }
}
