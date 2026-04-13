import { createPublicClient, decodeEventLog, http } from "viem"
import type { Log, TransactionReceipt } from "viem"
import { fundLoopIntakeAbi } from "@/lib/onchain/fundloop-intake-abi"
import {
  getRequiredConfirmationDepth,
  getWalletRuntimeConfig,
  ZERO_ADDRESS,
} from "@/lib/onchain/runtime-config"
import { createConfiguredChain, getSupportedChainConfig } from "@/lib/onchain/supported-chains"
import {
  type OnchainSubmissionStatus,
  type OnchainSubmissionSummary,
} from "@/lib/onchain/payment-submissions"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import type { Tables, TablesUpdate } from "@/types/supabase"

export type ReconciliationRunSource = "cron" | "admin_manual"

export type RunOnchainPaymentReconciliationInput = {
  limit?: number
  paymentId?: number
  submissionId?: number
  source: ReconciliationRunSource
}

export type ReconciliationOutcome = {
  submissionId: number
  paymentId: number | null
  projectSlug: string | null
  txHash: string
  status: OnchainSubmissionStatus
  confirmationCount: number
  confirmationDepth: number
  failureCode: string | null
  failureReason: string | null
}

export type OnchainReconciliationRunSummary = {
  source: ReconciliationRunSource
  processedCount: number
  confirmedCount: number
  failedCount: number
  confirmingCount: number
  unresolvedCount: number
  results: ReconciliationOutcome[]
  touchedProjectSlugs: string[]
}

export type ReconciliationReceiptLike = Pick<TransactionReceipt, "status" | "to" | "blockNumber"> & {
  logs: Array<Pick<Log, "address" | "data" | "topics" | "logIndex">>
}

export type ReconciliationSubmissionSnapshot = {
  submissionId: number
  paymentId: number | null
  projectId: number
  projectSlug: string | null
  txHash: string
  walletAddress: string
  amountRaw: string
  periodId: number
  chainNetworkKey: string
  intakeContractAddress: string
  intakeTreasuryAddress: string
  assetTokenAddress: string | null
  assetIsNative: boolean
}

export type ReconciliationEvaluation =
  | {
      status: "confirming" | "confirmed"
      confirmationCount: number
      confirmationDepth: number
      matchedLogIndex: number | null
      failureCode: null
      failureReason: null
    }
  | {
      status: "failed"
      confirmationCount: number
      confirmationDepth: number
      matchedLogIndex: number | null
      failureCode: string
      failureReason: string
    }

type OnchainSubmissionSummaryRow = Pick<
  Tables<"onchain_payment_submissions">,
  | "id"
  | "payment_id"
  | "project_id"
  | "payment_method_id"
  | "period_id"
  | "tx_hash"
  | "wallet_address"
  | "status"
  | "confirmation_count"
  | "failure_code"
  | "failure_reason"
  | "submitted_at"
  | "last_checked_at"
  | "reconciled_at"
  | "matched_log_index"
> & {
  ref_chains: Pick<Tables<"ref_chains">, "id" | "display_name" | "network_key">
  ref_chain_assets: Pick<Tables<"ref_chain_assets">, "id" | "symbol" | "is_native">
}

type ReconciliationSubmissionRow = Pick<
  Tables<"onchain_payment_submissions">,
  | "id"
  | "payment_id"
  | "project_id"
  | "payment_method_id"
  | "tx_hash"
  | "wallet_address"
  | "amount_raw"
  | "period_id"
  | "status"
  | "chain_network_key"
  | "intake_contract_address"
  | "intake_treasury_address"
  | "asset_token_address"
  | "asset_is_native"
  | "confirmation_count"
  | "failure_code"
  | "failure_reason"
> & {
  payments: Pick<Tables<"payments">, "id" | "notes"> | null
  projects: Pick<Tables<"projects">, "slug"> | null
}

function normalizeAddress(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null
}

function getExpectedAssetAddress(snapshot: ReconciliationSubmissionSnapshot) {
  return snapshot.assetIsNative ? ZERO_ADDRESS : normalizeAddress(snapshot.assetTokenAddress)
}

function formatFailureMessage(code: string, detail: string) {
  return `[${code}] ${detail}`
}

function appendPaymentNote(existingNote: string | null | undefined, nextNote: string) {
  if (!existingNote?.trim()) {
    return nextNote
  }

  return `${existingNote}\n${nextNote}`
}

function getConfiguredPublicClient(networkKey: string) {
  const supported = getSupportedChainConfig(networkKey)
  if (!supported) {
    throw new Error(`Unsupported reconciliation chain: ${networkKey}`)
  }

  const rpcUrl = process.env[supported.rpcEnvVar]?.trim()
  if (!rpcUrl) {
    throw new Error(`${supported.rpcEnvVar} is required to reconcile ${networkKey} payments.`)
  }

  return createPublicClient({
    chain: createConfiguredChain(supported.key, rpcUrl),
    transport: http(rpcUrl),
  })
}

function getConfirmationDepth(networkKey: string) {
  return getRequiredConfirmationDepth(getWalletRuntimeConfig(), networkKey)
}

function decodeMatchingDepositLog(
  snapshot: ReconciliationSubmissionSnapshot,
  logs: ReconciliationReceiptLike["logs"],
) {
  for (const log of logs) {
    if (normalizeAddress(log.address) !== normalizeAddress(snapshot.intakeContractAddress)) {
      continue
    }

    try {
      const decoded = decodeEventLog({
        abi: fundLoopIntakeAbi,
        data: log.data,
        topics: log.topics,
      })

      if (decoded.eventName !== "Deposit") {
        continue
      }

      const expectedAsset = getExpectedAssetAddress(snapshot)
      const eventAsset = normalizeAddress(decoded.args.asset)
      const matches =
        decoded.args.projectId === BigInt(snapshot.projectId) &&
        Number(decoded.args.periodId) === snapshot.periodId &&
        decoded.args.amount === BigInt(snapshot.amountRaw) &&
        normalizeAddress(decoded.args.sender) === normalizeAddress(snapshot.walletAddress) &&
        normalizeAddress(decoded.args.treasury) === normalizeAddress(snapshot.intakeTreasuryAddress) &&
        decoded.args.isNative === snapshot.assetIsNative &&
        eventAsset === expectedAsset

      if (!matches) {
        continue
      }

      if (typeof log.logIndex === "bigint") {
        return Number(log.logIndex)
      }

      return typeof log.logIndex === "number" ? log.logIndex : null
    } catch {
      continue
    }
  }

  return null
}

export function evaluateSubmissionAgainstReceipt(
  snapshot: ReconciliationSubmissionSnapshot,
  receipt: ReconciliationReceiptLike,
  currentBlockNumber: bigint,
  confirmationDepth: number,
): ReconciliationEvaluation {
  if (receipt.status !== "success") {
    return {
      status: "failed",
      confirmationCount: 0,
      confirmationDepth,
      matchedLogIndex: null,
      failureCode: "tx_reverted",
      failureReason: "The transaction receipt shows the deposit transaction reverted onchain.",
    }
  }

  if (normalizeAddress(receipt.to) !== normalizeAddress(snapshot.intakeContractAddress)) {
    return {
      status: "failed",
      confirmationCount: 0,
      confirmationDepth,
      matchedLogIndex: null,
      failureCode: "contract_mismatch",
      failureReason: "The transaction executed against a different contract than the recorded intake route.",
    }
  }

  const matchedLogIndex = decodeMatchingDepositLog(snapshot, receipt.logs)
  if (matchedLogIndex === null) {
    return {
      status: "failed",
      confirmationCount: 0,
      confirmationDepth,
      matchedLogIndex: null,
      failureCode: "deposit_event_mismatch",
      failureReason:
        "No matching FundLoop Deposit event was found for the recorded project, period, sender, asset, treasury, and amount.",
    }
  }

  const confirmationCount = Number(currentBlockNumber - receipt.blockNumber + BigInt(1))
  if (confirmationCount < confirmationDepth) {
    return {
      status: "confirming",
      confirmationCount,
      confirmationDepth,
      matchedLogIndex,
      failureCode: null,
      failureReason: null,
    }
  }

  return {
    status: "confirmed",
    confirmationCount,
    confirmationDepth,
    matchedLogIndex,
    failureCode: null,
    failureReason: null,
  }
}

function mapOnchainSubmissionSummary(row: OnchainSubmissionSummaryRow): OnchainSubmissionSummary {
  const confirmationDepth = getConfirmationDepth(row.ref_chains.network_key)

  return {
    id: row.id,
    payment_id: row.payment_id,
    project_id: row.project_id,
    payment_method_id: row.payment_method_id,
    period_id: row.period_id,
    tx_hash: row.tx_hash,
    wallet_address: row.wallet_address,
    status: row.status as OnchainSubmissionStatus,
    confirmation_count: row.confirmation_count,
    confirmation_depth: confirmationDepth,
    failure_code: row.failure_code,
    failure_reason: row.failure_reason,
    submitted_at: row.submitted_at,
    last_checked_at: row.last_checked_at,
    reconciled_at: row.reconciled_at,
    matched_log_index: row.matched_log_index,
    chain: {
      id: row.ref_chains.id,
      display_name: row.ref_chains.display_name,
      network_key: row.ref_chains.network_key,
    },
    asset: {
      id: row.ref_chain_assets.id,
      symbol: row.ref_chain_assets.symbol,
      is_native: row.ref_chain_assets.is_native,
    },
  }
}

async function getPaymentStatusIds() {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase
    .from("ref_payment_statuses")
    .select("id, code")
    .in("code", ["awaiting_confirmation", "confirmed", "failed"])

  if (error) {
    throw new Error(error.message)
  }

  const byCode = new Map((data ?? []).map((row) => [row.code, row.id]))
  const awaitingConfirmation = byCode.get("awaiting_confirmation")
  const confirmed = byCode.get("confirmed")
  const failed = byCode.get("failed")

  if (!awaitingConfirmation || !confirmed || !failed) {
    throw new Error("Required payment status references are not configured for reconciliation.")
  }

  return {
    awaitingConfirmation,
    confirmed,
    failed,
  }
}

async function fetchReconciliationRows(input: RunOnchainPaymentReconciliationInput) {
  const supabase = getAdminSupabaseClient()
  let query = supabase
    .from("onchain_payment_submissions")
    .select(`
      id,
      payment_id,
      project_id,
      payment_method_id,
      tx_hash,
      wallet_address,
      amount_raw,
      period_id,
      status,
      chain_network_key,
      intake_contract_address,
      intake_treasury_address,
      asset_token_address,
      asset_is_native,
      confirmation_count,
      failure_code,
      failure_reason,
      payments(id, notes),
      projects(slug)
    `)
    .in("status", ["submitted", "confirming"])
    .not("payment_id", "is", null)
    .order("submitted_at", { ascending: true })
    .order("id", { ascending: true })

  if (input.paymentId) {
    query = query.eq("payment_id", input.paymentId)
  }

  if (input.submissionId) {
    query = query.eq("id", input.submissionId)
  }

  if (input.limit) {
    query = query.limit(input.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ReconciliationSubmissionRow[]
}

async function updateSubmissionAndPayment(
  row: ReconciliationSubmissionRow,
  evaluation: ReconciliationEvaluation | null,
) {
  const supabase = getAdminSupabaseClient()
  const paymentStatusIds = await getPaymentStatusIds()
  const checkedAt = new Date().toISOString()

  if (!evaluation) {
    const { error } = await supabase
      .from("onchain_payment_submissions")
      .update({
        last_checked_at: checkedAt,
      })
      .eq("id", row.id)

    if (error) {
      throw new Error(error.message)
    }

    return {
      submissionId: row.id,
      paymentId: row.payment_id,
      projectSlug: row.projects?.slug ?? null,
      txHash: row.tx_hash,
      status: row.status as OnchainSubmissionStatus,
      confirmationCount: row.confirmation_count,
      confirmationDepth: getConfirmationDepth(row.chain_network_key),
      failureCode: row.failure_code,
      failureReason: row.failure_reason,
    } satisfies ReconciliationOutcome
  }

  const submissionUpdate: TablesUpdate<"onchain_payment_submissions"> = {
    status: evaluation.status,
    last_checked_at: checkedAt,
    confirmation_count: evaluation.confirmationCount,
    matched_log_index: evaluation.matchedLogIndex,
    failure_code: evaluation.failureCode,
    failure_reason: evaluation.failureReason,
  }

  if (evaluation.status === "confirmed") {
    submissionUpdate.confirmed_at = checkedAt
    submissionUpdate.reconciled_at = checkedAt
  }

  if (evaluation.status === "failed") {
    submissionUpdate.reconciled_at = checkedAt
  }

  const { error: submissionError } = await supabase
    .from("onchain_payment_submissions")
    .update(submissionUpdate)
    .eq("id", row.id)

  if (submissionError) {
    throw new Error(submissionError.message)
  }

  if (row.payment_id !== null) {
    if (evaluation.status === "confirmed") {
      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          status_id: paymentStatusIds.confirmed,
          confirmed_at: checkedAt,
          updated_at: checkedAt,
        })
        .eq("id", row.payment_id)

      if (paymentError) {
        throw new Error(paymentError.message)
      }
    }

    if (evaluation.status === "failed") {
      const failureNote = formatFailureMessage(evaluation.failureCode, evaluation.failureReason)
      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          status_id: paymentStatusIds.failed,
          confirmed_at: null,
          updated_at: checkedAt,
          notes: appendPaymentNote(row.payments?.notes, `Onchain reconciliation failed: ${failureNote}`),
        })
        .eq("id", row.payment_id)

      if (paymentError) {
        throw new Error(paymentError.message)
      }
    }

    if (evaluation.status === "confirming") {
      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          status_id: paymentStatusIds.awaitingConfirmation,
          updated_at: checkedAt,
        })
        .eq("id", row.payment_id)

      if (paymentError) {
        throw new Error(paymentError.message)
      }
    }
  }

  return {
    submissionId: row.id,
    paymentId: row.payment_id,
    projectSlug: row.projects?.slug ?? null,
    txHash: row.tx_hash,
    status: evaluation.status,
    confirmationCount: evaluation.confirmationCount,
    confirmationDepth: evaluation.confirmationDepth,
    failureCode: evaluation.failureCode,
    failureReason: evaluation.failureReason,
  } satisfies ReconciliationOutcome
}

async function reconcileSubmission(row: ReconciliationSubmissionRow) {
  const confirmationDepth = getConfirmationDepth(row.chain_network_key)
  const client = getConfiguredPublicClient(row.chain_network_key)
  const snapshot: ReconciliationSubmissionSnapshot = {
    submissionId: row.id,
    paymentId: row.payment_id,
    projectId: row.project_id,
    projectSlug: row.projects?.slug ?? null,
    txHash: row.tx_hash,
    walletAddress: row.wallet_address,
    amountRaw: row.amount_raw,
    periodId: row.period_id,
    chainNetworkKey: row.chain_network_key,
    intakeContractAddress: row.intake_contract_address,
    intakeTreasuryAddress: row.intake_treasury_address,
    assetTokenAddress: row.asset_token_address,
    assetIsNative: row.asset_is_native,
  }

  let receipt: TransactionReceipt
  try {
    receipt = await client.getTransactionReceipt({
      hash: row.tx_hash as `0x${string}`,
    })
  } catch {
    return updateSubmissionAndPayment(row, null)
  }

  const currentBlockNumber = await client.getBlockNumber()
  const evaluation = evaluateSubmissionAgainstReceipt(snapshot, receipt, currentBlockNumber, confirmationDepth)
  return updateSubmissionAndPayment(row, evaluation)
}

async function writeCronLog(input: { status: string; note: string }) {
  const supabase = getAdminSupabaseClient()

  await supabase.from("cron_logs").insert({
    id: crypto.randomUUID(),
    status: input.status,
    note: input.note,
    timestamp: new Date().toISOString(),
  })
}

export async function listLatestOnchainSubmissionsForPaymentIds(paymentIds: number[]) {
  if (paymentIds.length === 0) {
    return new Map<number, OnchainSubmissionSummary>()
  }

  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase
    .from("onchain_payment_submissions")
    .select(`
      id,
      payment_id,
      project_id,
      payment_method_id,
      period_id,
      tx_hash,
      wallet_address,
      status,
      confirmation_count,
      failure_code,
      failure_reason,
      submitted_at,
      last_checked_at,
      reconciled_at,
      matched_log_index,
      ref_chains!inner(id, display_name, network_key),
      ref_chain_assets!inner(id, symbol, is_native)
    `)
    .in("payment_id", paymentIds)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const entries = ((data ?? []) as OnchainSubmissionSummaryRow[]).map(mapOnchainSubmissionSummary)
  const latestByPayment = new Map<number, OnchainSubmissionSummary>()

  for (const entry of entries) {
    if (entry.payment_id === null || latestByPayment.has(entry.payment_id)) {
      continue
    }

    latestByPayment.set(entry.payment_id, entry)
  }

  return latestByPayment
}

export async function listProjectOnchainSubmissionSummaries(projectId: number) {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase
    .from("onchain_payment_submissions")
    .select(`
      id,
      payment_id,
      project_id,
      payment_method_id,
      period_id,
      tx_hash,
      wallet_address,
      status,
      confirmation_count,
      failure_code,
      failure_reason,
      submitted_at,
      last_checked_at,
      reconciled_at,
      matched_log_index,
      ref_chains!inner(id, display_name, network_key),
      ref_chain_assets!inner(id, symbol, is_native)
    `)
    .eq("project_id", projectId)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as OnchainSubmissionSummaryRow[]).map(mapOnchainSubmissionSummary)
}

export async function listReconciliationQueue(limit = 50) {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase
    .from("onchain_payment_submissions")
    .select(`
      id,
      payment_id,
      project_id,
      payment_method_id,
      period_id,
      tx_hash,
      wallet_address,
      status,
      confirmation_count,
      failure_code,
      failure_reason,
      submitted_at,
      last_checked_at,
      reconciled_at,
      matched_log_index,
      ref_chains!inner(id, display_name, network_key),
      ref_chain_assets!inner(id, symbol, is_native)
    `)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as OnchainSubmissionSummaryRow[]).map(mapOnchainSubmissionSummary)
}

export async function runOnchainPaymentReconciliation(
  input: RunOnchainPaymentReconciliationInput,
): Promise<OnchainReconciliationRunSummary> {
  try {
    const rows = await fetchReconciliationRows(input)
    const results: ReconciliationOutcome[] = []

    for (const row of rows) {
      results.push(await reconcileSubmission(row))
    }

    const summary: OnchainReconciliationRunSummary = {
      source: input.source,
      processedCount: results.length,
      confirmedCount: results.filter((result) => result.status === "confirmed").length,
      failedCount: results.filter((result) => result.status === "failed").length,
      confirmingCount: results.filter((result) => result.status === "confirming").length,
      unresolvedCount: results.filter((result) => result.status === "submitted").length,
      results,
      touchedProjectSlugs: Array.from(new Set(results.map((result) => result.projectSlug).filter(Boolean) as string[])),
    }

    await writeCronLog({
      status: "success",
      note: JSON.stringify({
        source: summary.source,
        processedCount: summary.processedCount,
        confirmedCount: summary.confirmedCount,
        failedCount: summary.failedCount,
        confirmingCount: summary.confirmingCount,
        unresolvedCount: summary.unresolvedCount,
      }),
    })

    return summary
  } catch (error) {
    await writeCronLog({
      status: "error",
      note: JSON.stringify({
        source: input.source,
        error: error instanceof Error ? error.message : "Unknown reconciliation error",
      }),
    })

    throw error
  }
}
