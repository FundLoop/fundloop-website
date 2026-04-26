import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json, Tables } from "../../types/supabase.ts"
import {
  getPromotedDefaultRouteId,
  moveProjectCryptoRouteState,
  renumberProjectCryptoRouteStates,
  type ProjectCryptoRouteState,
  type RouteMoveDirection,
} from "../project-crypto-routes.ts"

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

type ProjectContext = {
  actorUserId: string
  project: Pick<Tables<"projects">, "id" | "slug" | "name" | "organization_id" | "default_payment_method_id">
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

export type ProjectCryptoRouteCreateInput = {
  actorUserId: string
  projectSlug: string
  chainId: number
  chainAssetId: number
  intakeContractId: number
  label: string
  isDefault?: boolean
}

export type ProjectCryptoRouteUpdateInput = {
  actorUserId: string
  projectSlug: string
  paymentMethodId: number
  chainId: number
  chainAssetId: number
  intakeContractId: number
  label: string
  isDefault: boolean
}

export type ProjectCryptoRouteMoveInput = {
  actorUserId: string
  projectSlug: string
  paymentMethodId: number
  direction: RouteMoveDirection
}

export type ProjectCryptoRouteEnabledSetInput = {
  actorUserId: string
  projectSlug: string
  paymentMethodId: number
  enabled: boolean
}

export type ProjectOnchainPaymentSubmissionRecordInput = {
  actorUserId: string
  projectSlug: string
  attemptId: string
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

export type PaymentOperationsCommandError = {
  code: string
  message: string
  projectId: number | null
  paymentId: number | null
  paymentMethodId: number | null
  submissionId: number | null
}

export type PaymentOperationsCommandResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: PaymentOperationsCommandError
    }

export type DeploymentAvailability = {
  available: boolean
  reason: string | null
}

export type RuntimeAvailabilityResolver = (input: {
  networkKey: string
  contractAddress: string
  treasuryAddress: string
  abiVersion: string
}) => DeploymentAvailability

export type PaymentOperationsCommandDeps = {
  getDeploymentAvailabilityForRoute: RuntimeAvailabilityResolver
  environment: "local" | "preview" | "production"
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

function commandFailure(
  code: string,
  message: string,
  options?: {
    projectId?: number | null
    paymentId?: number | null
    paymentMethodId?: number | null
    submissionId?: number | null
  },
): Extract<PaymentOperationsCommandResult<never>, { ok: false }> {
  return {
    ok: false,
    error: {
      code,
      message,
      projectId: options?.projectId ?? null,
      paymentId: options?.paymentId ?? null,
      paymentMethodId: options?.paymentMethodId ?? null,
      submissionId: options?.submissionId ?? null,
    },
  }
}

function normalizePaymentFlowErrorCode(stage: string, error: unknown) {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : ""
  const normalized = message.trim().toLowerCase()

  if (!normalized) {
    return `${stage}_failed`
  }

  if (normalized.includes("not authenticated")) {
    return "not_authenticated"
  }

  if (normalized.includes("do not have") || normalized.includes("permission")) {
    return "forbidden"
  }

  if (normalized.includes("route is not available") || normalized.includes("route unavailable")) {
    return "route_unavailable"
  }

  if (normalized.includes("unresolved onchain submission")) {
    return "submission_unresolved"
  }

  if (normalized.includes("status is not configured")) {
    return "status_not_configured"
  }

  if (normalized.includes("payment not found")) {
    return "payment_not_found"
  }

  if (normalized.includes("transaction")) {
    return "transaction_failed"
  }

  return `${stage}_failed`
}

function normalizePaymentFlowErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim()
  }

  return "The payment operation could not be completed."
}

async function recordReceiptEvent(
  supabase: SupabaseClient<Database>,
  deps: PaymentOperationsCommandDeps,
  input: {
    stage: "submission_record"
    outcome: "attempt" | "success" | "failure"
    attemptId: string
    actorUserId?: string | null
    actorRole?: "unauthenticated" | "authenticated_user" | "project_admin"
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
  },
) {
  try {
    await supabase.from("payment_flow_events").insert({
      flow: "receipt_recording",
      stage: input.stage,
      outcome: input.outcome,
      severity: input.outcome === "failure" ? "error" : "info",
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
      environment: deps.environment,
      error_code: input.error ? normalizePaymentFlowErrorCode(input.stage, input.error) : null,
      error_message: input.error ? normalizePaymentFlowErrorMessage(input.error) : null,
      metadata: input.metadata ?? {},
    })
  } catch (error) {
    console.error("Failed to store receipt-recording observability event", error)
  }
}

function mapManagedCryptoPaymentMethodSummary(
  row: ManagedCryptoPaymentMethodRow,
  deps: PaymentOperationsCommandDeps,
): ManagedCryptoPaymentMethodSummary {
  const deploymentAvailability = deps.getDeploymentAvailabilityForRoute({
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

export async function resolveProjectPaymentAdminContext(
  supabase: SupabaseClient<Database>,
  actorUserId: string,
  projectSlug: string,
): Promise<PaymentOperationsCommandResult<ProjectContext>> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, name, organization_id, default_payment_method_id")
    .eq("slug", projectSlug)
    .single()

  if (projectError || !project) {
    return commandFailure("project_not_found", projectError?.message ?? "Project not found.")
  }

  const [{ data: participant, error: participantError }, { data: adminRoles, error: roleError }] = await Promise.all([
    supabase
      .from("participants")
      .select("id")
      .eq("project_id", project.id)
      .eq("user_id", actorUserId)
      .eq("is_admin", true)
      .maybeSingle(),
    supabase.from("ref_roles").select("id").in("name", ["Founder", "Admin"]),
  ])

  if (participantError) {
    return commandFailure("reference_data_unavailable", participantError.message, { projectId: project.id })
  }

  if (participant) {
    return { ok: true, data: { actorUserId, project } }
  }

  if (roleError) {
    return commandFailure("reference_data_unavailable", roleError.message, { projectId: project.id })
  }

  const adminRoleIds = adminRoles?.map((role) => role.id) ?? []
  if (project.organization_id && adminRoleIds.length > 0) {
    const { data: orgMembership, error: orgError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", project.organization_id)
      .eq("user_id", actorUserId)
      .eq("status", "active")
      .in("role_id", adminRoleIds)
      .maybeSingle()

    if (orgError) {
      return commandFailure("reference_data_unavailable", orgError.message, { projectId: project.id })
    }

    if (orgMembership) {
      return { ok: true, data: { actorUserId, project } }
    }
  }

  return commandFailure("permission_denied", "You do not have permission to manage payments for this project.", {
    projectId: project.id,
  })
}

export async function listProjectManagedCryptoPaymentMethodsForProjectId(
  supabase: SupabaseClient<Database>,
  projectId: number,
  deps: PaymentOperationsCommandDeps,
) {
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

  return ((data ?? []) as unknown as ManagedCryptoPaymentMethodRow[]).map((row) =>
    mapManagedCryptoPaymentMethodSummary(row, deps),
  )
}

async function getCryptoContractMethodId(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from("ref_payment_methods").select("id").eq("code", "crypto_contract").single()

  if (error || !data) {
    throw new Error(error?.message ?? "Crypto payment method reference is missing")
  }

  return data.id
}

async function getProjectCryptoRouteStates(supabase: SupabaseClient<Database>, projectId: number) {
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

async function validateManagedCryptoRouteReferences(
  supabase: SupabaseClient<Database>,
  input: {
    chainId: number
    chainAssetId: number
    intakeContractId: number
  },
) {
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
    return commandFailure("invalid_reference", "The selected chain is no longer active.")
  }

  if (!asset?.is_active || asset.chain_id !== input.chainId) {
    return commandFailure("invalid_reference", "The selected token is invalid for that chain.")
  }

  if (
    !intakeContract?.is_active ||
    intakeContract.chain_id !== input.chainId ||
    intakeContract.collection_mode !== "contract"
  ) {
    return commandFailure("invalid_reference", "The selected intake contract is invalid for that chain.")
  }

  return { ok: true as const }
}

async function getManagedRouteDeploymentAvailability(
  supabase: SupabaseClient<Database>,
  deps: PaymentOperationsCommandDeps,
  input: {
    chainId: number
    intakeContractId: number
  },
): Promise<DeploymentAvailability> {
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

  return deps.getDeploymentAvailabilityForRoute({
    networkKey: chain.network_key,
    contractAddress: intakeContract.contract_address,
    treasuryAddress: intakeContract.treasury_address,
    abiVersion: intakeContract.abi_version,
  })
}

async function ensureNoDuplicateEnabledCryptoRoute(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: number
    chainId: number
    chainAssetId: number
    intakeContractId: number
    excludePaymentMethodId?: number
  },
) {
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
    return commandFailure(
      "duplicate_route",
      "This crypto route is already enabled for the project. Disable the existing one before reusing it.",
      { projectId: input.projectId },
    )
  }

  return { ok: true as const }
}

async function syncProjectCryptoContractDefault(
  supabase: SupabaseClient<Database>,
  project: ProjectContext["project"],
  cryptoContractMethodId: number,
) {
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

async function applyProjectCryptoRouteStates(
  supabase: SupabaseClient<Database>,
  projectId: number,
  states: ProjectCryptoRouteState[],
) {
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

async function refreshProjectManagedRoutes(
  supabase: SupabaseClient<Database>,
  project: ProjectContext["project"],
  deps: PaymentOperationsCommandDeps,
) {
  return listProjectManagedCryptoPaymentMethodsForProjectId(supabase, project.id, deps)
}

export async function executeProjectCryptoRouteCreateCommand(
  supabase: SupabaseClient<Database>,
  input: ProjectCryptoRouteCreateInput,
  deps: PaymentOperationsCommandDeps,
): Promise<PaymentOperationsCommandResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await resolveProjectPaymentAdminContext(supabase, input.actorUserId, input.projectSlug)
  if (!context.ok) {
    return context
  }

  const referenceValidation = await validateManagedCryptoRouteReferences(supabase, input)
  if (!referenceValidation.ok) {
    return referenceValidation
  }

  try {
    const cryptoContractMethodId = await getCryptoContractMethodId(supabase)
    const duplicateValidation = await ensureNoDuplicateEnabledCryptoRoute(supabase, {
      projectId: context.data.project.id,
      chainId: input.chainId,
      chainAssetId: input.chainAssetId,
      intakeContractId: input.intakeContractId,
    })

    if (!duplicateValidation.ok) {
      return duplicateValidation
    }

    const currentStates = await getProjectCryptoRouteStates(supabase, context.data.project.id)
    const shouldDefault = input.isDefault || currentStates.filter((route) => route.is_enabled).length === 0
    const runtimeAvailability = await getManagedRouteDeploymentAvailability(supabase, deps, {
      chainId: input.chainId,
      intakeContractId: input.intakeContractId,
    })

    if (shouldDefault && !runtimeAvailability.available) {
      return commandFailure(
        "route_unavailable",
        runtimeAvailability.reason ??
          "Sync the deployment manifest into Supabase before making this route the default payment route.",
        { projectId: context.data.project.id },
      )
    }

    if (shouldDefault) {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("project_id", context.data.project.id)
        .eq("collection_mode", "contract")

      if (error) {
        return commandFailure("route_update_failed", error.message, { projectId: context.data.project.id })
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
      return commandFailure("route_insert_failed", insertError.message, { projectId: context.data.project.id })
    }

    await syncProjectCryptoContractDefault(supabase, context.data.project, cryptoContractMethodId)

    return {
      ok: true,
      data: await refreshProjectManagedRoutes(supabase, context.data.project, deps),
    }
  } catch (error) {
    return commandFailure("route_create_failed", error instanceof Error ? error.message : "Could not add the crypto route.", {
      projectId: context.data.project.id,
    })
  }
}

export async function executeProjectCryptoRouteUpdateCommand(
  supabase: SupabaseClient<Database>,
  input: ProjectCryptoRouteUpdateInput,
  deps: PaymentOperationsCommandDeps,
): Promise<PaymentOperationsCommandResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await resolveProjectPaymentAdminContext(supabase, input.actorUserId, input.projectSlug)
  if (!context.ok) {
    return context
  }

  const referenceValidation = await validateManagedCryptoRouteReferences(supabase, input)
  if (!referenceValidation.ok) {
    return referenceValidation
  }

  try {
    const { data: route, error: routeError } = await supabase
      .from("payment_methods")
      .select(
        "id, project_id, method_id, chain_id, chain_asset_id, intake_contract_id, is_default, is_enabled, sort_order, collection_mode",
      )
      .eq("id", input.paymentMethodId)
      .eq("project_id", context.data.project.id)
      .single()

    if (routeError || !route || route.collection_mode !== "contract") {
      return commandFailure("route_not_found", routeError?.message ?? "Crypto route not found.", {
        projectId: context.data.project.id,
        paymentMethodId: input.paymentMethodId,
      })
    }

    if (!route.is_enabled && input.isDefault) {
      return commandFailure("disabled_default_route", "Disabled routes cannot be marked as default.", {
        projectId: context.data.project.id,
        paymentMethodId: route.id,
      })
    }

    if (route.is_enabled) {
      const duplicateValidation = await ensureNoDuplicateEnabledCryptoRoute(supabase, {
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

    const runtimeEligibility = await getManagedRouteDeploymentAvailability(supabase, deps, {
      chainId: input.chainId,
      intakeContractId: input.intakeContractId,
    })

    if (input.isDefault && !runtimeEligibility.available) {
      return commandFailure(
        "route_unavailable",
        runtimeEligibility.reason ??
          "Sync the deployment manifest into Supabase before making this route the default payment route.",
        { projectId: context.data.project.id, paymentMethodId: route.id },
      )
    }

    if (input.isDefault) {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("project_id", context.data.project.id)
        .eq("collection_mode", "contract")

      if (error) {
        return commandFailure("route_update_failed", error.message, {
          projectId: context.data.project.id,
          paymentMethodId: route.id,
        })
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
      return commandFailure("route_update_failed", updateError.message, {
        projectId: context.data.project.id,
        paymentMethodId: route.id,
      })
    }

    const cryptoContractMethodId = await getCryptoContractMethodId(supabase)
    await syncProjectCryptoContractDefault(supabase, context.data.project, cryptoContractMethodId)

    return {
      ok: true,
      data: await refreshProjectManagedRoutes(supabase, context.data.project, deps),
    }
  } catch (error) {
    return commandFailure(
      "route_update_failed",
      error instanceof Error ? error.message : "Could not update the crypto route.",
      {
        projectId: context.data.project.id,
        paymentMethodId: input.paymentMethodId,
      },
    )
  }
}

export async function executeProjectCryptoRouteMoveCommand(
  supabase: SupabaseClient<Database>,
  input: ProjectCryptoRouteMoveInput,
  deps: PaymentOperationsCommandDeps,
): Promise<PaymentOperationsCommandResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await resolveProjectPaymentAdminContext(supabase, input.actorUserId, input.projectSlug)
  if (!context.ok) {
    return context
  }

  try {
    const currentStates = await getProjectCryptoRouteStates(supabase, context.data.project.id)
    if (!currentStates.some((route) => route.id === input.paymentMethodId)) {
      return commandFailure("route_not_found", "Crypto route not found.", {
        projectId: context.data.project.id,
        paymentMethodId: input.paymentMethodId,
      })
    }

    const nextStates = moveProjectCryptoRouteState(currentStates, input.paymentMethodId, input.direction)
    await applyProjectCryptoRouteStates(supabase, context.data.project.id, nextStates)

    return {
      ok: true,
      data: await refreshProjectManagedRoutes(supabase, context.data.project, deps),
    }
  } catch (error) {
    return commandFailure(
      "route_move_failed",
      error instanceof Error ? error.message : "Could not reorder the crypto route.",
      {
        projectId: context.data.project.id,
        paymentMethodId: input.paymentMethodId,
      },
    )
  }
}

export async function executeProjectCryptoRouteEnabledSetCommand(
  supabase: SupabaseClient<Database>,
  input: ProjectCryptoRouteEnabledSetInput,
  deps: PaymentOperationsCommandDeps,
): Promise<PaymentOperationsCommandResult<ManagedCryptoPaymentMethodSummary[]>> {
  const context = await resolveProjectPaymentAdminContext(supabase, input.actorUserId, input.projectSlug)
  if (!context.ok) {
    return context
  }

  try {
    const { data: route, error: routeError } = await supabase
      .from("payment_methods")
      .select(
        "id, project_id, method_id, chain_id, chain_asset_id, intake_contract_id, is_default, is_enabled, sort_order, collection_mode",
      )
      .eq("id", input.paymentMethodId)
      .eq("project_id", context.data.project.id)
      .single()

    if (routeError || !route || route.collection_mode !== "contract") {
      return commandFailure("route_not_found", routeError?.message ?? "Crypto route not found.", {
        projectId: context.data.project.id,
        paymentMethodId: input.paymentMethodId,
      })
    }

    if (route.is_enabled === input.enabled) {
      return {
        ok: true,
        data: await refreshProjectManagedRoutes(supabase, context.data.project, deps),
      }
    }

    const currentStates = await getProjectCryptoRouteStates(supabase, context.data.project.id)
    const nextStates = currentStates.map((state) => ({ ...state }))
    const targetRoute = nextStates.find((state) => state.id === route.id)

    if (!targetRoute) {
      return commandFailure("route_not_found", "Crypto route not found.", {
        projectId: context.data.project.id,
        paymentMethodId: input.paymentMethodId,
      })
    }

    if (input.enabled) {
      const referenceValidation = await validateManagedCryptoRouteReferences(supabase, {
        chainId: route.chain_id ?? 0,
        chainAssetId: route.chain_asset_id ?? 0,
        intakeContractId: route.intake_contract_id ?? 0,
      })

      if (!referenceValidation.ok) {
        return referenceValidation
      }

      const duplicateValidation = await ensureNoDuplicateEnabledCryptoRoute(supabase, {
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

      const routes = await listProjectManagedCryptoPaymentMethodsForProjectId(supabase, context.data.project.id, deps)
      const managedRoute = routes.find((managed) => managed.id === route.id)
      if (managedRoute && managedRoute.is_default && !managedRoute.is_runtime_available) {
        return commandFailure(
          "route_unavailable",
          managedRoute.runtime_availability_issue ??
            "Sync the deployment manifest into Supabase before re-enabling this route as the default.",
          { projectId: context.data.project.id, paymentMethodId: route.id },
        )
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

    await applyProjectCryptoRouteStates(supabase, context.data.project.id, nextStates)

    const cryptoContractMethodId = await getCryptoContractMethodId(supabase)
    await syncProjectCryptoContractDefault(supabase, context.data.project, cryptoContractMethodId)

    return {
      ok: true,
      data: await refreshProjectManagedRoutes(supabase, context.data.project, deps),
    }
  } catch (error) {
    return commandFailure("route_enabled_set_failed", error instanceof Error ? error.message : "Could not update the route state.", {
      projectId: context.data.project.id,
      paymentMethodId: input.paymentMethodId,
    })
  }
}

export async function executeProjectOnchainPaymentSubmissionRecordCommand(
  supabase: SupabaseClient<Database>,
  input: ProjectOnchainPaymentSubmissionRecordInput,
  deps: PaymentOperationsCommandDeps,
): Promise<PaymentOperationsCommandResult<{ submissionId: number }>> {
  const context = await resolveProjectPaymentAdminContext(supabase, input.actorUserId, input.projectSlug)
  if (!context.ok) {
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: input.actorUserId,
      actorRole: "authenticated_user",
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      chainId: input.chainId,
      chainAssetId: input.chainAssetId,
      intakeContractId: input.intakeContractId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: context.error.message,
      metadata: { projectSlug: input.projectSlug },
    })
    return context
  }

  await recordReceiptEvent(supabase, deps, {
    stage: "submission_record",
    outcome: "attempt",
    attemptId: input.attemptId,
    actorUserId: context.data.actorUserId,
    actorRole: "project_admin",
    projectId: context.data.project.id,
    paymentId: input.paymentId,
    paymentMethodId: input.paymentMethodId,
    chainId: input.chainId,
    chainAssetId: input.chainAssetId,
    intakeContractId: input.intakeContractId,
    txHash: input.txHash,
    walletAddress: input.walletAddress,
    metadata: { periodId: input.periodId },
  })

  const [
    { data: payment, error: paymentError },
    { data: paymentMethod, error: paymentMethodError },
    { data: awaitingStatus, error: awaitingStatusError },
    { data: unresolvedSubmission, error: unresolvedSubmissionError },
  ] = await Promise.all([
    supabase.from("payments").select("id, project_id, payment_amount, notes").eq("id", input.paymentId).single(),
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

  const referenceDataError = paymentError ?? paymentMethodError ?? awaitingStatusError ?? unresolvedSubmissionError
  if (referenceDataError) {
    const message = referenceDataError.message
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      error: message,
      metadata: { referenceData: "receipt_recording" },
    })
    return commandFailure("reference_data_unavailable", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
  }

  if (!payment || payment.project_id !== context.data.project.id) {
    const message = "Payment record does not belong to this project"
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      error: message,
      metadata: { requestedProjectSlug: input.projectSlug },
    })
    return commandFailure("payment_project_mismatch", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
  }

  const paymentMethodSnapshot = paymentMethod as unknown as RecordOnchainPaymentRouteSnapshot | null

  if (
    !paymentMethodSnapshot ||
    paymentMethodSnapshot.project_id !== context.data.project.id ||
    paymentMethodSnapshot.chain_id !== input.chainId ||
    paymentMethodSnapshot.chain_asset_id !== input.chainAssetId ||
    paymentMethodSnapshot.intake_contract_id !== input.intakeContractId
  ) {
    const message = "Selected crypto route is invalid for this project"
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      chainId: input.chainId,
      chainAssetId: input.chainAssetId,
      intakeContractId: input.intakeContractId,
      error: message,
    })
    return commandFailure("invalid_crypto_route", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
  }

  if (unresolvedSubmission?.id) {
    const message =
      "This payment already has an unresolved onchain submission. Wait for reconciliation or a failed result before retrying."
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      submissionId: unresolvedSubmission.id,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: message,
    })
    return commandFailure("submission_unresolved", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      submissionId: unresolvedSubmission.id,
    })
  }

  const executableRoutes = await listProjectManagedCryptoPaymentMethodsForProjectId(supabase, context.data.project.id, deps)
  const selectedRoute = executableRoutes.find((route) => route.id === input.paymentMethodId)
  if (!selectedRoute?.is_runtime_available) {
    const routeError =
      selectedRoute?.runtime_availability_issue ??
      "This crypto route is not available in the active wallet deployment for this environment."
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: routeError,
    })
    return commandFailure("route_unavailable", routeError, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
  }

  if (!awaitingStatus?.id) {
    const message = "The awaiting_confirmation payment status is not configured"
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      error: message,
    })
    return commandFailure("status_not_configured", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
  }

  const amountDecimal = Number.parseFloat(input.amountDecimal)
  if (!Number.isFinite(amountDecimal) || amountDecimal <= 0) {
    const message = "Payment amount is invalid"
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: message,
    })
    return commandFailure("invalid_amount", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
  }

  const expectedAmount = Number(payment.payment_amount)
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    const message = "Canonical payment amount is invalid"
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: message,
    })
    return commandFailure("invalid_canonical_amount", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
  }

  if (Math.abs(amountDecimal - expectedAmount) > 0.000001) {
    const message = "Submitted onchain amount does not match the payment amount"
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: message,
      metadata: { expectedAmount, submittedAmount: amountDecimal },
    })
    return commandFailure("amount_mismatch", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
  }

  if (!Number.isInteger(input.periodId) || input.periodId < 0 || input.periodId > 12) {
    const message = "The selected period tag is invalid"
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      error: message,
      metadata: { periodId: input.periodId },
    })
    return commandFailure("invalid_period", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
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
    const message = submissionError?.message ?? "Could not store the onchain payment submission"
    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: message,
    })
    return commandFailure("submission_insert_failed", message, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
    })
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
    const failedAt = new Date().toISOString()
    const { error: submissionFailureError } = await supabase
      .from("onchain_payment_submissions")
      .update({
        status: "failed",
        failure_code: "payment_update_failed",
        failure_reason: paymentUpdateError.message,
        last_checked_at: failedAt,
        reconciled_at: failedAt,
        metadata: {
          source: "project_payments_page",
          period_id: input.periodId,
          compensation_reason: "payment_update_failed",
        },
      })
      .eq("id", submission.id)

    const failureMessage = submissionFailureError
      ? `${paymentUpdateError.message}; additionally could not mark the onchain submission failed: ${submissionFailureError.message}`
      : paymentUpdateError.message

    await recordReceiptEvent(supabase, deps, {
      stage: "submission_record",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: context.data.actorUserId,
      actorRole: "project_admin",
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      submissionId: submission.id,
      txHash: input.txHash,
      walletAddress: input.walletAddress,
      error: failureMessage,
      metadata: {
        compensation: submissionFailureError ? "submission_failure_update_failed" : "submission_marked_failed",
      },
    })
    return commandFailure("payment_update_failed", failureMessage, {
      projectId: context.data.project.id,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      submissionId: submission.id,
    })
  }

  await recordReceiptEvent(supabase, deps, {
    stage: "submission_record",
    outcome: "success",
    attemptId: input.attemptId,
    actorUserId: context.data.actorUserId,
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
    metadata: { periodId: input.periodId, amountRaw: input.amountRaw },
  })

  return { ok: true, data: { submissionId: submission.id } }
}
