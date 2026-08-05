import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WithdrawalRequestPanel } from "@/components/workspace/withdrawal-request-panel"

const { createRequest } = vi.hoisted(() => ({ createRequest: vi.fn() }))
vi.mock("@/lib/edge-functions/user-withdrawal-request", () => ({ invokeUserWithdrawalRequestCreate: createRequest }))

describe("WithdrawalRequestPanel", () => {
  beforeEach(() => vi.clearAllMocks())

  it("submits eligible credited earnings as requested and not paid", async () => {
    createRequest.mockResolvedValue({ ok: true, data: { requestId: "req-1", payoutRouteId: 3, status: "requested",
      requestedUsdAmount: 125, currencyCode: "USD", creditCount: 2, requestedAt: "2026-08-05T00:00:00Z", noPayoutExecuted: true } })
    render(<WithdrawalRequestPanel eligibleUsd={125} defaultRoute={{ id: 3, label: "Primary route" }} initialRequests={[]} />)
    fireEvent.click(screen.getByRole("button", { name: "Request $125.00" }))
    expect(await screen.findByText("$125.00 requested")).toBeTruthy()
    expect(screen.getByText(/no payout executed/)).toBeTruthy()
    expect(screen.getByText("Requested · not paid")).toBeTruthy()
  })

  it("requires an active default route", () => {
    render(<WithdrawalRequestPanel eligibleUsd={50} defaultRoute={null} initialRequests={[]} />)
    expect(screen.getByRole("button", { name: "Default payout route required" }).getAttribute("disabled")).not.toBeNull()
  })
})
