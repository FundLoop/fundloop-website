import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StripePayByBankPanel } from "@/components/stripe-pay-by-bank-panel"
import { invokeStripePayByBankCheckoutBrowser } from "@/lib/edge-functions/stripe-pay-by-bank-checkout"
import { invokeStripePayByBankStatusBrowser } from "@/lib/edge-functions/stripe-pay-by-bank-status"

vi.mock("@/lib/edge-functions/stripe-pay-by-bank-checkout", () => ({invokeStripePayByBankCheckoutBrowser: vi.fn()}))
vi.mock("@/lib/edge-functions/stripe-pay-by-bank-status", () => ({invokeStripePayByBankStatusBrowser: vi.fn()}))
const payment = {id: 7, paymentAmount: 25, statusCode: "draft", periodStart: "2026-08-01", periodEnd: "2026-08-31"}

describe("StripePayByBankPanel", () => {
  it("shows privacy/delayed-settlement copy and keeps acknowledgement gate", async () => {
    vi.mocked(invokeStripePayByBankStatusBrowser).mockResolvedValue({ok: true, data: []})
    render(<StripePayByBankPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged={false}/>)
    expect((await screen.findByText(/FundLoop never receives your bank credentials/i)).textContent).toMatch(/never receives/i)
    expect(screen.getByText(/Returning from Checkout does not fund the project/i).textContent).toMatch(/does not fund/i)
    expect((screen.getByRole("button", {name: /Open Pay by Bank Checkout/i}) as HTMLButtonElement).disabled).toBe(true)
  })

  it("submits only selected currency/country, amount, and project identifiers", async () => {
    vi.mocked(invokeStripePayByBankStatusBrowser).mockResolvedValue({ok: true, data: []})
    vi.mocked(invokeStripePayByBankCheckoutBrowser).mockResolvedValue({ok: false, error: {code: "unavailable", message: "Capability unavailable."}})
    render(<StripePayByBankPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged/>)
    fireEvent.click(await screen.findByRole("button", {name: /Open Pay by Bank Checkout/i}))
    await waitFor(() => expect(invokeStripePayByBankCheckoutBrowser).toHaveBeenCalledWith({projectSlug: "ecostream", paymentId: 7,
      currencyCode: "GBP", customerCountry: "GB", expectedAmountMinor: "2500"}))
    expect((await screen.findByRole("alert")).textContent).toBe("Capability unavailable.")
  })

  it.each([
    ["checkout_created", false, false, /Authorization required in Stripe-hosted Checkout/i],
    ["processing", false, false, /settlement is pending and not fundable/i],
    ["settled_available", true, false, /Reconciled: available custody/i],
    ["refunded", false, true, /Refunded and removed from package eligibility/i],
  ] as const)("renders the %s lifecycle state", async (status, availableForPackage, reversed, copy) => {
    vi.mocked(invokeStripePayByBankStatusBrowser).mockResolvedValue({ok: true, data: [{commandId: "00000000-0000-4000-8000-000000000001",
      paymentId: 7, currencyCode: "GBP", expectedAmountMinor: "2500", status, statusAt: "2026-08-11T00:00:00Z",
      availableForPackage, reversed}]})
    render(<StripePayByBankPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged/>)
    expect(await screen.findByText(copy)).toBeTruthy()
    if (reversed) expect((screen.getByRole("button", {name: /New payment required/i}) as HTMLButtonElement).disabled).toBe(true)
  })
})
