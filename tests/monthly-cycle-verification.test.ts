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
  locked_manifest: {
    version: "monthly-cycle-lock.v1",
    mvp_inputs: {
      contribution_submissions: [
        {
          id: 1,
          project_id: 7,
          source_currency_code: "USDC",
          source_amount: 50,
          usd_equivalent_amount: 50,
          commitment_percentage: 100,
          calculated_contribution_amount: 50,
          status: "submitted",
        },
        {
          id: 2,
          project_id: 7,
          source_currency_code: "CIVIC",
          source_amount: 30,
          usd_equivalent_amount: 30,
          commitment_percentage: 100,
          calculated_contribution_amount: 30,
          status: "submitted",
        },
      ],
      attribution_datasets: [{ id: 50, project_id: 7, status: "approved", row_count: 2 }],
      attribution_rows: [
        {
          id: 100,
          dataset_id: 50,
          project_id: 7,
          scoped_cubid_id: "scope-user-1",
          user_id: "user-1",
          attribution_points: 30,
          resolution_status: "resolved",
        },
        {
          id: 101,
          dataset_id: 50,
          project_id: 7,
          scoped_cubid_id: "scope-user-2",
          user_id: "user-2",
          attribution_points: 50,
          resolution_status: "resolved",
        },
      ],
      eligible_users: [
        { user_id: "user-1", cubid_identity_status: "linked", is_eligible: true },
        { user_id: "user-2", cubid_identity_status: "verified", is_eligible: true },
      ],
      asset_preferences: [
        {
          user_id: "user-1",
          has_custom_preferences: true,
          preferences: [{ rank: 1, asset_type: "project_token", asset_code: "CIVIC", project_id: 7, accepted: true }],
        },
        {
          user_id: "user-2",
          has_custom_preferences: true,
          preferences: [{ rank: 1, asset_type: "stablecoin", asset_code: "USDC", project_id: null, accepted: true }],
        },
      ],
    },
  },
  locked_manifest_hash: "locked-hash",
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
    zkas_run_results: [
      { monthly_cycle_id: 1, run_id: 10, zkas_user_id: "user-1", allocation_usd: 25, aggregate_score: 30, eligibility: true },
      { monthly_cycle_id: 1, run_id: 10, zkas_user_id: "user-2", allocation_usd: 50, aggregate_score: 50, eligibility: true },
    ],
    monthly_cycle_allocation_project_results: [
      {
        monthly_cycle_id: 1,
        run_id: 10,
        project_id: 7,
        user_id: "user-1",
        scoped_cubid_id: "scope-user-1",
        attribution_points: 30,
        total_project_points: 80,
        project_pool_usd: 80,
        raw_usd: 25,
      },
      {
        monthly_cycle_id: 1,
        run_id: 10,
        project_id: 7,
        user_id: "user-2",
        scoped_cubid_id: "scope-user-2",
        attribution_points: 50,
        total_project_points: 80,
        project_pool_usd: 80,
        raw_usd: 50,
      },
    ],
    monthly_cycle_allocation_asset_fills: [
      {
        monthly_cycle_id: 1,
        run_id: 10,
        user_id: "user-1",
        project_id: 7,
        asset_type: "project_token",
        asset_code: "CIVIC",
        usd_value: 25,
        preference_rank: 1,
      },
      {
        monthly_cycle_id: 1,
        run_id: 10,
        user_id: "user-2",
        project_id: 7,
        asset_type: "stablecoin",
        asset_code: "USDC",
        usd_value: 50,
        preference_rank: 1,
      },
    ],
    monthly_cycle_allocation_returned_pools: [
      {
        monthly_cycle_id: 1,
        run_id: 10,
        project_id: 7,
        asset_type: "project_token",
        asset_code: "CIVIC",
        usd_value: 5,
      },
    ],
    monthly_cycle_events: [],
    ...overrides,
  })
}

function makeCleanVerificationFixture() {
  return makeSupabase({
    monthly_cycles: [{ ...cycle, status: "verification" }],
  })
}

function makeNeedsCleanupVerificationFixture() {
  return makeSupabase({
    zkas_runs: [],
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
          attribution_points: 30,
          total_project_points: 80,
          project_pool_usd: 80,
          raw_usd: 25,
        },
        {
          project_id: 7,
          user_id: "user-2",
          scoped_cubid_id: "scope-user-2",
          attribution_points: 50,
          total_project_points: 80,
          project_pool_usd: 80,
          raw_usd: 50,
        },
      ],
      assetFills: [
        {
          user_id: "user-1",
          project_id: 7,
          asset_type: "project_token",
          asset_code: "CIVIC",
          source_amount: 25,
          usd_value: 25,
          preference_rank: 1,
          partial: false,
        },
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
    })
    expect(review.calculation.userResults).toEqual([
      expect.objectContaining({ zkasUserId: "user-2", allocationUsd: 50 }),
      expect.objectContaining({ zkasUserId: "user-1", allocationUsd: 25 }),
    ])
    expect(review.calculation.projectResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: 7, userId: "user-1", rawUsd: 25 }),
        expect.objectContaining({ projectId: 7, userId: "user-2", rawUsd: 50 }),
      ]),
    )
    expect(review.calculation.assetFills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "user-1", assetCode: "CIVIC", usdValue: 25 }),
        expect.objectContaining({ userId: "user-2", assetCode: "USDC", usdValue: 50 }),
      ]),
    )
    expect(review.calculation.returnedPools).toEqual([
      expect.objectContaining({ assetCode: "CIVIC", reasonCode: "preference_unfulfillable" }),
    ])
    expect(review.calculation.sourceBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetCode: "CIVIC", allocatedUsd: 25, returnedUsd: 5 }),
        expect.objectContaining({ assetCode: "USDC", allocatedUsd: 50, returnedUsd: 0 }),
      ]),
    )
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

  it("blocks cap, pool reconciliation, and asset-fill integrity failures", () => {
    const review = buildMonthlyCycleVerificationReview({
      cycle,
      runs: [{ ...completedRun, total_allocated_usd: 400 }],
      results: [{ zkas_user_id: "user-1", allocation_usd: 400, aggregate_score: 30, eligibility: true }],
      projectResults: [
        {
          project_id: 7,
          user_id: "user-1",
          scoped_cubid_id: "scope-user-1",
          attribution_points: 30,
          total_project_points: 80,
          project_pool_usd: 80,
          raw_usd: 25,
        },
      ],
      assetFills: [
        {
          user_id: "user-1",
          project_id: 7,
          asset_type: "stablecoin",
          asset_code: "USDC",
          source_amount: 90,
          usd_value: 90,
          preference_rank: 0,
          partial: false,
        },
      ],
      returnedPools: [],
    })

    expect(review.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["cap_multiple_exceeded", "pool_reconciliation_mismatch", "invalid_asset_fill"]),
    )
    expect(review.canMarkVerified).toBe(false)
  })

  it("blocks asset fills that violate locked custom preferences", () => {
    const review = buildMonthlyCycleVerificationReview({
      cycle: {
        ...cycle,
        locked_manifest: {
          ...cycle.locked_manifest,
          mvp_inputs: {
            ...cycle.locked_manifest.mvp_inputs,
            asset_preferences: [
              {
                user_id: "user-1",
                has_custom_preferences: true,
                preferences: [{ rank: 1, asset_type: "project_token", asset_code: "CIVIC", project_id: 7, accepted: false }],
              },
              {
                user_id: "user-2",
                has_custom_preferences: true,
                preferences: [{ rank: 2, asset_type: "stablecoin", asset_code: "USDC", project_id: null, accepted: true }],
              },
            ],
          },
        },
      },
      runs: [completedRun],
      results: [
        { zkas_user_id: "user-1", allocation_usd: 25, aggregate_score: 30, eligibility: true },
        { zkas_user_id: "user-2", allocation_usd: 50, aggregate_score: 50, eligibility: true },
      ],
      projectResults: [
        {
          project_id: 7,
          user_id: "user-1",
          scoped_cubid_id: "scope-user-1",
          attribution_points: 30,
          total_project_points: 80,
          project_pool_usd: 80,
          raw_usd: 25,
        },
        {
          project_id: 7,
          user_id: "user-2",
          scoped_cubid_id: "scope-user-2",
          attribution_points: 50,
          total_project_points: 80,
          project_pool_usd: 80,
          raw_usd: 50,
        },
      ],
      assetFills: [
        {
          user_id: "user-1",
          project_id: 7,
          asset_type: "project_token",
          asset_code: "CIVIC",
          source_amount: 25,
          usd_value: 25,
          preference_rank: 1,
          partial: false,
        },
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
          source_amount: 5,
          usd_value: 5,
          reason_code: "preference_unfulfillable",
        },
      ],
    })

    expect(review.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["asset_fill_rejected_preference", "asset_fill_preference_rank_mismatch"]),
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

  it("keeps deterministic local fixtures for clean and needs-cleanup outcomes", async () => {
    const clean = makeCleanVerificationFixture()
    const needsCleanup = makeNeedsCleanupVerificationFixture()

    const approved = await executeMonthlyCycleApprovalCommand(clean as never, {
      ...commandInput,
      note: "Clean fixture is approved for bookkeeping credit creation.",
    })
    const cleanup = await executeMonthlyCycleVerificationReviewCommand(needsCleanup as never, {
      ...commandInput,
      decision: "needs_cleanup",
      note: "Needs-cleanup fixture intentionally lacks a completed run.",
    })

    expect(approved).toMatchObject({ ok: true, data: { status: "approval", approvedRunId: 10 } })
    expect(clean.inserts.monthly_cycle_events[0]).toMatchObject({
      event_type: "approval_review",
      outcome: "success",
      metadata: expect.objectContaining({ nextStep: "bookkeeping_credit_creation", noPayoutExecuted: true }),
    })
    expect(clean.updates.monthly_cycles[0]).toMatchObject({ status: "approval" })
    expect(clean.inserts.payout_intents ?? []).toEqual([])
    expect(clean.inserts.monthly_cycle_reports ?? []).toEqual([])
    expect(clean.inserts.user_earnings_credits ?? []).toEqual([])

    expect(cleanup).toMatchObject({ ok: true, data: { status: "calculation", cleanupRequired: true } })
    expect(needsCleanup.updates.monthly_cycles[0]).toMatchObject({ status: "calculation" })
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

  it("blocks approval when MVP verification integrity checks fail", async () => {
    const supabase = makeSupabase({
      monthly_cycles: [{ ...cycle, status: "verification" }],
      zkas_run_results: [{ monthly_cycle_id: 1, run_id: 10, zkas_user_id: "user-1", allocation_usd: 400, aggregate_score: 30, eligibility: true }],
      monthly_cycle_allocation_project_results: [
        {
          monthly_cycle_id: 1,
          run_id: 10,
          project_id: 7,
          user_id: "user-1",
          scoped_cubid_id: "scope-user-1",
          attribution_points: 30,
          total_project_points: 80,
          project_pool_usd: 80,
          raw_usd: 25,
        },
      ],
      monthly_cycle_allocation_asset_fills: [
        {
          monthly_cycle_id: 1,
          run_id: 10,
          user_id: "user-1",
          project_id: 7,
          asset_type: "stablecoin",
          asset_code: "USDC",
          usd_value: 90,
          preference_rank: 1,
        },
      ],
      monthly_cycle_allocation_returned_pools: [],
    })

    const result = await executeMonthlyCycleApprovalCommand(supabase as never, {
      ...commandInput,
      note: "Trying to approve a broken calculation.",
    })

    expect(result).toMatchObject({ ok: false, error: { code: "verification_integrity_failed" } })
    expect(supabase.updates.monthly_cycles ?? []).toEqual([])
    expect(supabase.inserts.monthly_cycle_events).toEqual([
      expect.objectContaining({
        event_type: "approval_review",
        outcome: "failure",
        message: "Approval requires clean MVP verification integrity checks.",
      }),
    ])
  })

  it("blocks verification review when MVP integrity checks fail", async () => {
    const supabase = makeSupabase({
      zkas_run_results: [{ monthly_cycle_id: 1, run_id: 10, zkas_user_id: "user-1", allocation_usd: 400, aggregate_score: 30, eligibility: true }],
      monthly_cycle_allocation_project_results: [
        {
          monthly_cycle_id: 1,
          run_id: 10,
          project_id: 7,
          user_id: "user-1",
          scoped_cubid_id: "scope-user-1",
          attribution_points: 30,
          total_project_points: 80,
          project_pool_usd: 80,
          raw_usd: 25,
        },
      ],
      monthly_cycle_allocation_asset_fills: [
        {
          monthly_cycle_id: 1,
          run_id: 10,
          user_id: "user-1",
          project_id: 7,
          asset_type: "stablecoin",
          asset_code: "USDC",
          usd_value: 90,
          preference_rank: 1,
        },
      ],
      monthly_cycle_allocation_returned_pools: [],
    })

    const result = await executeMonthlyCycleVerificationReviewCommand(supabase as never, {
      ...commandInput,
      decision: "verified",
      note: "Trying to verify a broken calculation.",
    })

    expect(result).toMatchObject({ ok: false, error: { code: "verification_integrity_failed" } })
    expect(supabase.updates.monthly_cycles ?? []).toEqual([])
    expect(supabase.inserts.monthly_cycle_events).toEqual([
      expect.objectContaining({
        event_type: "verification_review",
        outcome: "failure",
        message: "MVP verification integrity checks failed.",
        metadata: expect.objectContaining({
          blockerCodes: expect.arrayContaining(["cap_multiple_exceeded", "pool_reconciliation_mismatch"]),
        }),
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
