import { edgeCommandFailure, edgeCommandSuccess } from "../edge-functions/result.ts"

export const STRIPE_PAY_BY_BANK_ENVIRONMENTS = ["local", "development", "dev", "preview", "test"] as const
export type StripePayByBankCurrency = "EUR" | "GBP"
export type StripePayByBankCustomerCountry = "FI" | "FR" | "DE" | "IE" | "GB"

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)

export type StripePayByBankCheckoutCreateInput = {
  projectSlug: string
  paymentId: number
  currencyCode: StripePayByBankCurrency
  customerCountry: StripePayByBankCustomerCountry
}

export type StripePayByBankCheckoutCreateOutput = {
  commandId: string
  checkoutSessionId: string
  checkoutUrl: string
  currencyCode: StripePayByBankCurrency
  expectedAmountMinor: string
  status: "checkout_created"
  sandboxOnly: true
}

export type StripePayByBankStatus = {
  commandId: string
  paymentId: number
  currencyCode: StripePayByBankCurrency
  expectedAmountMinor: string
  status: string
  statusAt: string | null
  availableForPackage: boolean
  reversed: boolean
}

export function validateStripePayByBankCheckoutCreateInput(value: unknown, environment: string) {
  if (!STRIPE_PAY_BY_BANK_ENVIRONMENTS.includes(environment as (typeof STRIPE_PAY_BY_BANK_ENVIRONMENTS)[number])) {
    return edgeCommandFailure("production_disabled", "Pay by Bank intake is unavailable in this environment.")
  }
  if (!isObject(value)) return edgeCommandFailure("invalid_payload", "Expected an object.")
  const allowed = new Set(["projectSlug", "paymentId", "currencyCode", "customerCountry"])
  if (Object.keys(value).some((key) => !allowed.has(key))) return edgeCommandFailure("invalid_payload", "Unexpected Pay by Bank input field.")
  const currencyCode = String(value.currencyCode ?? "").toUpperCase()
  if (typeof value.projectSlug !== "string" || !SLUG.test(value.projectSlug) || !Number.isInteger(value.paymentId) || Number(value.paymentId) <= 0 ||
      !["EUR", "GBP"].includes(currencyCode) || !["FI", "FR", "DE", "IE", "GB"].includes(String(value.customerCountry ?? "").toUpperCase())) {
    return edgeCommandFailure("invalid_payload", "Pay by Bank fields are invalid.")
  }
  return edgeCommandSuccess({ projectSlug: value.projectSlug, paymentId: Number(value.paymentId),
    currencyCode: currencyCode as StripePayByBankCurrency,
    customerCountry: String(value.customerCountry).toUpperCase() as StripePayByBankCustomerCountry })
}

export function isStripePayByBankCheckoutCreateOutput(value: unknown): value is StripePayByBankCheckoutCreateOutput {
  return isObject(value) && typeof value.commandId === "string" && /^[0-9a-f-]{36}$/.test(value.commandId) &&
    typeof value.checkoutSessionId === "string" && /^cs_test_[A-Za-z0-9]+$/.test(value.checkoutSessionId) &&
    typeof value.checkoutUrl === "string" && value.checkoutUrl.startsWith("https://checkout.stripe.com/") &&
    (value.currencyCode === "EUR" || value.currencyCode === "GBP") && typeof value.expectedAmountMinor === "string" &&
    /^[1-9]\d*$/.test(value.expectedAmountMinor) && value.status === "checkout_created" && value.sandboxOnly === true
}

export type StripePayByBankObservation = {
  evidenceType: "checkout_completed" | "processing" | "settled_available" | "failed" | "canceled" | "expired" | "refund_pending" | "refunded" | "refund_failed"
  commandId: string
  providerObjectId: string
  providerCheckoutSessionId: string | null
  providerPaymentIntentId: string | null
  providerChargeId: string | null
  providerRefundId: string | null
  providerBalanceTransactionId: string | null
  currencyCode: StripePayByBankCurrency
  grossAmountMinor: string
  refundAmountMinor: string | null
  cumulativeRefundedAmountMinor: string | null
  feeAmountMinor: string | null
  netAmountMinor: string | null
  balanceStatus: "pending" | "available" | null
  paymentMethodType: string | null
  customerCountry: StripePayByBankCustomerCountry | null
}
