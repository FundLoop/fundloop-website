import { describe, expect, it, vi } from "vitest"
import { createStripeAcssDebitCheckout } from "@/lib/execution/adapters/stripe-acss-debit"
import { validateStripeAcssDebitCheckoutCreateInput } from "@/lib/stripe/stripe-acss-debit-contract"

const input = {projectSlug: "ecostream", paymentId: 7, currencyCode: "CAD" as const}
const adapterInput = {environment: "local", commandId: "00000000-0000-4000-8000-000000000001", projectId: 1, projectSlug: "ecostream",
  paymentId: 7, amountMinor: "2500", currencyCode: "CAD" as const, actorUserId: "actor", paymentMethodConfigurationId: "pmc_test123",
  appOrigin: "http://127.0.0.1:3000", usdAccountEvidenceVerified: false}

describe("Stripe ACSS debit contract", () => {
  it("accepts CAD locally and rejects production and hostile fields", () => {
    expect(validateStripeAcssDebitCheckoutCreateInput(input, "local")).toMatchObject({ok: true})
    expect(validateStripeAcssDebitCheckoutCreateInput(input, "production")).toMatchObject({ok: false, error: {code: "production_disabled"}})
    expect(validateStripeAcssDebitCheckoutCreateInput({...input, accountNumber: "secret"}, "local")).toMatchObject({ok: false, error: {code: "invalid_payload"}})
    expect(validateStripeAcssDebitCheckoutCreateInput({...input, expectedAmountMinor: "2500"}, "local")).toMatchObject({ok: false, error: {code: "invalid_payload"}})
  })

  it("requires capability and configuration evidence before mutation", async () => {
    const createCheckoutSession = vi.fn()
    const result = await createStripeAcssDebitCheckout({discoverCapability: async () => ({accountId: "acct_test", livemode: false, acssDebitActive: false, configurationActive: true}), createCheckoutSession}, adapterInput)
    expect(result).toMatchObject({ok: false, error: {code: "stripe_acss_debit_not_enabled"}})
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it("uses hosted Checkout, dynamic configuration, stable idempotency, and no reusable mandate input", async () => {
    const createCheckoutSession = vi.fn(async () => ({id: "cs_test_fixture", url: "https://checkout.stripe.com/c/pay/test", livemode: false}))
    const result = await createStripeAcssDebitCheckout({discoverCapability: async () => ({accountId: "acct_test", livemode: false, acssDebitActive: true, configurationActive: true}), createCheckoutSession}, adapterInput)
    expect(result).toMatchObject({ok: true, data: {checkoutSessionId: "cs_test_fixture"}})
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({idempotencyKey: `fundloop:pad:${adapterInput.commandId}`, paymentMethodConfigurationId: "pmc_test123", integrationIdentifier: "fundloop-pad-00000001"}))
    const call = createCheckoutSession.mock.calls[0] as unknown as [{idempotencyKey: string}]
    expect(JSON.stringify(call[0])).not.toContain("payment_method_types")
    expect(JSON.stringify(call[0])).not.toContain("setup_future_usage")
  })

  it("denies USD before provider discovery without exact-account evidence", async () => {
    const discoverCapability = vi.fn()
    const result = await createStripeAcssDebitCheckout({discoverCapability, createCheckoutSession: vi.fn()}, {...adapterInput, currencyCode: "USD"})
    expect(result).toMatchObject({ok: false, error: {code: "usd_account_evidence_required"}})
    expect(discoverCapability).not.toHaveBeenCalled()
  })
})
