import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { resolveDeploymentEnvironment, type DeploymentEnvironment } from "@/lib/onchain/runtime-config"
import { isInternalAdminEmail } from "@/lib/zkas/auth"
import type { Tables, TablesInsert } from "@/types/supabase"
import {
  PAYMENT_FLOWS,
  getAttemptHandle,
  normalizePaymentFlowErrorCode,
  normalizePaymentFlowErrorMessage,
  sanitizePaymentFlowMetadata,
  type PaymentFlow,
  type PaymentFlowActorRole,
  type PaymentFlowEventInput,
  type PaymentFlowOutcome,
} from "@/lib/observability/payment-flow"

type PaymentFlowEventRow = Tables<"payment_flow_events">

type RoleReferenceRow = { id: number }

export type PaymentFlowSummaryWindow = {
  attempts: number
  successes: number
  failures: number
  latestFailureAt: string | null
}

export type PaymentFlowSummary = {
  flow: PaymentFlow
  last24h: PaymentFlowSummaryWindow
  last7d: PaymentFlowSummaryWindow
}

export type PaymentFlowEventListItem = PaymentFlowEventRow & {
  project_name: string | null
  project_slug: string | null
}

export type PaymentFlowEventFilters = {
  flow?: PaymentFlow
  outcome?: PaymentFlowOutcome
  actorRole?: PaymentFlowActorRole
  projectId?: number
  paymentId?: number
  attemptId?: string
  days?: number
  limit?: number
}

let adminRoleIdsPromise: Promise<number[]> | null = null

async function getOrganizationAdminRoleIds() {
  if (!adminRoleIdsPromise) {
    adminRoleIdsPromise = (async () => {
      const supabase = getAdminSupabaseClient()
      const { data, error } = await supabase.from("ref_roles").select("id").in("name", ["Founder", "Admin"])
      if (error) {
        throw error
      }

      return ((data ?? []) as RoleReferenceRow[]).map((role) => role.id)
    })()
  }

  return adminRoleIdsPromise
}

export function getObservabilityEnvironment(env: NodeJS.ProcessEnv = process.env): DeploymentEnvironment {
  return resolveDeploymentEnvironment(env)
}

export async function resolvePaymentFlowActorRole(input: {
  userId: string | null
  email: string | null
  projectId?: number | null
}): Promise<PaymentFlowActorRole> {
  if (!input.userId) {
    return "unauthenticated"
  }

  if (isInternalAdminEmail(input.email)) {
    return "internal_admin"
  }

  if (!input.projectId) {
    return "authenticated_user"
  }

  const supabase = getAdminSupabaseClient()
  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId)
    .eq("is_admin", true)
    .maybeSingle()

  if (participant?.id) {
    return "project_admin"
  }

  const { data: project } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", input.projectId)
    .maybeSingle()

  const adminRoleIds = await getOrganizationAdminRoleIds()
  if (project?.organization_id && adminRoleIds.length > 0) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", project.organization_id)
      .eq("user_id", input.userId)
      .eq("status", "active")
      .in("role_id", adminRoleIds)
      .maybeSingle()

    if (membership?.id) {
      return "project_admin"
    }
  }

  return "authenticated_user"
}

function buildInsertPayload(input: PaymentFlowEventInput): TablesInsert<"payment_flow_events"> {
  return {
    flow: input.flow,
    stage: input.stage,
    outcome: input.outcome,
    severity: input.severity ?? (input.outcome === "failure" ? "error" : "info"),
    attempt_id: input.attemptId,
    actor_user_id: input.actorUserId ?? null,
    actor_role: input.actorRole ?? (input.actorUserId ? "authenticated_user" : "unauthenticated"),
    project_id: input.projectId ?? null,
    payment_id: input.paymentId ?? null,
    submission_id: input.submissionId ?? null,
    payment_method_id: input.paymentMethodId ?? null,
    chain_id: input.chainId ?? null,
    chain_asset_id: input.chainAssetId ?? null,
    intake_contract_id: input.intakeContractId ?? null,
    tx_hash: input.txHash ?? null,
    wallet_address: input.walletAddress ?? null,
    environment: input.environment,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
    metadata: sanitizePaymentFlowMetadata(input.metadata),
  }
}

export async function recordPaymentFlowEvent(input: PaymentFlowEventInput): Promise<void> {
  try {
    const supabase = getAdminSupabaseClient()
    const { error } = await supabase.from("payment_flow_events").insert(buildInsertPayload(input))
    if (error) {
      throw error
    }
  } catch (error) {
    console.error("Failed to store payment flow observability event", error)
  }
}

export async function recordPaymentFlowEvents(inputs: PaymentFlowEventInput[]): Promise<void> {
  if (inputs.length === 0) {
    return
  }

  try {
    const supabase = getAdminSupabaseClient()
    const { error } = await supabase.from("payment_flow_events").insert(inputs.map(buildInsertPayload))
    if (error) {
      throw error
    }
  } catch (error) {
    console.error("Failed to store payment flow observability events", error)
  }
}

export async function recordPaymentFlowFailure(
  input: Omit<PaymentFlowEventInput, "outcome" | "severity" | "errorCode" | "errorMessage"> & {
    error: unknown
    severity?: "warning" | "error"
  },
) {
  await recordPaymentFlowEvent({
    ...input,
    outcome: "failure",
    severity: input.severity ?? "error",
    errorCode: normalizePaymentFlowErrorCode(input.stage, input.error),
    errorMessage: normalizePaymentFlowErrorMessage(input.error),
  })
}

function buildSummaryWindow(events: PaymentFlowEventRow[]) {
  const attempts = new Set<string>()
  const successes = new Set<string>()
  const failures = new Set<string>()
  let latestFailureAt: string | null = null

  for (const event of events) {
    if (event.outcome === "attempt") {
      attempts.add(event.attempt_id)
    }

    if (event.outcome === "success") {
      successes.add(event.attempt_id)
    }

    if (event.outcome === "failure") {
      failures.add(event.attempt_id)
      if (!latestFailureAt || event.created_at > latestFailureAt) {
        latestFailureAt = event.created_at
      }
    }
  }

  return {
    attempts: attempts.size,
    successes: successes.size,
    failures: failures.size,
    latestFailureAt,
  }
}

export function summarizePaymentFlowEvents(events: PaymentFlowEventRow[], now = new Date()): PaymentFlowSummary[] {
  const last24hCutoff = now.getTime() - 24 * 60 * 60 * 1000
  const last7dCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000

  return PAYMENT_FLOWS.map((flow) => {
    const flowEvents = events.filter((event) => event.flow === flow)
    const last24h = flowEvents.filter((event) => new Date(event.created_at).getTime() >= last24hCutoff)
    const last7d = flowEvents.filter((event) => new Date(event.created_at).getTime() >= last7dCutoff)

    return {
      flow,
      last24h: buildSummaryWindow(last24h),
      last7d: buildSummaryWindow(last7d),
    }
  })
}

export async function listPaymentFlowSummaries() {
  const supabase = getAdminSupabaseClient()
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("payment_flow_events")
    .select("id, created_at, flow, stage, outcome, severity, attempt_id, actor_user_id, actor_role, project_id, payment_id, submission_id, payment_method_id, chain_id, chain_asset_id, intake_contract_id, tx_hash, wallet_address, environment, error_code, error_message, metadata")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return summarizePaymentFlowEvents((data ?? []) as PaymentFlowEventRow[])
}

export async function listPaymentFlowEvents(filters: PaymentFlowEventFilters = {}): Promise<PaymentFlowEventListItem[]> {
  const supabase = getAdminSupabaseClient()
  let query = supabase
    .from("payment_flow_events")
    .select(`
      id,
      created_at,
      flow,
      stage,
      outcome,
      severity,
      attempt_id,
      actor_user_id,
      actor_role,
      project_id,
      payment_id,
      submission_id,
      payment_method_id,
      chain_id,
      chain_asset_id,
      intake_contract_id,
      tx_hash,
      wallet_address,
      environment,
      error_code,
      error_message,
      metadata,
      projects(name, slug)
    `)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 50)

  if (filters.flow) {
    query = query.eq("flow", filters.flow)
  }

  if (filters.outcome) {
    query = query.eq("outcome", filters.outcome)
  }

  if (filters.actorRole) {
    query = query.eq("actor_role", filters.actorRole)
  }

  if (filters.projectId) {
    query = query.eq("project_id", filters.projectId)
  }

  if (filters.paymentId) {
    query = query.eq("payment_id", filters.paymentId)
  }

  if (filters.attemptId) {
    query = query.eq("attempt_id", filters.attemptId)
  }

  if (filters.days && Number.isFinite(filters.days)) {
    const cutoff = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte("created_at", cutoff)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  return ((data ?? []) as Array<PaymentFlowEventRow & { projects: { name: string; slug: string | null } | null }>).map((row) => ({
    ...row,
    project_name: row.projects?.name ?? null,
    project_slug: row.projects?.slug ?? null,
  }))
}

export async function listRecentPaymentFlowFailures(limit = 5) {
  return listPaymentFlowEvents({
    outcome: "failure",
    limit,
    days: 7,
  })
}

export async function listAttemptPaymentFlowEvents(attemptId: string) {
  return listPaymentFlowEvents({
    attemptId,
    limit: 100,
  })
}

export function formatEventError(input: { stage: string; error_code: string | null; error_message: string | null }) {
  return input.error_message ?? input.error_code ?? `${input.stage} failed`
}

export function buildAttemptLabel(attemptId: string) {
  return `Attempt ${getAttemptHandle(attemptId)}`
}
