"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  getPromotedDefaultRouteId,
  moveProjectCryptoRouteState,
  renumberProjectCryptoRouteStates,
  type RouteMoveDirection,
  type ProjectCryptoRouteState,
} from "@/lib/project-crypto-routes"
import { requireInternalAdminActor } from "@/lib/zkas/auth"
import { validateProjectPaymentDrafts, type ProjectPaymentDraftInput } from "@/lib/payments"
import {
  getDeploymentAvailabilityForRoute,
  getWalletRuntimeConfig,
  resolveDeploymentEnvironment,
  type DeploymentAvailability,
} from "@/lib/onchain/runtime-config"
import {
  listProjectOnchainSubmissionSummaries,
  runOnchainPaymentReconciliation,
  type OnchainReconciliationRunSummary,
} from "@/lib/onchain/payment-reconciliation"
import type { OnchainSubmissionSummary } from "@/lib/onchain/payment-submissions"
import {
  normalizePaymentFlowErrorCode,
  normalizePaymentFlowErrorMessage,
  type PaymentFlowActorRole,
} from "@/lib/observability/payment-flow"
import { recordPaymentFlowEvent } from "@/lib/observability/payment-flow-server"
import type { Json, Tables } from "@/types/supabase"

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type PaymentRecordSummary = {
  id: number
  project_id: number | null
  project_name: string
  project_slug: string | null
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method_id: number | null
  payment_method_name: string
  payment_method_code: string
  status_id: number | null
  status_name: string
  status_code: string
  created_at: string | null
  updated_at: string | null
  paid_at: string | null
  confirmed_at: string | null
  notes: string | null
  latest_onchain_submission: OnchainSubmissionSummary | null
}

export type ManagedCryptoPaymentMethodSummary = {
  id: number
  label: string | null
  is_default: boolean
  is_enabled: boolean
  sort_order: number
  is_runtime_available: boolean
  runtime_availability_issue: string | null
  chain: {
    id: number
    display_name: string
    network_key: string
    evm_chain_id: number
    native_asset_symbol: string
    is_active: boolean
  }
  asset: {
    id: number
    symbol: string
    name: string
    token_address: string | null
    decimals: number
    is_native: boolean
    is_stablecoin: boolean
    is_active: boolean
  }
  intakeContract: {
    id: number
    contract_address: string
    treasury_address: string
    abi_version: string
    is_active: boolean
  }
}

type ManagedCryptoPaymentMethodRow = {
  id: number
  method_id: number
  project_id: number | null
  label: string | null
  is_default: boolean | null
  is_enabled: boolean
  sort_order: number
  chain_id: number | null
  chain_asset_id: number | null
  intake_contract_id: number | null
  collection_mode: "contract" | "deposit_address"
  ref_chains: Pick<
    Tables<"ref_chains">,
    "id" | "display_name" | "network_key" | "evm_chain_id" | "native_asset_symbol" | "is_active"
  >
  ref_chain_assets: Pick<
    Tables<"ref_chain_assets">,
    "id" | "symbol" | "name" | "token_address" | "decimals" | "is_native" | "is_stablecoin" | "is_active"
  >
  chain_intake_contracts: Pick<
    Tables<"chain_intake_contracts">,
    "id" | "contract_address" | "treasury_address" | "abi_version" | "is_active"
  >
}

type MinimalCryptoPaymentMethodRow = Pick<
  Tables<"payment_methods">,
  | "id"
  | "project_id"
  | "method_id"
  | "chain_id"
  | "chain_asset_id"
  | "intake_contract_id"
  | "is_default"
  | "is_enabled"
  | "sort_order"
  | "collection_mode"
>

type PaymentMethodReferenceRow = Pick<Tables<"ref_payment_methods">, "id">

type ProjectContext = {
  userId: string
  project: Pick<Tables<"projects">, "id" | "slug" | "name" | "organization_id" | "default_payment_method_id">
}

type RecordOnchainPaymentInput = {
  projectSlug: string
  attemptId?: string
  paymentId: number
  paymentMethodId: number
  txHash: string
  walletAddress: string
  amountRaw: string
  amountDecimal: string
  periodId: number
  chainId: number
  chainAssetId: number
  intakeContractId: number
  blockNumber?: number | null
  receipt: Json
}

type CreateProjectPaymentDraftsInput = {
  projectSlug: string
  attemptId?: string
  payments: ProjectPaymentDraftInput[]
}

type CreateProjectCryptoPaymentMethodInput = {
  projectSlug: string
  chainId: number
  chainAssetId: number
  intakeContractId: number
  label: string
  isDefault?: boolean
}

type UpdateProjectCryptoPaymentMethodInput = {
  projectSlug: string
  paymentMethodId: number
  chainId: number
  chainAssetId: number
  intakeContractId: number
  label: string
  isDefault: boolean
}

type MoveProjectCryptoPaymentMethodInput = {
  projectSlug: string
  paymentMethodId: number
  direction: RouteMoveDirection
}

type ToggleProjectCryptoPaymentMethodEnabledInput = {
  projectSlug: string
  paymentMethodId: number
  enabled: boolean
}

function getObservabilityAttemptId(attemptId?: string) {
  return attemptId?.trim() || crypto.randomUUID()
}

type InsertedPaymentRow = {
  id: number
  project_id: number | null
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method_id: number | null
  status_id: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  paid_at: string | null
  confirmed_at: string | null
  projects: Pick<Tables<"projects">, "name" | "slug"> | null
  ref_payment_methods: Pick<Tables<"ref_payment_methods">, "name" | "code"> | null
  ref_payment_statuses: Pick<Tables<"ref_payment_statuses">, "name" | "code"> | null
}

type RecordOnchainPaymentRouteSnapshot = {
  id: number
  method_id: number
  project_id: number | null
  chain_id: number | null
  chain_asset_id: number | null
  intake_contract_id: number | null
  ref_chains: {
    network_key: string
  }
  chain_intake_contracts: {
    contract_address: string
    treasury_address: string
    abi_version: string
  }
  ref_chain_assets: {
    token_address: string | null
    is_native: boolean
  }
}

const MANAGED_CRYPTO_PAYMENT_METHOD_SELECT = `
  id,
  method_id,
  project_id,
  label,
  is_default,
  is_enabled,
  sort_order,
  chain_id,
  chain_asset_id,
  intake_contract_id,
  collection_mode,
  ref_chains!inner(id, display_name, network_key, evm_chain_id, native_asset_symbol, is_active),
  ref_chain_assets!inner(id, symbol, name, token_address, decimals, is_native, is_stablecoin, is_active),
  chain_intake_contracts!inner(id, contract_address, treasury_address, abi_version, is_active)
`

async function getAuthenticatedUserId() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { ok: false as const, error: "User not authenticated", supabase }
  }

  return { ok: true as const, userId: user.id, supabase }
}

async function getProjectAdminContext(projectSlug: string): Promise<ActionResult<ProjectContext>> {
  const auth = await getAuthenticatedUserId()
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const { supabase, userId } = auth
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, name, organization_id, default_payment_method_id")
    .eq("slug", projectSlug)
    .single()

  if (projectError || !project) {
    return { ok: false, error: projectError?.message ?? "Project not found" }
  }

  const [{ data: participant }, { data: adminRoles }] = await Promise.all([
    supabase
      .from("participants")
      .select("id")
      .eq("project_id", project.id)
      .eq("user_id", userId)
      .eq("is_admin", true)
      .maybeSingle(),
    supabase.from("ref_roles").select("id").in("name", ["Founder", "Admin"]),
  ])

  if (participant) {
    return { ok: true, data: { userId, project } }
  }

  const adminRoleIds = adminRoles?.map((role) => role.id) ?? []
  if (project.organization_id && adminRoleIds.length > 0) {
    const { data: orgMembership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", project.organization_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role_id", adminRoleIds)
      .maybeSingle()

    if (orgMembership) {
      return { ok: true, data: { userId, project } }
    }
  }

  return { ok: false, error: "You do not have permission to manage payments for this project" }
}

async function recordActionObservabilityEvent(input: {
  flow: "payment_save" | "receipt_recording" | "admin_confirmation"
  stage: "validation" | "submit" | "submission_record"
  outcome: "attempt" | "success" | "failure"
  attemptId: string
  actorUserId?: string | null
  actorRole?: PaymentFlowActorRole
  projectId?: number | null
  paymentId?: number | null
  submissionId?: number | null
  paymentMethodId?: number | null
  chainId?: number | null
  chainAssetId?: number | null
  intakeContractId?: number | null
  txHash?: string | null
  walletAddress?: string | null
  error?: unknown
  metadata?: Json
}) {
  await recordPaymentFlowEvent({
    flow: input.flow,
    stage: input.stage,
    outcome: input.outcome,
    severity:
      input.outcome === "failure"
        ? input.stage === "validation"
          ? "warning"
          : "error"
        : "info",
    attemptId: input.attemptId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole,
    projectId: input.projectId ?? null,
    paymentId: input.paymentId ?? null,
    submissionId: input.submissionId ?? null,
    paymentMethodId: input.paymentMethodId ?? null,
    chainId: input.chainId ?? null,
    chainAssetId: input.chainAssetId ?? null,
    intakeContractId: input.intakeContractId ?? null,
    txHash: input.txHash ?? null,
    walletAddress: input.walletAddress ?? null,
    environment: resolveDeploymentEnvironment(),
    errorCode: input.error ? normalizePaymentFlowErrorCode(input.stage, input.error) : null,
    errorMessage: input.error ? normalizePaymentFlowErrorMessage(input.error) : null,
    metadata: input.metadata,
  })
}

function mapPaymentSummary(row: InsertedPaymentRow): PaymentRecordSummary {
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.projects?.name ?? "Unknown project",
    project_slug: row.projects?.slug ?? null,
    period_start: row.period_start,
    period_end: row.period_end,
    revenue: row.revenue,
    payment_amount: row.payment_amount,
    payment_percentage: row.payment_percentage,
    payment_method_id: row.payment_method_id,
    payment_method_name: row.ref_payment_methods?.name ?? "Unknown",
    payment_method_code: row.ref_payment_methods?.code ?? "unknown",
    status_id: row.status_id,
    status_name: row.ref_payment_statuses?.name ?? "Unknown",
    status_code: row.ref_payment_statuses?.code ?? "unknown",
    created_at: row.created_at,
    updated_at: row.updated_at,
    paid_at: row.paid_at,
    confirmed_at: row.confirmed_at,
    notes: row.notes,
    latest_onchain_submission: null,
  }
}

function mapManagedCryptoPaymentMethodSummary(row: ManagedCryptoPaymentMethodRow): ManagedCryptoPaymentMethodSummary {
  const deploymentAvailability = getDeploymentAvailabilityForRoute(getWalletRuntimeConfig(), {
    networkKey: row.ref_chains.network_key,
    contractAddress: row.chain_intake_contracts.contract_address,
    treasuryAddress: row.chain_intake_contracts.treasury_address,
    abiVersion: row.chain_intake_contracts.abi_version,
  })

  return {
    id: row.id,
    label: row.label,
    is_default: Boolean(row.is_default),
    is_enabled: row.is_enabled,
    sort_order: row.sort_order,
    is_runtime_available: deploymentAvailability.available,
    runtime_availability_issue: deploymentAvailability.reason,
    chain: {
      id: row.ref_chains.id,
      display_name: row.ref_chains.display_name,
      network_key: row.ref_chains.network_key,
      evm_chain_id: row.ref_chains.evm_chain_id,
      native_asset_symbol: row.ref_chains.native_asset_symbol,
      is_active: row.ref_chains.is_active,
    },
    asset: {
      id: row.ref_chain_assets.id,
      symbol: row.ref_chain_assets.symbol,
      name: row.ref_chain_assets.name,
      token_address: row.ref_chain_assets.token_address,
      decimals: row.ref_chain_assets.decimals,
      is_native: row.ref_chain_assets.is_native,
      is_stablecoin: row.ref_chain_assets.is_stablecoin,
      is_active: row.ref_chain_assets.is_active,
    },
    intakeContract: {
      id: row.chain_intake_contracts.id,
      contract_address: row.chain_intake_contracts.contract_address,
      treasury_address: row.chain_intake_contracts.treasury_address,
      abi_version: row.chain_intake_contracts.abi_version,
      is_active: row.chain_intake_contracts.is_active,
    },
  }
}

function isExecutableManagedCryptoRoute(route: ManagedCryptoPaymentMethodSummary) {
  return route.is_enabled && route.is_runtime_available
}

function getDefaultEligibilityForRoute(route: ManagedCryptoPaymentMethodSummary): DeploymentAvailability {
  if (route.is_runtime_available) {
    return { available: true, reason: null }
  }

  return {
    available: false,
    reason:
      route.runtime_availability_issue ??
      "This crypto route does not match the active wallet deployment and cannot be used as the default route yet.",
  }
}

async function getCryptoContractMethodId() {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase.from("ref_payment_methods").select("id").eq("code", "crypto_contract").single()

  if (error || !data) {
    throw new Error(error?.message ?? "Crypto payment method reference is missing")
  }

  return data.id
}

async function listProjectManagedCryptoPaymentMethodsForProjectId(projectId: number) {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase
    .from("payment_methods")
    .select(MANAGED_CRYPTO_PAYMENT_METHOD_SELECT)
    .eq("project_id", projectId)
    .eq("collection_mode", "contract")
    .not("chain_id", "is", null)
    .not("chain_asset_id", "is", null)
    .not("intake_contract_id", "is", null)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as ManagedCryptoPaymentMethodRow[]).map(mapManagedCryptoPaymentMethodSummary)
}

async function getProjectCryptoRouteStates(projectId: number) {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, is_enabled, is_default, sort_order")
    .eq("project_id", projectId)
    .eq("collection_mode", "contract")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as ProjectCryptoRouteState[]).map((state) => ({
    id: state.id,
    is_enabled: Boolean(state.is_enabled),
    is_default: Boolean(state.is_default),
    sort_order: state.sort_order,
  }))
}

async function validateManagedCryptoRouteReferences(input: {
  chainId: number
  chainAssetId: number
  intakeContractId: number
}) {
  const supabase = getAdminSupabaseClient()
  const [{ data: chain }, { data: asset }, { data: intakeContract }] = await Promise.all([
    supabase.from("ref_chains").select("id, is_active").eq("id", input.chainId).single(),
    supabase.from("ref_chain_assets").select("id, chain_id, is_active").eq("id", input.chainAssetId).single(),
    supabase
      .from("chain_intake_contracts")
      .select("id, chain_id, collection_mode, is_active")
      .eq("id", input.intakeContractId)
      .single(),
  ])

  if (!chain?.is_active) {
    return { ok: false as const, error: "The selected chain is no longer active." }
  }

  if (!asset?.is_active || asset.chain_id !== input.chainId) {
    return { ok: false as const, error: "The selected token is invalid for that chain." }
  }

  if (
    !intakeContract?.is_active ||
    intakeContract.chain_id !== input.chainId ||
    intakeContract.collection_mode !== "contract"
  ) {
    return { ok: false as const, error: "The selected intake contract is invalid for that chain." }
  }

  return { ok: true as const }
}

async function getManagedRouteDeploymentAvailability(input: {
  chainId: number
  intakeContractId: number
}): Promise<DeploymentAvailability> {
  const supabase = getAdminSupabaseClient()
  const [{ data: chain }, { data: intakeContract }] = await Promise.all([
    supabase.from("ref_chains").select("network_key").eq("id", input.chainId).single(),
    supabase
      .from("chain_intake_contracts")
      .select("contract_address, treasury_address, abi_version")
      .eq("id", input.intakeContractId)
      .single(),
  ])

  if (!chain?.network_key || !intakeContract) {
    return {
      available: false,
      reason: "The selected chain deployment metadata is missing from Supabase.",
    }
  }

  return getDeploymentAvailabilityForRoute(getWalletRuntimeConfig(), {
    networkKey: chain.network_key,
    contractAddress: intakeContract.contract_address,
    treasuryAddress: intakeContract.treasury_address,
    abiVersion: intakeContract.abi_version,
  })
}

async function ensureNoDuplicateEnabledCryptoRoute(input: {
  projectId: number
  chainId: number
  chainAssetId: number
  intakeContractId: number
  excludePaymentMethodId?: number
}) {
  const supabase = getAdminSupabaseClient()
  let query = supabase
    .from("payment_methods")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("collection_mode", "contract")
    .eq("is_enabled", true)
    .eq("chain_id", input.chainId)
    .eq("chain_asset_id", input.chainAssetId)
    .eq("intake_contract_id", input.intakeContractId)

  if (input.excludePaymentMethodId) {
    query = query.neq("id", input.excludePaymentMethodId)
  }

  const { data, error } = await query.limit(1)
  if (error) {
    throw new Error(error.message)
  }

  if ((data ?? []).length > 0) {
    return {
      ok: false as const,
      error: "This crypto route is already enabled for the project. Disable the existing one before reusing it.",
    }
  }

  return { ok: true as const }
}

async function syncProjectCryptoContractDefault(project: ProjectContext["project"], cryptoContractMethodId: number) {
  const supabase = getAdminSupabaseClient()
  const { count, error } = await supabase
    .from("payment_methods")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .eq("collection_mode", "contract")
    .eq("is_enabled", true)

  if (error) {
    throw new Error(error.message)
  }

  if ((count ?? 0) > 0) {
    const { error: updateError } = await supabase
      .from("projects")
      .update({ default_payment_method_id: cryptoContractMethodId })
      .eq("id", project.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return
  }

  if (project.default_payment_method_id === cryptoContractMethodId) {
    const { error: clearError } = await supabase
      .from("projects")
      .update({ default_payment_method_id: null })
      .eq("id", project.id)

    if (clearError) {
      throw new Error(clearError.message)
    }
  }
}

async function applyProjectCryptoRouteStates(projectId: number, states: ProjectCryptoRouteState[]) {
  const supabase = getAdminSupabaseClient()
  const normalizedStates = renumberProjectCryptoRouteStates(states)

  for (const state of normalizedStates) {
    const { error } = await supabase
      .from("payment_methods")
      .update({
        is_enabled: state.is_enabled,
        is_default: Boolean(state.is_default),
        sort_order: state.sort_order,
      })
      .eq("id", state.id)
      .eq("project_id", projectId)

    if (error) {
      throw new Error(error.message)
    }
  }
}

function normalizeManagedRouteLabel(label: string) {
  const next = label.trim()
  return next.length > 0 ? next : null
}

function appendPaymentNote(existingNote: string | null | undefined, nextNote: string) {
  if (!existingNote?.trim()) {
    return nextNote
  }

  return `${existingNote}\n${nextNote}`
}

async function refreshProjectManagedRoutes(project: ProjectContext["project"]) {
  const routes = await listProjectManagedCryptoPaymentMethodsForProjectId(project.id)
  revalidatePath(`/projects/${project.slug}/payments`)
  return routes
}

export async function listProjectManagedCryptoPaymentMethods(
  projectSlug: string,
): Promise<ActionResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await getProjectAdminContext(projectSlug)
  if (!context.ok) {
    return context
  }

  try {
    return {
      ok: true,
      data: await listProjectManagedCryptoPaymentMethodsForProjectId(context.data.project.id),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not load crypto payment routes.",
    }
  }
}

export async function listProjectCryptoPaymentMethods(
  projectSlug: string,
): Promise<ActionResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await getProjectAdminContext(projectSlug)
  if (!context.ok) {
    return context
  }

  try {
    const routes = await listProjectManagedCryptoPaymentMethodsForProjectId(context.data.project.id)
    return {
      ok: true,
      data: routes.filter(isExecutableManagedCryptoRoute),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not load active crypto payment routes.",
    }
  }
}

export async function listProjectLatestOnchainSubmissions(
  projectSlug: string,
): Promise<ActionResult<OnchainSubmissionSummary[]>> {
  const context = await getProjectAdminContext(projectSlug)
  if (!context.ok) {
    return context
  }

  try {
    return {
      ok: true,
      data: await listProjectOnchainSubmissionSummaries(context.data.project.id),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not load onchain submission status.",
    }
  }
}

export async function createProjectCryptoPaymentMethod(
  input: CreateProjectCryptoPaymentMethodInput,
): Promise<ActionResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await getProjectAdminContext(input.projectSlug)
  if (!context.ok) {
    return context
  }

  const referenceValidation = await validateManagedCryptoRouteReferences(input)
  if (!referenceValidation.ok) {
    return referenceValidation
  }

  try {
    const cryptoContractMethodId = await getCryptoContractMethodId()
    const duplicateValidation = await ensureNoDuplicateEnabledCryptoRoute({
      projectId: context.data.project.id,
      chainId: input.chainId,
      chainAssetId: input.chainAssetId,
      intakeContractId: input.intakeContractId,
    })

    if (!duplicateValidation.ok) {
      return duplicateValidation
    }

    const currentStates = await getProjectCryptoRouteStates(context.data.project.id)
    const shouldDefault = input.isDefault || currentStates.filter((route) => route.is_enabled).length === 0
    const runtimeAvailability = await getManagedRouteDeploymentAvailability({
      chainId: input.chainId,
      intakeContractId: input.intakeContractId,
    })

    if (shouldDefault && !runtimeAvailability.available) {
      return {
        ok: false,
        error:
          runtimeAvailability.reason ??
          "Sync the deployment manifest into Supabase before making this route the default payment route.",
      }
    }

    const supabase = getAdminSupabaseClient()

    if (shouldDefault) {
      const { error: clearDefaultError } = await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("project_id", context.data.project.id)
        .eq("collection_mode", "contract")

      if (clearDefaultError) {
        return { ok: false, error: clearDefaultError.message }
      }
    }

    const { error: insertError } = await supabase.from("payment_methods").insert({
      project_id: context.data.project.id,
      method_id: cryptoContractMethodId,
      collection_mode: "contract",
      chain_id: input.chainId,
      chain_asset_id: input.chainAssetId,
      intake_contract_id: input.intakeContractId,
      is_default: shouldDefault,
      is_enabled: true,
      label: normalizeManagedRouteLabel(input.label),
      sort_order: currentStates.length + 1,
      details: {
        manager_source: "project_payments_v2",
        preferred_chain_asset_id: input.chainAssetId,
      },
    })

    if (insertError) {
      return { ok: false, error: insertError.message }
    }

    await syncProjectCryptoContractDefault(context.data.project, cryptoContractMethodId)

    return {
      ok: true,
      data: await refreshProjectManagedRoutes(context.data.project),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not add the crypto route.",
    }
  }
}

export async function updateProjectCryptoPaymentMethod(
  input: UpdateProjectCryptoPaymentMethodInput,
): Promise<ActionResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await getProjectAdminContext(input.projectSlug)
  if (!context.ok) {
    return context
  }

  const referenceValidation = await validateManagedCryptoRouteReferences(input)
  if (!referenceValidation.ok) {
    return referenceValidation
  }

  try {
    const supabase = getAdminSupabaseClient()
    const { data: route, error: routeError } = await supabase
      .from("payment_methods")
      .select(
        "id, project_id, method_id, chain_id, chain_asset_id, intake_contract_id, is_default, is_enabled, sort_order, collection_mode",
      )
      .eq("id", input.paymentMethodId)
      .eq("project_id", context.data.project.id)
      .single()

    if (routeError || !route || route.collection_mode !== "contract") {
      return { ok: false, error: routeError?.message ?? "Crypto route not found." }
    }

    if (!route.is_enabled && input.isDefault) {
      return { ok: false, error: "Disabled routes cannot be marked as default." }
    }

    if (route.is_enabled) {
      const duplicateValidation = await ensureNoDuplicateEnabledCryptoRoute({
        projectId: context.data.project.id,
        chainId: input.chainId,
        chainAssetId: input.chainAssetId,
        intakeContractId: input.intakeContractId,
        excludePaymentMethodId: route.id,
      })

      if (!duplicateValidation.ok) {
        return duplicateValidation
      }
    }

    const runtimeEligibility = await getManagedRouteDeploymentAvailability({
      chainId: input.chainId,
      intakeContractId: input.intakeContractId,
    })

    if (input.isDefault && !runtimeEligibility.available) {
      return {
        ok: false,
        error:
          runtimeEligibility.reason ??
          "Sync the deployment manifest into Supabase before making this route the default payment route.",
      }
    }

    if (input.isDefault) {
      const { error: clearDefaultError } = await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("project_id", context.data.project.id)
        .eq("collection_mode", "contract")

      if (clearDefaultError) {
        return { ok: false, error: clearDefaultError.message }
      }
    }

    const { error: updateError } = await supabase
      .from("payment_methods")
      .update({
        chain_id: input.chainId,
        chain_asset_id: input.chainAssetId,
        intake_contract_id: input.intakeContractId,
        label: normalizeManagedRouteLabel(input.label),
        is_default: input.isDefault,
      })
      .eq("id", route.id)
      .eq("project_id", context.data.project.id)

    if (updateError) {
      return { ok: false, error: updateError.message }
    }

    const cryptoContractMethodId = await getCryptoContractMethodId()
    await syncProjectCryptoContractDefault(context.data.project, cryptoContractMethodId)

    return {
      ok: true,
      data: await refreshProjectManagedRoutes(context.data.project),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update the crypto route.",
    }
  }
}

export async function moveProjectCryptoPaymentMethod(
  input: MoveProjectCryptoPaymentMethodInput,
): Promise<ActionResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await getProjectAdminContext(input.projectSlug)
  if (!context.ok) {
    return context
  }

  try {
    const currentStates = await getProjectCryptoRouteStates(context.data.project.id)
    if (!currentStates.some((route) => route.id === input.paymentMethodId)) {
      return { ok: false, error: "Crypto route not found." }
    }

    const nextStates = moveProjectCryptoRouteState(currentStates, input.paymentMethodId, input.direction)
    await applyProjectCryptoRouteStates(context.data.project.id, nextStates)

    return {
      ok: true,
      data: await refreshProjectManagedRoutes(context.data.project),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not reorder the crypto route.",
    }
  }
}

export async function toggleProjectCryptoPaymentMethodEnabled(
  input: ToggleProjectCryptoPaymentMethodEnabledInput,
): Promise<ActionResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await getProjectAdminContext(input.projectSlug)
  if (!context.ok) {
    return context
  }

  try {
    const supabase = getAdminSupabaseClient()
    const { data: route, error: routeError } = await supabase
      .from("payment_methods")
      .select(
        "id, project_id, method_id, chain_id, chain_asset_id, intake_contract_id, is_default, is_enabled, sort_order, collection_mode",
      )
      .eq("id", input.paymentMethodId)
      .eq("project_id", context.data.project.id)
      .single()

    if (routeError || !route || route.collection_mode !== "contract") {
      return { ok: false, error: routeError?.message ?? "Crypto route not found." }
    }

    if (route.is_enabled === input.enabled) {
      return {
        ok: true,
        data: await refreshProjectManagedRoutes(context.data.project),
      }
    }

    const currentStates = await getProjectCryptoRouteStates(context.data.project.id)
    const nextStates = currentStates.map((state) => ({ ...state }))
    const targetRoute = nextStates.find((state) => state.id === route.id)

    if (!targetRoute) {
      return { ok: false, error: "Crypto route not found." }
    }

    if (input.enabled) {
      const referenceValidation = await validateManagedCryptoRouteReferences({
        chainId: route.chain_id ?? 0,
        chainAssetId: route.chain_asset_id ?? 0,
        intakeContractId: route.intake_contract_id ?? 0,
      })

      if (!referenceValidation.ok) {
        return referenceValidation
      }

      const duplicateValidation = await ensureNoDuplicateEnabledCryptoRoute({
        projectId: context.data.project.id,
        chainId: route.chain_id ?? 0,
        chainAssetId: route.chain_asset_id ?? 0,
        intakeContractId: route.intake_contract_id ?? 0,
        excludePaymentMethodId: route.id,
      })

      if (!duplicateValidation.ok) {
        return duplicateValidation
      }

      targetRoute.is_enabled = true

      const routes = await listProjectManagedCryptoPaymentMethodsForProjectId(context.data.project.id)
      const managedRoute = routes.find((managed) => managed.id === route.id)
      if (managedRoute && managedRoute.is_default && !managedRoute.is_runtime_available) {
        return {
          ok: false,
          error:
            managedRoute.runtime_availability_issue ??
            "Sync the deployment manifest into Supabase before re-enabling this route as the default.",
        }
      }
    } else {
      const disabledRouteWasDefault = Boolean(targetRoute.is_default)
      targetRoute.is_enabled = false
      targetRoute.is_default = false

      if (disabledRouteWasDefault) {
        const promotedDefaultId = getPromotedDefaultRouteId(nextStates, route.id)
        if (promotedDefaultId !== null) {
          const promotedRoute = nextStates.find((state) => state.id === promotedDefaultId)
          if (promotedRoute) {
            promotedRoute.is_default = true
          }
        }
      }
    }

    await applyProjectCryptoRouteStates(context.data.project.id, nextStates)

    const cryptoContractMethodId = await getCryptoContractMethodId()
    await syncProjectCryptoContractDefault(context.data.project, cryptoContractMethodId)

    return {
      ok: true,
      data: await refreshProjectManagedRoutes(context.data.project),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update the route state.",
    }
  }
}

export async function createProjectPaymentDrafts(
  input: CreateProjectPaymentDraftsInput,
): Promise<ActionResult<PaymentRecordSummary[]>> {
  const attemptId = getObservabilityAttemptId(input.attemptId)
  const auth = await getAuthenticatedUserId()
  const context = await getProjectAdminContext(input.projectSlug)
  if (!context.ok) {
    await recordActionObservabilityEvent({
      flow: "payment_save",
      stage: "submit",
      outcome: "failure",
      attemptId,
      actorUserId: auth.ok ? auth.userId : null,
      actorRole: auth.ok ? "authenticated_user" : "unauthenticated",
      error: context.error,
      metadata: {
        projectSlug: input.projectSlug,
        paymentCount: input.payments.length,
      },
    })
    return context
  }

  await recordActionObservabilityEvent({
    flow: "payment_save",
    stage: "submit",
    outcome: "attempt",
    attemptId,
    actorUserId: context.data.userId,
    actorRole: "project_admin",
    projectId: context.data.project.id,
    metadata: {
      paymentCount: input.payments.length,
    },
  })

  const validation = validateProjectPaymentDrafts(input.payments)
  if (!validation.ok) {
    await recordActionObservabilityEvent({
      flow: "payment_save",
      stage: "validation",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      error: validation.error,
      metadata: {
        paymentCount: input.payments.length,
      },
    })
    return validation
  }

  const supabase = getAdminSupabaseClient()
  const [{ data: draftStatus }, { data: methods, error: methodsError }] = await Promise.all([
    supabase.from("ref_payment_statuses").select("id").eq("code", "draft").single(),
    supabase
      .from("ref_payment_methods")
      .select("id")
      .in(
        "id",
        validation.data.map((row) => row.payment_method_id),
      ),
  ])

  if (!draftStatus?.id) {
    await recordActionObservabilityEvent({
      flow: "payment_save",
      stage: "submit",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      error: "The draft payment status is not configured.",
      metadata: {
        paymentCount: input.payments.length,
      },
    })
    return { ok: false, error: "The draft payment status is not configured." }
  }

  if (methodsError) {
    await recordActionObservabilityEvent({
      flow: "payment_save",
      stage: "submit",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      error: methodsError.message,
      metadata: {
        paymentCount: input.payments.length,
      },
    })
    return { ok: false, error: methodsError.message }
  }

  const validMethodIds = new Set((methods as PaymentMethodReferenceRow[] | null)?.map((method) => method.id) ?? [])
  const invalidRow = validation.data.find((row) => !validMethodIds.has(row.payment_method_id))
  if (invalidRow) {
    await recordActionObservabilityEvent({
      flow: "payment_save",
      stage: "validation",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      error: "One or more selected payment methods are no longer available.",
      metadata: {
        paymentCount: input.payments.length,
        paymentMethodId: invalidRow.payment_method_id,
      },
    })
    return { ok: false, error: "One or more selected payment methods are no longer available." }
  }

  const { data, error } = await supabase
    .from("payments")
    .insert(
      validation.data.map((row) => ({
        project_id: context.data.project.id,
        period_start: row.period_start,
        period_end: row.period_end,
        revenue: row.revenue,
        payment_amount: row.payment_amount,
        payment_percentage: row.payment_percentage,
        payment_method_id: row.payment_method_id,
        status_id: draftStatus.id,
      })),
    )
    .select(`
      id,
      project_id,
      period_start,
      period_end,
      revenue,
      payment_amount,
      payment_percentage,
      payment_method_id,
      status_id,
      notes,
      created_at,
      updated_at,
      paid_at,
      confirmed_at,
      projects(name, slug),
      ref_payment_methods(name, code),
      ref_payment_statuses(name, code)
    `)
    .order("period_start", { ascending: false })

  if (error) {
    await recordActionObservabilityEvent({
      flow: "payment_save",
      stage: "submit",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      error: error.message,
      metadata: {
        paymentCount: input.payments.length,
      },
    })
    return { ok: false, error: error.message }
  }

  revalidatePath(`/projects/${input.projectSlug}/payments`)

  await recordActionObservabilityEvent({
    flow: "payment_save",
    stage: "submit",
    outcome: "success",
    attemptId,
    actorUserId: context.data.userId,
    actorRole: "project_admin",
    projectId: context.data.project.id,
    metadata: {
      paymentCount: (data ?? []).length,
    },
  })

  return {
    ok: true,
    data: ((data ?? []) as InsertedPaymentRow[]).map(mapPaymentSummary),
  }
}

export async function recordOnchainPaymentSubmission(
  input: RecordOnchainPaymentInput,
): Promise<ActionResult<{ submissionId: number }>> {
  const attemptId = getObservabilityAttemptId(input.attemptId)
  const auth = await getAuthenticatedUserId()
  const context = await getProjectAdminContext(input.projectSlug)
  if (!context.ok) {
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: auth.ok ? auth.userId : null,
      actorRole: auth.ok ? "authenticated_user" : "unauthenticated",
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      chainId: input.chainId,
      chainAssetId: input.chainAssetId,
      intakeContractId: input.intakeContractId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: context.error,
      metadata: {
        projectSlug: input.projectSlug,
      },
    })
    return context
  }

  await recordActionObservabilityEvent({
    flow: "receipt_recording",
    stage: "submission_record",
    outcome: "attempt",
    attemptId,
    actorUserId: context.data.userId,
    actorRole: "project_admin",
    projectId: context.data.project.id,
    paymentId: input.paymentId,
    paymentMethodId: input.paymentMethodId,
    chainId: input.chainId,
    chainAssetId: input.chainAssetId,
    intakeContractId: input.intakeContractId,
    txHash: input.txHash,
    walletAddress: input.walletAddress,
    metadata: {
      periodId: input.periodId,
    },
  })

  const supabase = getAdminSupabaseClient()

  const [{ data: payment }, { data: paymentMethod }, { data: awaitingStatus }, { data: unresolvedSubmission }] =
    await Promise.all([
      supabase.from("payments").select("id, project_id, notes").eq("id", input.paymentId).single(),
      supabase
        .from("payment_methods")
        .select(`
          id,
          method_id,
          project_id,
          chain_id,
          chain_asset_id,
          intake_contract_id,
          ref_chains!inner(network_key),
          chain_intake_contracts!inner(contract_address, treasury_address, abi_version),
          ref_chain_assets!inner(token_address, is_native)
        `)
        .eq("id", input.paymentMethodId)
        .single(),
      supabase.from("ref_payment_statuses").select("id").eq("code", "awaiting_confirmation").single(),
      supabase
        .from("onchain_payment_submissions")
        .select("id")
        .eq("payment_id", input.paymentId)
        .in("status", ["submitted", "confirming"])
        .maybeSingle(),
    ])

  if (!payment || payment.project_id !== context.data.project.id) {
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      error: "Payment record does not belong to this project",
      metadata: {
        requestedProjectSlug: input.projectSlug,
      },
    })
    return { ok: false, error: "Payment record does not belong to this project" }
  }

  const paymentMethodSnapshot = paymentMethod as RecordOnchainPaymentRouteSnapshot | null

  if (
    !paymentMethodSnapshot ||
    paymentMethodSnapshot.project_id !== context.data.project.id ||
    paymentMethodSnapshot.chain_id !== input.chainId ||
    paymentMethodSnapshot.chain_asset_id !== input.chainAssetId ||
    paymentMethodSnapshot.intake_contract_id !== input.intakeContractId
  ) {
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      chainId: input.chainId,
      chainAssetId: input.chainAssetId,
      intakeContractId: input.intakeContractId,
      error: "Selected crypto route is invalid for this project",
    })
    return { ok: false, error: "Selected crypto route is invalid for this project" }
  }

  if (unresolvedSubmission?.id) {
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      submissionId: unresolvedSubmission.id,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: "This payment already has an unresolved onchain submission. Wait for reconciliation or a failed result before retrying.",
    })
    return {
      ok: false,
      error: "This payment already has an unresolved onchain submission. Wait for reconciliation or a failed result before retrying.",
    }
  }

  const executableRoutes = await listProjectManagedCryptoPaymentMethodsForProjectId(context.data.project.id)
  const selectedRoute = executableRoutes.find((route) => route.id === input.paymentMethodId)
  if (!selectedRoute?.is_runtime_available) {
    const routeError =
      selectedRoute?.runtime_availability_issue ??
      "This crypto route is not available in the active wallet deployment for this environment."
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: routeError,
    })
    return {
      ok: false,
      error: routeError,
    }
  }

  if (!awaitingStatus?.id) {
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      error: "The awaiting_confirmation payment status is not configured",
    })
    return { ok: false, error: "The awaiting_confirmation payment status is not configured" }
  }

  const amountDecimal = Number.parseFloat(input.amountDecimal)
  if (!Number.isFinite(amountDecimal) || amountDecimal <= 0) {
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: "Payment amount is invalid",
    })
    return { ok: false, error: "Payment amount is invalid" }
  }

  if (!Number.isInteger(input.periodId) || input.periodId < 0 || input.periodId > 12) {
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      error: "The selected period tag is invalid",
      metadata: {
        periodId: input.periodId,
      },
    })
    return { ok: false, error: "The selected period tag is invalid" }
  }

  const { data: submission, error: submissionError } = await supabase
    .from("onchain_payment_submissions")
    .insert({
      payment_id: input.paymentId,
      project_id: context.data.project.id,
      payment_method_id: input.paymentMethodId,
      chain_id: input.chainId,
      chain_asset_id: input.chainAssetId,
      intake_contract_id: input.intakeContractId,
      chain_network_key: paymentMethodSnapshot.ref_chains.network_key,
      intake_contract_address: paymentMethodSnapshot.chain_intake_contracts.contract_address,
      intake_treasury_address: paymentMethodSnapshot.chain_intake_contracts.treasury_address,
      intake_abi_version: paymentMethodSnapshot.chain_intake_contracts.abi_version,
      asset_token_address: paymentMethodSnapshot.ref_chain_assets.token_address,
      asset_is_native: paymentMethodSnapshot.ref_chain_assets.is_native,
      wallet_address: input.walletAddress,
      tx_hash: input.txHash,
      amount_raw: input.amountRaw,
      amount_decimal: amountDecimal,
      period_id: input.periodId,
      status: "submitted",
      block_number: input.blockNumber ?? null,
      receipt: input.receipt,
      metadata: {
        source: "project_payments_page",
        period_id: input.periodId,
      },
    })
    .select("id")
    .single()

  if (submissionError || !submission) {
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: submissionError?.message ?? "Could not store the onchain payment submission",
    })
    return { ok: false, error: submissionError?.message ?? "Could not store the onchain payment submission" }
  }

  const { error: paymentUpdateError } = await supabase
    .from("payments")
    .update({
      status_id: awaitingStatus.id,
      payment_method_id: paymentMethodSnapshot.method_id ?? null,
      paid_at: new Date().toISOString(),
      notes: appendPaymentNote(
        payment.notes,
        `Onchain payment submitted: ${input.txHash} (period tag: ${input.periodId === 0 ? "current" : input.periodId})`,
      ),
    })
    .eq("id", input.paymentId)

  if (paymentUpdateError) {
    await recordActionObservabilityEvent({
      flow: "receipt_recording",
      stage: "submission_record",
      outcome: "failure",
      attemptId,
      actorUserId: context.data.userId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      submissionId: submission.id,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: paymentUpdateError.message,
    })
    return { ok: false, error: paymentUpdateError.message }
  }

  revalidatePath(`/projects/${input.projectSlug}/payments`)
  revalidatePath("/admin/payments")

  await recordActionObservabilityEvent({
    flow: "receipt_recording",
    stage: "submission_record",
    outcome: "success",
    attemptId,
    actorUserId: context.data.userId,
    actorRole: "project_admin",
    projectId: context.data.project.id,
    paymentId: input.paymentId,
    paymentMethodId: input.paymentMethodId,
    submissionId: submission.id,
    chainId: input.chainId,
    chainAssetId: input.chainAssetId,
    intakeContractId: input.intakeContractId,
    txHash: input.txHash,
    walletAddress: input.walletAddress,
    metadata: {
      periodId: input.periodId,
      amountRaw: input.amountRaw,
    },
  })

  return { ok: true, data: { submissionId: submission.id } }
}

export async function runInternalOnchainPaymentReconciliation(input?: {
  limit?: number
  paymentId?: number
  submissionId?: number
}): Promise<ActionResult<OnchainReconciliationRunSummary>> {
  try {
    await requireInternalAdminActor()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "You do not have internal admin access.",
    }
  }

  try {
    const summary = await runOnchainPaymentReconciliation({
      source: "admin_manual",
      limit: input?.limit,
      paymentId: input?.paymentId,
      submissionId: input?.submissionId,
    })

    revalidatePath("/admin/payments")
    revalidatePath("/admin/payments/reconciliation")

    for (const projectSlug of summary.touchedProjectSlugs) {
      revalidatePath(`/projects/${projectSlug}/payments`)
    }

    return {
      ok: true,
      data: summary,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not run onchain payment reconciliation.",
    }
  }
}

export async function confirmInternalPaymentReceipt(
  paymentId: number,
  attemptId?: string,
): Promise<ActionResult<{ paymentId: number; statusCode: string; confirmedAt: string }>> {
  const resolvedAttemptId = getObservabilityAttemptId(attemptId)
  try {
    await requireInternalAdminActor()
  } catch (error) {
    await recordActionObservabilityEvent({
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: resolvedAttemptId,
      actorRole: "unauthenticated",
      paymentId,
      error,
    })
    return {
      ok: false,
      error: error instanceof Error ? error.message : "You do not have internal admin access.",
    }
  }

  await recordActionObservabilityEvent({
    flow: "admin_confirmation",
    stage: "submit",
    outcome: "attempt",
    attemptId: resolvedAttemptId,
    actorRole: "internal_admin",
    paymentId,
  })

  const supabase = getAdminSupabaseClient()
  const [{ data: payment }, { data: confirmedStatus }, { data: onchainSubmission }] = await Promise.all([
    supabase.from("payments").select("id, project_id, projects(slug)").eq("id", paymentId).single(),
    supabase.from("ref_payment_statuses").select("id, code").eq("code", "confirmed").single(),
    supabase.from("onchain_payment_submissions").select("id").eq("payment_id", paymentId).limit(1).maybeSingle(),
  ])

  if (!payment) {
    await recordActionObservabilityEvent({
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: resolvedAttemptId,
      actorRole: "internal_admin",
      paymentId,
      error: "Payment not found.",
    })
    return { ok: false, error: "Payment not found." }
  }

  if (onchainSubmission?.id) {
    await recordActionObservabilityEvent({
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: resolvedAttemptId,
      actorRole: "internal_admin",
      projectId: payment.project_id,
      paymentId,
      submissionId: onchainSubmission.id,
      error: "Crypto-submitted payments must be advanced by onchain reconciliation instead of manual confirmation.",
    })
    return {
      ok: false,
      error: "Crypto-submitted payments must be advanced by onchain reconciliation instead of manual confirmation.",
    }
  }

  if (!confirmedStatus?.id) {
    await recordActionObservabilityEvent({
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: resolvedAttemptId,
      actorRole: "internal_admin",
      projectId: payment.project_id,
      paymentId,
      error: "The confirmed payment status is not configured.",
    })
    return { ok: false, error: "The confirmed payment status is not configured." }
  }

  const confirmedAt = new Date().toISOString()

  const { error: paymentError } = await supabase
    .from("payments")
    .update({
      status_id: confirmedStatus.id,
      confirmed_at: confirmedAt,
      updated_at: confirmedAt,
    })
    .eq("id", paymentId)

  if (paymentError) {
    await recordActionObservabilityEvent({
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: resolvedAttemptId,
      actorRole: "internal_admin",
      projectId: payment.project_id,
      paymentId,
      error: paymentError.message,
    })
    return { ok: false, error: paymentError.message }
  }

  const { error: submissionError } = await supabase
    .from("onchain_payment_submissions")
    .update({
      status: "confirmed",
      confirmed_at: confirmedAt,
    })
    .eq("payment_id", paymentId)

  if (submissionError) {
    await recordActionObservabilityEvent({
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: resolvedAttemptId,
      actorRole: "internal_admin",
      projectId: payment.project_id,
      paymentId,
      error: submissionError.message,
    })
    return { ok: false, error: submissionError.message }
  }

  revalidatePath("/admin/payments")
  const projectSlug = payment.projects && !Array.isArray(payment.projects) ? payment.projects.slug : null
  if (projectSlug) {
    revalidatePath(`/projects/${projectSlug}/payments`)
  }

  await recordActionObservabilityEvent({
    flow: "admin_confirmation",
    stage: "submit",
    outcome: "success",
    attemptId: resolvedAttemptId,
    actorRole: "internal_admin",
    projectId: payment.project_id,
    paymentId,
    metadata: {
      confirmedAt,
    },
  })

  return {
    ok: true,
    data: {
      paymentId,
      statusCode: confirmedStatus.code,
      confirmedAt,
    },
  }
}
