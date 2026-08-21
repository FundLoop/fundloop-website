import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WithdrawalRequestPanel } from "@/components/workspace/withdrawal-request-panel"

const { createRequest } = vi.hoisted(() => ({ createRequest: vi.fn() }))
vi.mock("@/lib/edge-functions/user-withdrawal-request", () => ({ invokeUserWithdrawalRequestCreate: createRequest }))

const assetOptions = [{ assetKey: "stripe_sandbox_usd", symbol: "USD", railKey: "stripe_bank_transfer" as const, projectId: 4, availableUsd: 125, lotCount: 2 }]

describe("WithdrawalRequestPanel", () => {
  beforeEach(() => vi.clearAllMocks())

  it("submits one route and project-linked asset as a partial reservation", async () => {
    createRequest.mockResolvedValue({ ok: true, data: { requestId: "req-1", status: "reserved", requestedMinor: "2500", feeMinor: "0",
      netMinor: "2500", assetKey: "stripe_sandbox_usd", railKey: "stripe_bank_transfer", payoutIntentId: 7, noPayoutExecuted: true } })
    render(<WithdrawalRequestPanel eligibleUsd={125} defaultRoute={{ id: 3, label: "Bank transfer", rail: "fiat_stub" }} assetOptions={assetOptions} initialRequests={[]} />)
    fireEvent.change(screen.getByLabelText("Amount (USD)"), { target: { value: "25" } })
    fireEvent.click(screen.getByRole("button", { name: "Reserve $25.00" }))
    expect(await screen.findByText("$25.00 · stripe_sandbox_usd")).toBeTruthy()
    expect(screen.getByText("Reserved")).toBeTruthy()
    expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({ action: "create", requestedMinor: 2500, projectId: 4, assetKey: "stripe_sandbox_usd" }))
  })

  it("enforces the Stripe minimum and requires eligible inventory", () => {
    render(<WithdrawalRequestPanel eligibleUsd={8} defaultRoute={{ id: 3, label: "Bank transfer", rail: "fiat_stub" }} assetOptions={[]} initialRequests={[]} />)
    expect(screen.getByRole("button", { name: "Eligible asset required" }).getAttribute("disabled")).not.toBeNull()
    expect(screen.getByText("Minimum $10.00 · partial requests allowed")).toBeTruthy()
  })
})
