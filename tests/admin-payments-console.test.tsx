import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PaymentsConsole } from "@/components/admin/payments-console"

const { invokeAdminPaymentReceiptConfirmBrowser, toast } = vi.hoisted(() => ({
  invokeAdminPaymentReceiptConfirmBrowser: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/lib/edge-functions/admin-payment-operations", () => ({
  invokeAdminPaymentReceiptConfirmBrowser,
}))

vi.mock("@/components/ui/use-toast", () => ({
  toast,
}))

const payment = {
  id: 22,
  project_id: 7,
  project_name: "FundLoop Studio",
  project_slug: "fundloop-studio",
  period_start: "2026-04-01T00:00:00.000Z",
  period_end: "2026-04-30T00:00:00.000Z",
  revenue: 1000,
  payment_amount: 100,
  payment_method_name: "manual",
  status_code: "awaiting_confirmation",
  status_name: "Awaiting Confirmation",
  notes: null,
  updated_at: "2026-04-10T00:00:00.000Z",
  confirmed_at: null,
  latest_onchain_submission: null,
}

describe("PaymentsConsole", () => {
  beforeEach(() => {
    invokeAdminPaymentReceiptConfirmBrowser.mockReset()
    toast.mockReset()
  })

  it("confirms a manual payment through the admin Edge adapter", async () => {
    invokeAdminPaymentReceiptConfirmBrowser.mockResolvedValue({
      ok: true,
      data: {
        paymentId: 22,
        statusCode: "confirmed",
        confirmedAt: "2026-04-26T18:30:00.000Z",
      },
    })

    render(<PaymentsConsole initialPayments={[payment] as never} />)

    fireEvent.click(screen.getAllByRole("button", { name: /confirm receipt/i })[0])
    fireEvent.click(screen.getByRole("button", { name: /^confirm receipt$/i }))

    await waitFor(() => {
      expect(invokeAdminPaymentReceiptConfirmBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 22,
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0)
    })
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Payment confirmed",
      }),
    )
  })
})
