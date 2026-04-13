"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalAdminActor } from "@/lib/zkas/auth"
import { validateProjectPaymentDrafts, type ProjectPaymentDraftInput } from "@/lib/payments"
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
}

type CryptoPaymentMethodRow = {
  id: number
  method_id: number
  project_id: number | null
  label: string | null
  is_default: boolean | null
  chain_id: number | null
  chain_asset_id: number | null
  intake_contract_id: number | null
  collection_mode: "contract" | "deposit_address"
  ref_chains: Pick<Tables<"ref_chains">, "id" | "display_name" | "network_key" | "evm_chain_id" | "native_asset_symbol">
  ref_chain_assets: Pick<
    Tables<"ref_chain_assets">,
    "id" | "symbol" | "name" | "token_address" | "decimals" | "is_native" | "is_stablecoin"
  >
  chain_intake_contracts: Pick<Tables<"chain_intake_contracts">, "id" | "contract_address" | "treasury_address" | "abi_version">
}

type ProjectContext = {
  userId: string
  project: Pick<Tables<"projects">, "id" | "slug" | "name" | "organization_id">
}

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
    .select("id, slug, name, organization_id")
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

export async function listProjectCryptoPaymentMethods(projectSlug: string): Promise<ActionResult<CryptoPaymentMethodRow[]>> {
  const context = await getProjectAdminContext(projectSlug)
  if (!context.ok) {
    return context
  }

  const auth = await getAuthenticatedUserId()
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const { supabase } = auth
  const { data, error } = await supabase
    .from("payment_methods")
    .select(`
      id,
      method_id,
      project_id,
      label,
      is_default,
      chain_id,
      chain_asset_id,
      intake_contract_id,
      collection_mode,
      ref_chains!inner(id, display_name, network_key, evm_chain_id, native_asset_symbol),
      ref_chain_assets!inner(id, symbol, name, token_address, decimals, is_native, is_stablecoin),
      chain_intake_contracts!inner(id, contract_address, treasury_address, abi_version)
    `)
    .eq("project_id", context.data.project.id)
    .eq("collection_mode", "contract")
    .eq("is_enabled", true)
    .not("chain_id", "is", null)
    .not("chain_asset_id", "is", null)
    .not("intake_contract_id", "is", null)
    .order("is_default", { ascending: false })
    .order("id", { ascending: true })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, data: (data ?? []) as CryptoPaymentMethodRow[] }
}

type RecordOnchainPaymentInput = {
  projectSlug: string
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
  payments: ProjectPaymentDraftInput[]
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
  }
}

export async function createProjectPaymentDrafts(
  input: CreateProjectPaymentDraftsInput,
): Promise<ActionResult<PaymentRecordSummary[]>> {
  const context = await getProjectAdminContext(input.projectSlug)
  if (!context.ok) {
    return context
  }

  const validation = validateProjectPaymentDrafts(input.payments)
  if (!validation.ok) {
    return validation
  }

  const supabase = getAdminSupabaseClient()
  const [{ data: draftStatus }, { data: methods, error: methodsError }] = await Promise.all([
    supabase.from("ref_payment_statuses").select("id").eq("code", "draft").single(),
    supabase.from("ref_payment_methods").select("id").in(
      "id",
      validation.data.map((row) => row.payment_method_id),
    ),
  ])

  if (!draftStatus?.id) {
    return { ok: false, error: "The draft payment status is not configured." }
  }

  if (methodsError) {
    return { ok: false, error: methodsError.message }
  }

  const validMethodIds = new Set((methods ?? []).map((method) => method.id))
  const invalidRow = validation.data.find((row) => !validMethodIds.has(row.payment_method_id))
  if (invalidRow) {
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
    return { ok: false, error: error.message }
  }

  revalidatePath(`/projects/${input.projectSlug}/payments`)

  return {
    ok: true,
    data: ((data ?? []) as InsertedPaymentRow[]).map(mapPaymentSummary),
  }
}

export async function recordOnchainPaymentSubmission(
  input: RecordOnchainPaymentInput,
): Promise<ActionResult<{ submissionId: number }>> {
  const context = await getProjectAdminContext(input.projectSlug)
  if (!context.ok) {
    return context
  }

  const auth = await getAuthenticatedUserId()
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const { supabase } = auth

  const [{ data: payment }, { data: paymentMethod }, { data: awaitingStatus }] = await Promise.all([
    supabase.from("payments").select("id, project_id").eq("id", input.paymentId).single(),
    supabase
      .from("payment_methods")
      .select("id, method_id, project_id, chain_id, chain_asset_id, intake_contract_id")
      .eq("id", input.paymentMethodId)
      .single(),
    supabase.from("ref_payment_statuses").select("id").eq("code", "awaiting_confirmation").single(),
  ])

  if (!payment || payment.project_id !== context.data.project.id) {
    return { ok: false, error: "Payment record does not belong to this project" }
  }

  if (
    !paymentMethod ||
    paymentMethod.project_id !== context.data.project.id ||
    paymentMethod.chain_id !== input.chainId ||
    paymentMethod.chain_asset_id !== input.chainAssetId ||
    paymentMethod.intake_contract_id !== input.intakeContractId
  ) {
    return { ok: false, error: "Selected crypto route is invalid for this project" }
  }

  if (!awaitingStatus?.id) {
    return { ok: false, error: "The awaiting_confirmation payment status is not configured" }
  }

  const amountDecimal = Number.parseFloat(input.amountDecimal)
  if (!Number.isFinite(amountDecimal) || amountDecimal <= 0) {
    return { ok: false, error: "Payment amount is invalid" }
  }

  if (!Number.isInteger(input.periodId) || input.periodId < 0 || input.periodId > 12) {
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
      wallet_address: input.walletAddress,
      tx_hash: input.txHash,
      amount_raw: input.amountRaw,
      amount_decimal: amountDecimal,
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
    return { ok: false, error: submissionError?.message ?? "Could not store the onchain payment submission" }
  }

  const { error: paymentUpdateError } = await supabase
    .from("payments")
    .update({
      status_id: awaitingStatus.id,
      payment_method_id: paymentMethod.method_id ?? null,
      paid_at: new Date().toISOString(),
      notes: `Onchain payment submitted: ${input.txHash} (period tag: ${input.periodId === 0 ? "current" : input.periodId})`,
    })
    .eq("id", input.paymentId)

  if (paymentUpdateError) {
    return { ok: false, error: paymentUpdateError.message }
  }

  return { ok: true, data: { submissionId: submission.id } }
}

export async function confirmInternalPaymentReceipt(
  paymentId: number,
): Promise<ActionResult<{ paymentId: number; statusCode: string; confirmedAt: string }>> {
  try {
    await requireInternalAdminActor()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "You do not have internal admin access.",
    }
  }

  const supabase = getAdminSupabaseClient()
  const [{ data: payment }, { data: confirmedStatus }] = await Promise.all([
    supabase.from("payments").select("id, project_id, projects(slug)").eq("id", paymentId).single(),
    supabase.from("ref_payment_statuses").select("id, code").eq("code", "confirmed").single(),
  ])

  if (!payment) {
    return { ok: false, error: "Payment not found." }
  }

  if (!confirmedStatus?.id) {
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
    return { ok: false, error: submissionError.message }
  }

  revalidatePath("/admin/payments")
  const projectSlug = payment.projects && !Array.isArray(payment.projects) ? payment.projects.slug : null
  if (projectSlug) {
    revalidatePath(`/projects/${projectSlug}/payments`)
  }

  return {
    ok: true,
    data: {
      paymentId,
      statusCode: confirmedStatus.code,
      confirmedAt,
    },
  }
}
