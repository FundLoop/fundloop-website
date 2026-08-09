import { edgeCommandFailure, edgeCommandSuccess } from "../edge-functions/result.ts"

export const STRIPE_BANK_TRANSFER_ENVIRONMENTS = ["local", "dev", "test"] as const
export const STRIPE_BANK_TRANSFER_CURRENCIES = ["USD", "CAD"] as const
export type StripeBankTransferCurrency = (typeof STRIPE_BANK_TRANSFER_CURRENCIES)[number]

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export type StripeBankTransferIntentCreateInput = {
  projectSlug: string
  paymentId: number
  currencyCode: StripeBankTransferCurrency
  expectedAmountMinor: string
}

export type StripeBankTransferIntentCreateOutput = {
  intentId: number
  paymentId: number
  currencyCode: "USD"
  expectedAmountMinor: string
  providerPaymentIntentId: string
  status: string
  hostedInstructionsUrl: string | null
  sandboxOnly: true
}

export function validateStripeBankTransferIntentCreateInput(value: unknown, environment: string) {
  if (!STRIPE_BANK_TRANSFER_ENVIRONMENTS.includes(environment as (typeof STRIPE_BANK_TRANSFER_ENVIRONMENTS)[number])) {
    return edgeCommandFailure("production_disabled", "Stripe bank-transfer intake is unavailable in this environment.")
  }
  if (!isObject(value)) return edgeCommandFailure("invalid_payload", "Expected an object.")
  const allowed = new Set(["projectSlug", "paymentId", "currencyCode", "expectedAmountMinor"])
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    return edgeCommandFailure("invalid_payload", "Unexpected Stripe bank-transfer input field.")
  }
  const currencyCode = String(value.currencyCode ?? "").toUpperCase()
  if (currencyCode === "CAD") {
    return edgeCommandFailure(
      "cad_bank_transfer_unavailable",
      "Stripe does not currently expose CAD bank-transfer funding instructions; CAD remains fail-closed.",
    )
  }
  if (
    typeof value.projectSlug !== "string" || !SLUG.test(value.projectSlug) ||
    !Number.isInteger(value.paymentId) || Number(value.paymentId) <= 0 || currencyCode !== "USD" ||
    typeof value.expectedAmountMinor !== "string" || !/^[1-9]\d*$/.test(value.expectedAmountMinor)
  ) return edgeCommandFailure("invalid_payload", "Stripe bank-transfer intent fields are invalid.")
  return edgeCommandSuccess({
    projectSlug: value.projectSlug,
    paymentId: Number(value.paymentId),
    currencyCode: "USD" as const,
    expectedAmountMinor: value.expectedAmountMinor,
  })
}

export function isStripeBankTransferIntentCreateOutput(value: unknown): value is StripeBankTransferIntentCreateOutput {
  if (!isObject(value)) return false
  return Number.isInteger(value.intentId) && Number(value.intentId) > 0 && Number.isInteger(value.paymentId) &&
    value.currencyCode === "USD" && typeof value.expectedAmountMinor === "string" && /^[1-9]\d*$/.test(value.expectedAmountMinor) &&
    typeof value.providerPaymentIntentId === "string" && /^pi_[A-Za-z0-9]+$/.test(value.providerPaymentIntentId) &&
    typeof value.status === "string" && (value.hostedInstructionsUrl === null || typeof value.hostedInstructionsUrl === "string") &&
    value.sandboxOnly === true
}

export type StripeBankTransferStatus = {
  intentId: number
  paymentId: number
  currencyCode: StripeBankTransferCurrency
  expectedAmountMinor: string
  status: string
  statusAt: string | null
  orderingStatus: string
  availableForShadowClose: boolean
  topologyStatus: string | null
  sweepEvidencePending: boolean
}

export type StripeBankTransferWebhookEvidence = {
  evidenceType: "funded" | "processing" | "available" | "failed" | "canceled" | "refunded" | "disputed" | "dispute_won" | "dispute_lost" | "balance_available"
  providerObjectId: string
  providerPaymentIntentId: string | null
  providerCustomerId: string | null
  currencyCode: StripeBankTransferCurrency | null
  grossAmountMinor: string | null
  feeAmountMinor: string | null
  netAmountMinor: string | null
  providerBalanceTransactionId: string | null
  providerBalanceCurrencyCode: StripeBankTransferCurrency | null
  providerBalanceGrossAmountMinor: string | null
  providerBalanceFeeAmountMinor: string | null
  providerBalanceNetAmountMinor: string | null
}

function amount(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? String(value) : null
}

function id(value: unknown, prefix: string) {
  return typeof value === "string" && value.startsWith(prefix) ? value : null
}

export function normalizeStripeBankTransferWebhook(eventType: string, object: unknown): StripeBankTransferWebhookEvidence | null {
  if (!isObject(object)) return null
  const currency = typeof object.currency === "string" ? object.currency.toUpperCase() : null
  const currencyCode = currency === "USD" || currency === "CAD" ? currency : null
  if (eventType.startsWith("payment_intent.")) {
    const mapping: Record<string, StripeBankTransferWebhookEvidence["evidenceType"]> = {
      "payment_intent.processing": "processing", "payment_intent.succeeded": "available",
      "payment_intent.payment_failed": "failed", "payment_intent.canceled": "canceled",
    }
    const evidenceType = mapping[eventType]
    const paymentIntentId = id(object.id, "pi_")
    if (!evidenceType || !paymentIntentId || !currencyCode) return null
    const latestCharge = isObject(object.latest_charge) ? object.latest_charge : null
    const balanceTransaction = latestCharge && isObject(latestCharge.balance_transaction) ? latestCharge.balance_transaction : null
    const gross = amount(object.amount_received ?? object.amount)
    const balanceCurrency = typeof balanceTransaction?.currency === "string" ? balanceTransaction.currency.toUpperCase() : null
    const providerBalanceCurrencyCode = balanceCurrency === "USD" || balanceCurrency === "CAD" ? balanceCurrency : null
    const providerBalanceGrossAmountMinor = amount(balanceTransaction?.amount)
    const providerBalanceFeeAmountMinor = amount(balanceTransaction?.fee)
    const providerBalanceNetAmountMinor = amount(balanceTransaction?.net)
    const sameCurrencyBalance = providerBalanceCurrencyCode === currencyCode
    const fee = sameCurrencyBalance ? providerBalanceFeeAmountMinor : null
    const net = sameCurrencyBalance ? providerBalanceNetAmountMinor : null
    return { evidenceType, providerObjectId: paymentIntentId, providerPaymentIntentId: paymentIntentId,
      providerCustomerId: id(object.customer, "cus_"), currencyCode, grossAmountMinor: gross,
      feeAmountMinor: fee, netAmountMinor: net, providerBalanceTransactionId: id(balanceTransaction?.id, "txn_"),
      providerBalanceCurrencyCode, providerBalanceGrossAmountMinor, providerBalanceFeeAmountMinor, providerBalanceNetAmountMinor }
  }
  if (eventType === "customer_cash_balance_transaction.created") {
    const objectId = id(object.id, "ccsbtxn_")
    if (!objectId || !currencyCode) return null
    return { evidenceType: "funded", providerObjectId: objectId, providerPaymentIntentId: null,
      providerCustomerId: id(object.customer, "cus_"), currencyCode, grossAmountMinor: amount(object.net_amount),
      feeAmountMinor: "0", netAmountMinor: amount(object.net_amount), providerBalanceTransactionId: null,
      providerBalanceCurrencyCode: null, providerBalanceGrossAmountMinor: null, providerBalanceFeeAmountMinor: null,
      providerBalanceNetAmountMinor: null }
  }
  if (eventType === "charge.refunded") {
    const objectId = id(object.id, "ch_")
    if (!objectId || !currencyCode) return null
    return { evidenceType: "refunded", providerObjectId: objectId, providerPaymentIntentId: id(object.payment_intent, "pi_"),
      providerCustomerId: id(object.customer, "cus_"), currencyCode, grossAmountMinor: amount(object.amount_refunded),
      feeAmountMinor: "0", netAmountMinor: amount(object.amount_refunded), providerBalanceTransactionId: id(object.balance_transaction, "txn_"),
      providerBalanceCurrencyCode: null, providerBalanceGrossAmountMinor: null, providerBalanceFeeAmountMinor: null,
      providerBalanceNetAmountMinor: null }
  }
  if (eventType.startsWith("charge.dispute.")) {
    const objectId = id(object.id, "dp_")
    if (!objectId || !currencyCode) return null
    let evidenceType: StripeBankTransferWebhookEvidence["evidenceType"] = "disputed"
    if (eventType === "charge.dispute.closed") evidenceType = object.status === "won" ? "dispute_won" : "dispute_lost"
    const charge = isObject(object.charge) ? object.charge : null
    return { evidenceType, providerObjectId: objectId, providerPaymentIntentId: id(charge?.payment_intent, "pi_") ?? id(object.payment_intent, "pi_"),
      providerCustomerId: id(charge?.customer, "cus_") ?? id(object.customer, "cus_"), currencyCode,
      grossAmountMinor: amount(object.amount), feeAmountMinor: "0", netAmountMinor: amount(object.amount), providerBalanceTransactionId: null,
      providerBalanceCurrencyCode: null, providerBalanceGrossAmountMinor: null, providerBalanceFeeAmountMinor: null,
      providerBalanceNetAmountMinor: null }
  }
  if (eventType === "balance.available") {
    return { evidenceType: "balance_available", providerObjectId: "balance", providerPaymentIntentId: null,
      providerCustomerId: null, currencyCode: null, grossAmountMinor: null, feeAmountMinor: null,
      netAmountMinor: null, providerBalanceTransactionId: null, providerBalanceCurrencyCode: null,
      providerBalanceGrossAmountMinor: null, providerBalanceFeeAmountMinor: null, providerBalanceNetAmountMinor: null }
  }
  return null
}
