import { edgeCommandFailure, edgeCommandSuccess } from "../edge-functions/result.ts"

export const STRIPE_ACSS_DEBIT_ENVIRONMENTS = ["local", "development", "dev", "preview", "test"] as const
export type StripeAcssDebitCurrency = "CAD" | "USD"

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)

export type StripeAcssDebitCheckoutCreateInput = {
  projectSlug: string
  paymentId: number
  currencyCode: StripeAcssDebitCurrency
  expectedAmountMinor: string
}

export type StripeAcssDebitCheckoutCreateOutput = {
  commandId: string
  checkoutSessionId: string
  checkoutUrl: string
  currencyCode: StripeAcssDebitCurrency
  expectedAmountMinor: string
  status: "checkout_created"
  sandboxOnly: true
}

export type StripeAcssDebitStatus = {
  commandId: string
  paymentId: number
  currencyCode: StripeAcssDebitCurrency
  expectedAmountMinor: string
  status: string
  statusAt: string | null
  availableForPackage: boolean
  reversed: boolean
}

export function validateStripeAcssDebitCheckoutCreateInput(value: unknown, environment: string) {
  if (!STRIPE_ACSS_DEBIT_ENVIRONMENTS.includes(environment as (typeof STRIPE_ACSS_DEBIT_ENVIRONMENTS)[number])) {
    return edgeCommandFailure("production_disabled", "Canadian PAD intake is unavailable in this environment.")
  }
  if (!isObject(value)) return edgeCommandFailure("invalid_payload", "Expected an object.")
  const allowed = new Set(["projectSlug", "paymentId", "currencyCode", "expectedAmountMinor"])
  if (Object.keys(value).some((key) => !allowed.has(key))) return edgeCommandFailure("invalid_payload", "Unexpected PAD input field.")
  const currencyCode = String(value.currencyCode ?? "").toUpperCase()
  if (typeof value.projectSlug !== "string" || !SLUG.test(value.projectSlug) || !Number.isInteger(value.paymentId) || Number(value.paymentId) <= 0 ||
      !["CAD", "USD"].includes(currencyCode) || typeof value.expectedAmountMinor !== "string" || !/^[1-9]\d*$/.test(value.expectedAmountMinor)) {
    return edgeCommandFailure("invalid_payload", "Canadian PAD fields are invalid.")
  }
  return edgeCommandSuccess({ projectSlug: value.projectSlug, paymentId: Number(value.paymentId),
    currencyCode: currencyCode as StripeAcssDebitCurrency, expectedAmountMinor: value.expectedAmountMinor })
}

export function isStripeAcssDebitCheckoutCreateOutput(value: unknown): value is StripeAcssDebitCheckoutCreateOutput {
  return isObject(value) && typeof value.commandId === "string" && /^[0-9a-f-]{36}$/.test(value.commandId) &&
    typeof value.checkoutSessionId === "string" && /^cs_test_[A-Za-z0-9]+$/.test(value.checkoutSessionId) &&
    typeof value.checkoutUrl === "string" && value.checkoutUrl.startsWith("https://checkout.stripe.com/") &&
    (value.currencyCode === "CAD" || value.currencyCode === "USD") && typeof value.expectedAmountMinor === "string" &&
    /^[1-9]\d*$/.test(value.expectedAmountMinor) && value.status === "checkout_created" && value.sandboxOnly === true
}

export type StripeAcssDebitObservation = {
  evidenceType: "checkout_completed" | "processing" | "settled_available" | "failed" | "canceled" | "refunded" | "disputed" | "dispute_won" | "dispute_lost"
  commandId: string
  providerObjectId: string
  providerCheckoutSessionId: string | null
  providerPaymentIntentId: string | null
  providerChargeId: string | null
  providerMandateId: string | null
  providerBalanceTransactionId: string | null
  currencyCode: StripeAcssDebitCurrency
  grossAmountMinor: string
  feeAmountMinor: string | null
  netAmountMinor: string | null
  balanceStatus: "pending" | "available" | null
  paymentMethodType: string | null
}
