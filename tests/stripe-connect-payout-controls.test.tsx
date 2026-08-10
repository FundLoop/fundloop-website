import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StripeConnectPayoutControls } from "@/components/admin/stripe-connect-payout-controls"
import { invokeStripeConnectPayout } from "@/lib/edge-functions/stripe-connect-payout"

vi.mock("@/lib/edge-functions/stripe-connect-payout", () => ({ invokeStripeConnectPayout: vi.fn() }))
const account = { id: 1, user_id: "user", onboarding_status: "ready", country_code: "CA", default_currency: "CAD", payouts_enabled: true,
  external_account_enabled: true, external_account_last4: "1414", currently_due_count: 0, disabled_reason: null }
describe("StripeConnectPayoutControls", () => {
  it("submits only the persisted intent ID and labels settlement as pending", async () => {
    vi.mocked(invokeStripeConnectPayout).mockResolvedValue({ ok: false, error: { code: "sandbox", message: "sandbox checkpoint unavailable" } })
    render(<StripeConnectPayoutControls enabled accounts={[account]} commands={[]} intents={[{ id: 7, user_id: "user", rail: "fiat_stub", status: "draft", amount_usd: 10, payout_route_id: 1 }]} />)
    expect(screen.getByText("Bank ••••1414 · 0 due")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Submit sandbox payout" }))
    await waitFor(() => expect(invokeStripeConnectPayout).toHaveBeenCalledWith({ action: "submit", payoutIntentId: 7 }))
    expect(await screen.findByText("sandbox checkpoint unavailable")).toBeTruthy()
  })
  it("does not render payout actions when production is closed", () => {
    render(<StripeConnectPayoutControls enabled={false} accounts={[]} commands={[]} intents={[]} />)
    expect(screen.getByTestId("stripe-connect-operator-closed")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull()
  })
})
