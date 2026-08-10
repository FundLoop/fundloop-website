import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const STRIPE_CONNECT_ACCOUNT_FUNCTION = "stripe-connect-account"
export const STRIPE_CONNECT_PAYOUT_FUNCTION = "stripe-connect-payout-operator"

export type StripeConnectAccountInput =
  | { action: "onboard"; countryCode: "US" | "CA"; defaultCurrency: "USD" | "CAD" }
  | { action: "refresh" }
  | { action: "manage" }

export type StripeConnectPayoutInput = { action: "submit"; payoutIntentId: number }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|")
}

export function validateStripeConnectAccountInput(input: unknown): EdgeCommandResult<StripeConnectAccountInput> {
  const value = record(input)
  if (!value || typeof value.action !== "string") return edgeCommandFailure("invalid_payload", "A Stripe Connect account action is required.")
  if (value.action === "onboard" && exact(value, ["action", "countryCode", "defaultCurrency"]) &&
    (value.countryCode === "US" || value.countryCode === "CA") && (value.defaultCurrency === "USD" || value.defaultCurrency === "CAD")) {
    return edgeCommandSuccess({ action: "onboard", countryCode: value.countryCode, defaultCurrency: value.defaultCurrency })
  }
  if ((value.action === "refresh" || value.action === "manage") && exact(value, ["action"])) {
    return edgeCommandSuccess({ action: value.action })
  }
  return edgeCommandFailure("invalid_payload", "Unexpected Stripe Connect account fields are not allowed.")
}

export function validateStripeConnectPayoutInput(input: unknown): EdgeCommandResult<StripeConnectPayoutInput> {
  const value = record(input)
  if (value?.action === "submit" && exact(value, ["action", "payoutIntentId"]) && Number.isSafeInteger(value.payoutIntentId) && Number(value.payoutIntentId) > 0) {
    return edgeCommandSuccess({ action: "submit", payoutIntentId: Number(value.payoutIntentId) })
  }
  return edgeCommandFailure("invalid_payload", "A valid Stripe Connect payout intent is required.")
}
