import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StripeConnectPanel } from "@/components/account/stripe-connect-panel"
import { invokeStripeConnectAccount } from "@/lib/edge-functions/stripe-connect-account"

vi.mock("@/lib/edge-functions/stripe-connect-account", () => ({ invokeStripeConnectAccount: vi.fn() }))
describe("StripeConnectPanel", () => {
  it("starts unconnected with no raw bank fields and launches hosted onboarding", async () => {
    vi.mocked(invokeStripeConnectAccount).mockResolvedValue({ ok: true, data: { redirectUrl: "https://connect.stripe.test/onboard" } })
    const assign = vi.fn()
    render(<StripeConnectPanel initial={{ available: true, account: null, payouts: [] }} onRedirect={assign} />)
    expect(screen.getByText(/FundLoop retains only readiness/)).toBeTruthy(); expect(document.body.textContent).not.toContain("routing number")
    fireEvent.click(screen.getByRole("button", { name: /Start hosted onboarding/ }))
    await waitFor(() => expect(invokeStripeConnectAccount).toHaveBeenCalledWith({ action: "onboard", countryCode: "CA", defaultCurrency: "CAD" }))
    expect(assign).toHaveBeenCalledWith("https://connect.stripe.test/onboard")
  })
  it("shows requirements and redacted destination without marking payouts paid", () => {
    render(<StripeConnectPanel initial={{ available: true, account: { status: "requirements_due", countryCode: "US", defaultCurrency: "USD", payoutsEnabled: false,
      externalAccountEnabled: true, externalAccountLast4: "4242", currentlyDueCount: 2, disabledReason: "requirements.past_due", updatedAt: "2026-08-10T00:00:00Z" },
      payouts: [{ id: 4, currencyCode: "USD", grossMinor: "1000", feeMinor: "25", netMinor: "975", status: "needs_remediation", failureCode: "account_closed", createdAt: "2026-08-10T00:00:00Z", settledAt: null }] }} />)
    expect(screen.getByText("Bank ••••4242")).toBeTruthy(); expect(screen.getByText(/requires 2 updates/)).toBeTruthy(); expect(screen.getByText("needs remediation")).toBeTruthy()
  })
  it("renders a production-safe unavailable state", () => {
    render(<StripeConnectPanel initial={{ available: false, account: null, payouts: [] }} />)
    expect(screen.getByTestId("stripe-connect-production-closed")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull()
  })
})
