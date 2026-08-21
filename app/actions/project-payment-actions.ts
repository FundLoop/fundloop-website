"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  invokeAdminOnchainPaymentReconciliationRunServer,
  invokeAdminPaymentReceiptConfirmServer,
} from "@/lib/edge-functions/admin-payment-operations-server"
import { invokeProjectPaymentDraftsCreateServer } from "@/lib/edge-functions/project-payment-drafts-create-server"
import {
  invokeProjectCryptoRouteCreateServer,
  invokeProjectCryptoRouteEnabledSetServer,
  invokeProjectCryptoRouteMoveServer,
  invokeProjectCryptoRouteUpdateServer,
  invokeProjectOnchainPaymentSubmissionRecordServer,
} from "@/lib/edge-functions/project-payment-operations-server"
import {
  getPromotedDefaultRouteId,
  moveProjectCryptoRouteState,
  renumberProjectCryptoRouteStates,
  type RouteMoveDirection,
  type ProjectCryptoRouteState,
} from "@/lib/project-crypto-routes"
import {
  getDeploymentAvailabilityForRoute,
  getWalletRuntimeConfig,
  type DeploymentAvailability,
} from "@/lib/onchain/runtime-config"
import { listProjectOnchainSubmissionSummaries, type OnchainReconciliationRunSummary } from "@/lib/onchain/payment-reconciliation"
import type { OnchainSubmissionSummary } from "@/lib/onchain/payment-submissions"
import type { PaymentRecordSummary } from "@/lib/payments/payment-record-summary"
import type { Json, Tables } from "@/types/supabase"
import type { ProjectPaymentDraftsCreateInput } from "@/lib/edge-functions/project-payment-drafts-create-contract"

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }
export type { PaymentRecordSummary } from "@/lib/payments/payment-record-summary"

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

type CreateProjectPaymentDraftsInput = ProjectPaymentDraftsCreateInput

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
  const result = await invokeProjectCryptoRouteCreateServer(input)
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  revalidatePath(`/projects/${input.projectSlug}/payments`)
  return { ok: true, data: result.data }
}

export async function updateProjectCryptoPaymentMethod(
  input: UpdateProjectCryptoPaymentMethodInput,
): Promise<ActionResult<ManagedCryptoPaymentMethodSummary[]>> {
  const result = await invokeProjectCryptoRouteUpdateServer(input)
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  revalidatePath(`/projects/${input.projectSlug}/payments`)
  return { ok: true, data: result.data }
}

export async function moveProjectCryptoPaymentMethod(
  input: MoveProjectCryptoPaymentMethodInput,
): Promise<ActionResult<ManagedCryptoPaymentMethodSummary[]>> {
  const result = await invokeProjectCryptoRouteMoveServer(input)
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  revalidatePath(`/projects/${input.projectSlug}/payments`)
  return { ok: true, data: result.data }
}

export async function toggleProjectCryptoPaymentMethodEnabled(
  input: ToggleProjectCryptoPaymentMethodEnabledInput,
): Promise<ActionResult<ManagedCryptoPaymentMethodSummary[]>> {
  const result = await invokeProjectCryptoRouteEnabledSetServer(input)
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  revalidatePath(`/projects/${input.projectSlug}/payments`)
  return { ok: true, data: result.data }
}

export async function createProjectPaymentDrafts(
  input: CreateProjectPaymentDraftsInput,
): Promise<ActionResult<PaymentRecordSummary[]>> {
  const result = await invokeProjectPaymentDraftsCreateServer(input)
  if (!result.ok) {
    return {
      ok: false,
      error: result.error.message,
    }
  }

  revalidatePath(`/projects/${input.projectSlug}/payments`)

  return {
    ok: true,
    data: result.data,
  }
}

export async function recordOnchainPaymentSubmission(
  input: RecordOnchainPaymentInput,
): Promise<ActionResult<{ submissionId: number }>> {
  const result = await invokeProjectOnchainPaymentSubmissionRecordServer(input)
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  revalidatePath(`/projects/${input.projectSlug}/payments`)
  revalidatePath("/admin/payments")
  return { ok: true, data: result.data }
}

export async function runInternalOnchainPaymentReconciliation(input?: {
  limit?: number
  paymentId?: number
  submissionId?: number
}): Promise<ActionResult<OnchainReconciliationRunSummary>> {
  const result = await invokeAdminOnchainPaymentReconciliationRunServer({
    limit: input?.limit,
    paymentId: input?.paymentId,
    submissionId: input?.submissionId,
  })
  if (!result.ok) {
    return {
      ok: false,
      error: result.error.message,
    }
  }

  revalidatePath("/admin/payments")
  revalidatePath("/admin/payments/reconciliation")

  for (const projectSlug of result.data.touchedProjectSlugs) {
    revalidatePath(`/projects/${projectSlug}/payments`)
  }

  return {
    ok: true,
    data: result.data,
  }
}

export async function confirmInternalPaymentReceipt(
  paymentId: number,
  attemptId?: string,
): Promise<ActionResult<{ paymentId: number; statusCode: string; confirmedAt: string }>> {
  const result = await invokeAdminPaymentReceiptConfirmServer({
    paymentId,
    attemptId: getObservabilityAttemptId(attemptId),
  })
  if (!result.ok) {
    return {
      ok: false,
      error: result.error.message,
    }
  }

  revalidatePath("/admin/payments")
  revalidatePath("/admin/payments/reconciliation")

  const payment = result.data
  const adminSupabase = getAdminSupabaseClient()
  const { data: paymentRow } = await adminSupabase
    .from("payments")
    .select("projects(slug)")
    .eq("id", paymentId)
    .maybeSingle()
  const projectSlug = paymentRow?.projects && !Array.isArray(paymentRow.projects) ? paymentRow.projects.slug : null
  if (projectSlug) {
    revalidatePath(`/projects/${projectSlug}/payments`)
  }

  return {
    ok: true,
    data: payment,
  }
}
