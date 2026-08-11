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

  it("submits only CAD amount and project identifiers", async () => {
    vi.mocked(invokeStripeAcssDebitStatusBrowser).mockResolvedValue({ok: true, data: []})
    vi.mocked(invokeStripeAcssDebitCheckoutBrowser).mockResolvedValue({ok: false, error: {code: "unavailable", message: "Capability unavailable."}})
    render(<StripeAcssDebitPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged/>)
    fireEvent.click(await screen.findByRole("button", {name: /Open CAD PAD Checkout/i}))
    await waitFor(() => expect(invokeStripeAcssDebitCheckoutBrowser).toHaveBeenCalledWith({projectSlug: "ecostream", paymentId: 7, currencyCode: "CAD", expectedAmountMinor: "2500"}))
    expect((await screen.findByRole("alert")).textContent).toBe("Capability unavailable.")
  })
})
