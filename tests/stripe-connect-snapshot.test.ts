import { describe, expect, it } from "vitest"
import { buildStripeConnectAccountSnapshot } from "@/lib/stripe/stripe-connect-snapshot"

describe("Stripe Connect account snapshot", () => {
  it("requires completed details, payouts, external account, and no current requirements", () => {
    const ready = buildStripeConnectAccountSnapshot({ id: "acct_ready", country: "CA", default_currency: "cad", details_submitted: true, payouts_enabled: true,
      requirements: { currently_due: [], eventually_due: [], disabled_reason: null }, external_accounts: { data: [{ object: "bank_account", last4: "6789", status: "verified" }] } } as never,
      new Date("2026-08-10T12:00:00Z"))
    expect(ready).toMatchObject({ onboardingStatus: "ready", externalAccountLast4: "6789", defaultCurrency: "CAD" })
    const changed = buildStripeConnectAccountSnapshot({ ...({ id: "acct_ready", country: "CA", default_currency: "cad", details_submitted: true, payouts_enabled: false } as object),
      requirements: { currently_due: ["individual.verification.document"], eventually_due: [], disabled_reason: "requirements.past_due" }, external_accounts: { data: [] } } as never)
    expect(changed).toMatchObject({ onboardingStatus: "requirements_due", payoutsEnabled: false, externalAccountEnabled: false, currentlyDueCount: 1 })
  })
})
