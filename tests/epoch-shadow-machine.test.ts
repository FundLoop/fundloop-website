import { describe, expect, it } from "vitest"
import {
  emailRelativeOptOutDeadline, epochLegacyCompatibility, epochShadowStages,
  evaluateEpochTransition, pacificMonthEndCutoff, pacificLocalToUtc, payoutExpiryAt,
} from "@/lib/monthly-cycles/epoch-shadow-machine"
import { validateEpochShadowSchedulerInput } from "@/lib/edge-functions/epoch-shadow-scheduler-contract"

describe("epoch shadow state machine", () => {
  it("keeps the approved 12-stage order and conservative compatibility", () => {
    expect(epochShadowStages).toHaveLength(12)
    expect(epochLegacyCompatibility.payout_open).toBe("distribution")
    expect(epochLegacyCompatibility.closed).toBe("reporting")
  })

  it("uses Pacific calendar boundaries across DST and month length", () => {
    expect(pacificLocalToUtc(2026, 3, 1).toISOString()).toBe("2026-03-01T08:00:00.000Z")
    expect(pacificLocalToUtc(2026, 4, 1).toISOString()).toBe("2026-04-01T07:00:00.000Z")
    expect(pacificMonthEndCutoff(2026, 2).toISOString()).toBe("2026-03-01T08:00:00.000Z")
  })

  it("skips weekends and holidays for email-relative opt out", () => {
    const deadline = emailRelativeOptOutDeadline(new Date("2026-08-07T18:00:00Z"), new Set(["2026-08-10"]))
    expect(deadline.toISOString()).toBe("2026-08-12T07:00:00.000Z")
  })

  it("evaluates cutoff, expiry, and carryover close with a fake clock", () => {
    expect(evaluateEpochTransition({ stage: "collecting", now: new Date("2026-09-01T07:00:00Z"), periodEnd: new Date("2026-09-01T07:00:00Z") })).toBe("reconciling")
    const opened = new Date("2026-08-15T18:00:00Z")
    expect(payoutExpiryAt(opened).toISOString()).toBe("2026-11-01T07:00:00.000Z")
    expect(evaluateEpochTransition({ stage: "payout_open", now: new Date("2026-11-01T07:00:00Z"), payoutOpenedAt: opened })).toBe("expired")
    expect(evaluateEpochTransition({ stage: "expired", now: new Date(), carryoverComplete: true })).toBe("closed")
    expect(evaluateEpochTransition({ stage: "reconciling", now: new Date("2026-09-02T00:00:00Z"), stageReadyAt: new Date("2026-09-01T00:00:00Z") })).toBe("valuing")
    expect(evaluateEpochTransition({ stage: "reviewing", now: new Date("2026-08-12T07:00:00Z"), optOutDeadline: new Date("2026-08-12T07:00:00Z") })).toBe("payout_readying")
  })

  it("rejects fake clock use when the trusted environment is production", () => {
    expect(validateEpochShadowSchedulerInput({ fakeNow: "2026-09-01T07:00:00Z" }, "production")).toMatchObject({ ok: false })
    expect(validateEpochShadowSchedulerInput({ fakeNow: "2026-09-01T07:00:00Z" }, "local")).toMatchObject({ ok: true })
  })
})
