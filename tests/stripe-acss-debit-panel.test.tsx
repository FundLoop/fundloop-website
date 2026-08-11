import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StripeAcssDebitPanel } from "@/components/stripe-acss-debit-panel"
import { invokeStripeAcssDebitCheckoutBrowser } from "@/lib/edge-functions/stripe-acss-debit-checkout"
import { invokeStripeAcssDebitStatusBrowser } from "@/lib/edge-functions/stripe-acss-debit-status"

vi.mock("@/lib/edge-functions/stripe-acss-debit-checkout", () => ({invokeStripeAcssDebitCheckoutBrowser: vi.fn()}))
vi.mock("@/lib/edge-functions/stripe-acss-debit-status", () => ({invokeStripeAcssDebitStatusBrowser: vi.fn()}))
const payment = {id: 7, paymentAmount: 25, statusCode: "draft", periodStart: "2026-08-01", periodEnd: "2026-08-31"}

describe("StripeAcssDebitPanel", () => {
  it("shows privacy/delayed-settlement copy and keeps acknowledgement gate", async () => {
    vi.mocked(invokeStripeAcssDebitStatusBrowser).mockResolvedValue({ok: true, data: []})
    render(<StripeAcssDebitPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged={false}/>)
    expect((await screen.findByText(/FundLoop never receives your bank account details/i)).textContent).toMatch(/never receives/i)
    expect(screen.getByText(/Returning from Checkout does not fund the project/i).textContent).toMatch(/does not fund/i)
    expect((screen.getByRole("button", {name: /Open CAD PAD Checkout/i}) as HTMLButtonElement).disabled).toBe(true)
  })

  it("submits only CAD quote dimensions and project identifiers", async () => {
    vi.mocked(invokeStripeAcssDebitStatusBrowser).mockResolvedValue({ok: true, data: []})
    vi.mocked(invokeStripeAcssDebitCheckoutBrowser).mockResolvedValue({ok: false, error: {code: "unavailable", message: "Capability unavailable."}})
    render(<StripeAcssDebitPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged/>)
    fireEvent.click(await screen.findByRole("button", {name: /Open CAD PAD Checkout/i}))
    await waitFor(() => expect(invokeStripeAcssDebitCheckoutBrowser).toHaveBeenCalledWith({projectSlug: "ecostream", paymentId: 7, currencyCode: "CAD"}))
    expect(screen.getByTestId("stripe-acss-payment-7").textContent).toMatch(/USD obligation \$25\.00/)
    expect((await screen.findByRole("alert")).textContent).toBe("Capability unavailable.")
  })

  it.each([
    ["checkout_created", false, false, /Authorization required in Stripe-hosted Checkout/i],
    ["processing", false, false, /settlement is pending and not fundable/i],
    ["settled_available", true, false, /Reconciled: available custody/i],
    ["refunded", false, true, /Reversed and removed from package eligibility/i],
  ] as const)("renders the %s lifecycle state", async (status, availableForPackage, reversed, copy) => {
    vi.mocked(invokeStripeAcssDebitStatusBrowser).mockResolvedValue({ok: true, data: [{commandId: "00000000-0000-4000-8000-000000000001",
      paymentId: 7, currencyCode: "CAD", expectedAmountMinor: "2500", status, statusAt: "2026-08-11T00:00:00Z",
      availableForPackage, reversed}]})
    render(<StripeAcssDebitPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged/>)
    expect(await screen.findByText(copy)).toBeTruthy()
    if (reversed) expect((screen.getByRole("button", {name: /New payment required/i}) as HTMLButtonElement).disabled).toBe(true)
  })
})
