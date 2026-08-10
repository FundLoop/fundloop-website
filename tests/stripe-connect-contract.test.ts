import { describe, expect, it } from "vitest"
import { validateStripeConnectAccountInput, validateStripeConnectPayoutInput } from "@/lib/edge-functions/stripe-connect-contract"

describe("Stripe Connect Edge contracts", () => {
  it("accepts exact hosted account actions and rejects caller-owned redirects", () => {
    expect(validateStripeConnectAccountInput({ action: "onboard", countryCode: "CA", defaultCurrency: "CAD" }).ok).toBe(true)
    expect(validateStripeConnectAccountInput({ action: "refresh" }).ok).toBe(true)
    expect(validateStripeConnectAccountInput({ action: "manage" }).ok).toBe(true)
    expect(validateStripeConnectAccountInput({ action: "onboard", countryCode: "CA", defaultCurrency: "CAD", returnUrl: "https://evil.example" }).ok).toBe(false)
    expect(validateStripeConnectAccountInput({ action: "onboard", countryCode: "GB", defaultCurrency: "GBP" }).ok).toBe(false)
  })
  it("accepts only a numeric persisted payout intent", () => {
    expect(validateStripeConnectPayoutInput({ action: "submit", payoutIntentId: 7 }).ok).toBe(true)
    expect(validateStripeConnectPayoutInput({ action: "submit", payoutIntentId: 7, providerAccountId: "acct_forged" }).ok).toBe(false)
    expect(validateStripeConnectPayoutInput({ action: "submit", payoutIntentId: 0 }).ok).toBe(false)
  })
})
