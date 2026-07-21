import { describe, expect, it } from "vitest"
import { buildMonthlyCycleVerificationReview } from "@/lib/monthly-cycles/monthly-cycle-verification"
import {
  executeMonthlyCycleApprovalCommand,
  executeMonthlyCycleVerificationReviewCommand,
} from "@/lib/monthly-cycles/monthly-cycle-verification-command"

const cycle = {
  id: 1,
  cycle_key: "2026-04",
  period_start: "2026-04-01",
  period_end: "2026-04-30",
  status: "calculation" as const,
  verification_started_at: null,
  approval_started_at: null,
  status_note: null,
}

const completedRun = {
  id: 10,
  status: "completed" as const,
  verification_status: "verified" as const,
  user_count: 2,
  total_score: 10,
  total_allocated_usd: 75,
  result_artifact_path: "2026-04/run-10/run-result.v1.json",
  result_artifact_hash: "result-hash",
  attestation_artifact_hash: null,
  created_at: "2026-05-01T00:00:00.000Z",
  published_at: null,
}

function matchesFilter(row: Record<string, unknown>, filter: { key: string; type: string; value: unknown }) {
  if (filter.type === "eq") return row[filter.key] === filter.value
  if (filter.type === "in") return Array.isArray(filter.value) && filter.value.includes(row[filter.key])
  return true
}

class FakeBuilder {
  private filters: Array<{ key: string; type: string; value: unknown }> = []
  private mutation: Record<string, unknown> | null = null
  private maybeSingleResult = false

  constructor(
    private db: FakeSupabase,
    private table: string,
  ) {}

  select() {
    return this
  }

  update(payload: Record<string, unknown>) {
    this.mutation = payload
    return this
  }

  insert(payload: Record<string, unknown>) {
    this.db.inserts[this.table] ??= []
    this.db.inserts[this.table].push(payload)
    return Promise.resolve({ data: null, error: null })
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, type: "eq", value })
    return this
  }

  in(key: string, value: unknown) {
    this.filters.push({ key, type: "in", value })
    return this
  }

  order() {
    return this
  }

  maybeSingle() {
    this.maybeSingleResult = true
    return this
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }

  private execute() {
    const rows = (this.db.rows[this.table] ?? []).filter((row) => this.filters.every((filter) => matchesFilter(row, filter)))
    if (this.mutation) {
      for (const row of rows) Object.assign(row, this.mutation)
      this.db.updates[this.table] ??= []
      this.db.updates[this.table].push(this.mutation)
      return { data: this.maybeSingleResult ? (rows[0] ?? null) : rows, error: null }
    }
    return { data: this.maybeSingleResult ? (rows[0] ?? null) : rows, error: null }
  }
}

class FakeSupabase {
  inserts: Record<string, Array<Record<string, unknown>>> = {}
  updates: Record<string, Array<Record<string, unknown>>> = {}

  constructor(public rows: Record<string, Array<Record<string, unknown>>>) {}

  from(table: string) {
    return new FakeBuilder(this, table)
  }
}

function makeSupabase(overrides: Partial<Record<string, Array<Record<string, unknown>>>> = {}) {
  return new FakeSupabase({
    monthly_cycles: [{ ...cycle }],
    zkas_runs: [{ ...completedRun, monthly_cycle_id: 1 }],
    monthly_cycle_events: [],
    ...overrides,
  })
}

const commandInput = {
  cycleKey: "2026-04",
  attemptId: "attempt-1",
  actorUserId: "admin-1",
  actorRole: "internal_admin" as const,
}

describe("monthly-cycle verification review", () => {
  it("marks clean completed verified output as approvable after review", () => {
    const review = buildMonthlyCycleVerificationReview({
      cycle: { ...cycle, status: "verification" },
      runs: [completedRun],
      results: [
        { zkas_user_id: "user-1", allocation_usd: 25, aggregate_score: 3, eligibility: true },
        { zkas_user_id: "user-2", allocation_usd: 50, aggregate_score: 7, eligibility: true },
      ],
      projectResults: [
        {
          project_id: 7,
          user_id: "user-1",
          scoped_cubid_id: "scope-user-1",
          attribution_points: 3,
          total_project_points: 10,
          project_pool_usd: 75,
          raw_usd: 25,
        },
      ],
      assetFills: [
        {
          user_id: "user-2",
          project_id: 7,
          asset_type: "stablecoin",
          asset_code: "USDC",
          source_amount: 50,
          usd_value: 50,
          preference_rank: 1,
          partial: false,
        },
      ],
      returnedPools: [
        {
          project_id: 7,
          asset_type: "project_token",
          asset_code: "CIVIC",
          source_amount: 10,
          usd_value: 5,
          reason_code: "preference_unfulfillable",
        },
      ],
    })

    expect(review.issues).toEqual([])
    expect(review.canMarkVerified).toBe(true)
    expect(review.canApprove).toBe(true)
    expect(review.calculation).toMatchObject({
      resultArtifactPath: "2026-04/run-10/run-result.v1.json",
      resultArtifactHash: "result-hash",
      returnedPoolUsd: 5,
      userResults: [
        expect.objectContaining({ zkasUserId: "user-2", allocationUsd: 50 }),
        expect.objectContaining({ zkasUserId: "user-1", allocationUsd: 25 }),
      ],
      projectResults: [expect.objectContaining({ projectId: 7, userId: "user-1", rawUsd: 25 })],
      assetFills: [expect.objectContaining({ userId: "user-2", assetCode: "USDC", usdValue: 50 })],
      returnedPools: [expect.objectContaining({ assetCode: "CIVIC", reasonCode: "preference_unfulfillable" })],
      sourceBreakdown: [
        expect.objectContaining({ assetCode: "CIVIC", allocatedUsd: 0, returnedUsd: 5 }),
        expect.objectContaining({ assetCode: "USDC", allocatedUsd: 50, returnedUsd: 0 }),
      ],
    })
  })

  it("blocks mismatched or unverified completed runs", () => {
    const review = buildMonthlyCycleVerificationReview({
      cycle,
      runs: [{ ...completedRun, verification_status: "pending" }],
      results: [{ zkas_user_id: "user-1", allocation_usd: 70, aggregate_score: 5, eligibility: true }],
    })

    expect(review.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["run_not_verified", "allocation_total_mismatch"]),
    )
    expect(review.canMarkVerified).toBe(false)
  })

  it("records verification and approval decisions", async () => {
    const supabase = makeSupabase()
    const verified = await executeMonthlyCycleVerificationReviewCommand(
      supabase as never,
      { ...commandInput, decision: "verified", note: "Totals match result artifact." },
      { now: () => new Date("2026-05-01T02:00:00.000Z") },
    )

    expect(verified).toMatchObject({ ok: true, data: { status: "verification", cleanupRequired: false } })
    expect(supabase.updates.monthly_cycles[0]).toMatchObject({
      status: "verification",
      verification_started_at: "2026-05-01T02:00:00.000Z",
    })

    const approved = await executeMonthlyCycleApprovalCommand(
      supabase as never,
      { ...commandInput, note: "Approved for distribution." },
      { now: () => new Date("2026-05-01T03:00:00.000Z") },
    )

    expect(approved).toMatchObject({ ok: true, data: { status: "approval", approvedRunId: 10 } })
    expect(supabase.updates.monthly_cycles[1]).toMatchObject({
      status: "approval",
      approval_started_at: "2026-05-01T03:00:00.000Z",
    })
    expect(supabase.inserts.monthly_cycle_events.map((event) => event.event_type)).toEqual([
      "verification_review",
      "approval_review",
    ])
  })

  it("accepts finalized verified runs as completed cycle outputs", async () => {
    const supabase = makeSupabase({
      zkas_runs: [{ ...completedRun, status: "finalized", monthly_cycle_id: 1 }],
    })

    const verified = await executeMonthlyCycleVerificationReviewCommand(supabase as never, {
      ...commandInput,
      decision: "verified",
      note: "Published output remains valid for monthly-cycle verification.",
    })

    expect(verified).toMatchObject({ ok: true, data: { status: "verification" } })
  })

  it("audits approval failures once the cycle is known", async () => {
    const supabase = makeSupabase({
      monthly_cycles: [{ ...cycle, status: "verification" }],
      zkas_runs: [{ ...completedRun, monthly_cycle_id: 1, verification_status: "pending" }],
    })

    const result = await executeMonthlyCycleApprovalCommand(supabase as never, {
      ...commandInput,
      note: "Trying to approve before the run is verified.",
    })

    expect(result).toMatchObject({ ok: false, error: { code: "run_verification_required" } })
    expect(supabase.inserts.monthly_cycle_events).toEqual([
      expect.objectContaining({
        event_type: "approval_review",
        outcome: "failure",
        severity: "warning",
        message: "Approval requires a verified zkAS run.",
      }),
    ])
  })

  it("rejects non-admin cycle review and approval callers before mutation", async () => {
    const supabase = makeSupabase()

    await expect(
      executeMonthlyCycleVerificationReviewCommand(supabase as never, {
        ...commandInput,
        actorRole: "system",
        decision: "verified",
        note: "System caller should not review.",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "forbidden" } })
    await expect(
      executeMonthlyCycleApprovalCommand(supabase as never, {
        ...commandInput,
        actorRole: "system",
        note: "System caller should not approve.",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "forbidden" } })
    expect(supabase.inserts.monthly_cycle_events ?? []).toEqual([])
    expect(supabase.updates.monthly_cycles ?? []).toEqual([])
  })

  it("records cleanup-needed without advancing to verification", async () => {
    const supabase = makeSupabase({ zkas_runs: [] })
    const result = await executeMonthlyCycleVerificationReviewCommand(supabase as never, {
      ...commandInput,
      decision: "needs_cleanup",
      note: "Missing completed run.",
    })

    expect(result).toMatchObject({ ok: true, data: { status: "calculation", cleanupRequired: true } })
    expect(supabase.updates.monthly_cycles[0]).toMatchObject({ status: "calculation", status_note: "Missing completed run." })
  })
})
