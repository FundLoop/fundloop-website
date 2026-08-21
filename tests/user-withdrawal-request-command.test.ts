import { describe, expect, it, vi } from "vitest"
import { executeUserWithdrawalRequestCreate } from "@/lib/withdrawals/user-withdrawal-request-command"

describe("user withdrawal request v2 command", () => {
  function acknowledgedClient(rpc: ReturnType<typeof vi.fn>) {
    return { from: vi.fn(() => ({ select() { return this }, eq() { return this }, maybeSingle: vi.fn(async () => ({ data: { id: "acceptance-1" }, error: null })) })), rpc }
  }
  const input = { action: "create" as const, actorUserId: "user-1", deploymentEnvironment: "local", payoutRouteId: 3,
    requestedMinor: 12500, projectId: 7, assetKey: "stripe_sandbox_usd", userFeeBps: 0, idempotencyKey: "request-123" }

  it("maps a backed partial reservation without claiming payment", async () => {
    const rpc = vi.fn(async () => ({ data: { requestId: "req-1", status: "reserved", requestedMinor: "12500", feeMinor: "0",
      netMinor: "12500", assetKey: "stripe_sandbox_usd", railKey: "stripe_bank_transfer", payoutIntentId: 9, noPayoutExecuted: true }, error: null }))
    const result = await executeUserWithdrawalRequestCreate(acknowledgedClient(rpc) as never, input)
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ requestId: "req-1", status: "reserved", noPayoutExecuted: true }) })
    expect(rpc).toHaveBeenCalledWith("create_user_withdrawal_request_v3", expect.objectContaining({ p_command: expect.objectContaining({ requestedMinor: 12500, projectId: 7 }) }))
  })

  it("maps depleted inventory to a queue with no payout intent", async () => {
    const rpc = vi.fn(async () => ({ data: { requestId: "req-1", status: "queued", requestedMinor: "12500", feeMinor: "0",
      netMinor: "12500", assetKey: "stripe_sandbox_usd", railKey: "stripe_bank_transfer", payoutIntentId: null, noPayoutExecuted: true }, error: null }))
    expect(await executeUserWithdrawalRequestCreate(acknowledgedClient(rpc) as never, input)).toEqual({ ok: true, data: expect.objectContaining({ status: "queued", payoutIntentId: null }) })
  })

  it.each(["withdrawal_minimum_not_met", "withdrawal_asset_not_eligible", "withdrawal_available_amount_insufficient"])("maps %s safely", async (code) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: code } }))
    const result = await executeUserWithdrawalRequestCreate(acknowledgedClient(rpc) as never, input)
    expect(result).toMatchObject({ ok: false, error: { code } })
  })

  it("fails closed before Terms review acknowledgement", async () => {
    const rpc = vi.fn()
    const client = { from: vi.fn(() => ({ select() { return this }, eq() { return this }, maybeSingle: vi.fn(async () => ({ data: null, error: null })) })), rpc }
    const result = await executeUserWithdrawalRequestCreate(client as never, input)
    expect(result).toMatchObject({ ok: false, error: { code: "terms_review_acknowledgement_required" } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("uses the same typed boundary to cancel a request", async () => {
    const rpc = vi.fn(async () => ({ data: { requestId: "00000000-0000-4000-8000-000000000001", status: "cancelled", noPayoutExecuted: true }, error: null }))
    const result = await executeUserWithdrawalRequestCreate({ rpc } as never, { action: "cancel", requestId: "00000000-0000-4000-8000-000000000001",
      reason: "user_cancelled", actorUserId: "user-1", deploymentEnvironment: "local" })
    expect(result).toMatchObject({ ok: true, data: { status: "cancelled" } })
  })
})
