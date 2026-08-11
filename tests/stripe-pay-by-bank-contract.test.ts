import { describe, expect, it, vi } from "vitest"
import { createStripePayByBankCheckout } from "@/lib/execution/adapters/stripe-pay-by-bank"
import { validateStripePayByBankCheckoutCreateInput } from "@/lib/stripe/stripe-pay-by-bank-contract"

const input = {projectSlug: "ecostream", paymentId: 7, currencyCode: "GBP" as const, expectedAmountMinor: "2500", customerCountry: "GB" as const}
const adapterInput = {environment: "local", commandId: "00000000-0000-4000-8000-000000000001", projectId: 1, projectSlug: "ecostream",
  paymentId: 7, amountMinor: "2500", currencyCode: "GBP" as const, customerCountry: "GB" as const,
  actorUserId: "actor", paymentMethodConfigurationId: "pmc_test123", appOrigin: "http://127.0.0.1:3000"}
const capability = {accountId: "acct_test", livemode: false, merchantCountry: "CA", payByBankActive: true,
  configurationActive: true, chargeTopology: "platform" as const, privatePreviewCountries: []}

describe("Stripe Pay by Bank contract", () => {
  it("accepts EUR/GBP locally and rejects production, unsupported countries, and hostile fields", () => {
    expect(validateStripePayByBankCheckoutCreateInput(input, "local")).toMatchObject({ok: true})
    expect(validateStripePayByBankCheckoutCreateInput(input, "production")).toMatchObject({ok: false, error: {code: "production_disabled"}})
    expect(validateStripePayByBankCheckoutCreateInput({...input, accountNumber: "secret"}, "local")).toMatchObject({ok: false, error: {code: "invalid_payload"}})
    expect(validateStripePayByBankCheckoutCreateInput({...input, customerCountry: "CA"}, "local")).toMatchObject({ok: false, error: {code: "invalid_payload"}})
  })

  it("requires capability and configuration evidence before mutation", async () => {
    const createCheckoutSession = vi.fn()
    const result = await createStripePayByBankCheckout({discoverCapability: async () => ({...capability, payByBankActive: false}), createCheckoutSession}, adapterInput)
    expect(result).toMatchObject({ok: false, error: {code: "stripe_pay_by_bank_not_enabled"}})
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it("uses hosted Checkout, dynamic configuration, stable idempotency, and no reusable bank input", async () => {
    const createCheckoutSession = vi.fn(async () => ({id: "cs_test_fixture", url: "https://checkout.stripe.com/c/pay/test", livemode: false}))
    const result = await createStripePayByBankCheckout({discoverCapability: async () => capability, createCheckoutSession}, adapterInput)
    expect(result).toMatchObject({ok: true, data: {checkoutSessionId: "cs_test_fixture"}})
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({idempotencyKey: `fundloop:pay-by-bank:${adapterInput.commandId}`, paymentMethodConfigurationId: "pmc_test123", integrationIdentifier: "fundloop-pay-by-bank-00000001"}))
    const call = createCheckoutSession.mock.calls[0] as unknown as [{idempotencyKey: string}]
    expect(JSON.stringify(call[0])).not.toContain("payment_method_types")
    expect(JSON.stringify(call[0])).not.toContain("setup_future_usage")
  })

  it("denies private-preview countries before mutation without exact enablement", async () => {
    const createCheckoutSession = vi.fn()
    const result = await createStripePayByBankCheckout({discoverCapability: async () => capability, createCheckoutSession},
      {...adapterInput, currencyCode: "EUR", customerCountry: "DE"})
    expect(result).toMatchObject({ok: false, error: {code: "private_preview_unavailable"}})
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })
})
