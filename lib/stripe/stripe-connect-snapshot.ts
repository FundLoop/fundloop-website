export type StripeConnectAccountSnapshot = {
  providerAccountId: string
  countryCode: "US" | "CA"
  defaultCurrency: "USD" | "CAD"
  onboardingStatus: "incomplete" | "requirements_due" | "ready" | "restricted"
  detailsSubmitted: boolean
  payoutsEnabled: boolean
  externalAccountEnabled: boolean
  externalAccountLast4: string
  currentlyDueCount: number
  eventuallyDueCount: number
  disabledReason: string
  providerUpdatedAt: string
}

type StripeConnectAccountInput = {
  id: string
  country?: string | null
  default_currency?: string | null
  details_submitted?: boolean
  payouts_enabled?: boolean
  requirements?: {
    currently_due?: string[] | null
    eventually_due?: string[] | null
    disabled_reason?: string | null
  } | null
  external_accounts?: {
    data: Array<{ object: string; last4?: string | null; status?: string | null }>
  } | null
}

export function buildStripeConnectAccountSnapshot(account: StripeConnectAccountInput, observedAt = new Date()): StripeConnectAccountSnapshot {
  const bank = account.external_accounts?.data.find((item) => item.object === "bank_account")
  const currentlyDue = account.requirements?.currently_due ?? []
  const eventuallyDue = account.requirements?.eventually_due ?? []
  const externalAccountEnabled = Boolean(bank && !["errored", "verification_failed"].includes(bank.status ?? ""))
  const onboardingStatus = !account.details_submitted ? "incomplete" : account.payouts_enabled && externalAccountEnabled && currentlyDue.length === 0
    ? "ready" : currentlyDue.length > 0 ? "requirements_due" : "restricted"
  const country = account.country?.toUpperCase() === "CA" ? "CA" : "US"
  const currency = account.default_currency?.toUpperCase() === "CAD" ? "CAD" : "USD"
  return { providerAccountId: account.id, countryCode: country, defaultCurrency: currency, onboardingStatus,
    detailsSubmitted: Boolean(account.details_submitted), payoutsEnabled: Boolean(account.payouts_enabled), externalAccountEnabled,
    externalAccountLast4: bank?.last4 ?? "", currentlyDueCount: currentlyDue.length, eventuallyDueCount: eventuallyDue.length,
    disabledReason: account.requirements?.disabled_reason ?? "", providerUpdatedAt: observedAt.toISOString() }
}
