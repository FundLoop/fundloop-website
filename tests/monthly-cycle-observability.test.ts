import { describe, expect, it } from "vitest"
import {
  buildMonthlyCycleObservabilityOverview,
  inferMonthlyCyclePipelineStage,
  summarizeMonthlyCyclePipelineEvents,
} from "@/lib/observability/monthly-cycle-events"

const baseEvent = {
  id: 1,
  monthly_cycle_id: 1,
  cycle_key: "2026-04",
  event_type: "lock_attempt",
  attempt_id: "attempt-1",
  actor_user_id: "admin-1",
  actor_role: "internal_admin",
  outcome: "attempt",
  severity: "info",
  message: "Lock started.",
  metadata: {},
  created_at: "2026-05-01T00:00:00Z",
}

describe("monthly cycle observability", () => {
  it("infers pipeline stages from event names", () => {
    expect(inferMonthlyCyclePipelineStage("lock_success")).toBe("lock")
    expect(inferMonthlyCyclePipelineStage("prep_exception")).toBe("prep")
    expect(inferMonthlyCyclePipelineStage("calculation_package_failure")).toBe("calculation")
    expect(inferMonthlyCyclePipelineStage("verification_review")).toBe("verification")
    expect(inferMonthlyCyclePipelineStage("approval_review")).toBe("approval")
    expect(inferMonthlyCyclePipelineStage("payout_intents_create_success")).toBe("distribution")
    expect(inferMonthlyCyclePipelineStage("reporting_publication_success")).toBe("reporting")
  })

  it("summarizes attempts, successes, failures, warnings, and latest timestamps by stage", () => {
    const summaries = summarizeMonthlyCyclePipelineEvents([
      { ...baseEvent, stage: "lock", status: "locked" },
      {
        ...baseEvent,
        id: 2,
        event_type: "lock_success",
        outcome: "success",
        created_at: "2026-05-01T00:01:00Z",
        stage: "lock",
        status: "locked",
      },
      {
        ...baseEvent,
        id: 3,
        event_type: "payout_intents_create_failure",
        attempt_id: "attempt-2",
        outcome: "failure",
        severity: "warning",
        created_at: "2026-05-01T00:02:00Z",
        stage: "distribution",
        status: "approval",
      },
    ])

    expect(summaries.find((summary) => summary.stage === "lock")).toMatchObject({
      attempts: 1,
      successes: 1,
      failures: 0,
      latestEventAt: "2026-05-01T00:00:00Z",
    })
    expect(summaries.find((summary) => summary.stage === "distribution")).toMatchObject({
      attempts: 0,
      successes: 0,
      failures: 1,
      warnings: 1,
      latestFailureAt: "2026-05-01T00:02:00Z",
    })
  })

  it("builds an operator overview with cycle status and attempt drill-down rows", () => {
    const overview = buildMonthlyCycleObservabilityOverview({
      cycles: [{ id: 1, cycle_key: "2026-04", status: "locked" }],
      events: [
        baseEvent,
        { ...baseEvent, id: 2, event_type: "lock_success", outcome: "success", created_at: "2026-05-01T00:01:00Z" },
      ],
      attemptEvents: [baseEvent],
    })

    expect(overview.totals).toEqual({
      eventCount: 2,
      failureCount: 0,
      warningCount: 0,
      affectedCycleCount: 1,
    })
    expect(overview.events[0]).toMatchObject({
      stage: "lock",
      status: "locked",
    })
    expect(overview.attemptEvents).toHaveLength(1)
  })
})
