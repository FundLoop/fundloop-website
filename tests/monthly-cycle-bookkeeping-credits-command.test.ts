import { describe, expect, it } from "vitest"
import { executeMonthlyCycleBookkeepingCreditsCreateCommand } from "@/lib/monthly-cycles/monthly-cycle-bookkeeping-credits-command"

const baseCycle = {
  id: 1,
  cycle_key: "2026-04",
  status: "approval",
  distribution_started_at: null,
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

  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.db.inserts[this.table] ??= []
    this.db.rows[this.table] ??= []
    const rows = Array.isArray(payload) ? payload : [payload]
    this.db.inserts[this.table].push(...rows)
    this.db.rows[this.table].push(...rows)
    return Promise.resolve({ data: null, error: null })
  }

  update(payload: Record<string, unknown>) {
    this.mutation = payload
    return this
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, type: "eq", value })
    return this
  }

  in(key: string, value: unknown[]) {
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
    monthly_cycles: [{ ...baseCycle }],
    zkas_runs: [
      {
        id: 20,
        monthly_cycle_id: 1,
        status: "completed",
        verification_status: "verified",
        total_allocated_usd: 75,
        user_count: 2,
        result_artifact_hash: "hash-1",
        created_at: "2026-05-01T03:00:00.000Z",
      },
    ],
    zkas_run_results: [
      {
        id: 100,
        monthly_cycle_id: 1,
        run_id: 20,
        zkas_user_id: "00000000-0000-4000-8000-000000000001",
        allocation_usd: 50,
        aggregate_score: 12,
        app_count: 1,
        project_count: 1,
        eligibility: true,
        output_row_hash: "row-hash-1",
      },
      {
        id: 101,
        monthly_cycle_id: 1,
        run_id: 20,
        zkas_user_id: "00000000-0000-4000-8000-000000000002",
        allocation_usd: 25,
        aggregate_score: 5,
        app_count: 1,
        project_count: 1,
        eligibility: true,
        output_row_hash: "row-hash-2",
      },
    ],
    monthly_cycle_allocation_project_results: [
      {
        monthly_cycle_id: 1,
        run_id: 20,
        project_id: 7,
        user_id: "00000000-0000-4000-8000-000000000001",
        scoped_cubid_id: "scoped-user-1",
        attribution_points: 12,
        total_project_points: 17,
        project_pool_usd: 75,
        raw_usd: 52.94,
      },
      {
        monthly_cycle_id: 1,
        run_id: 20,
        project_id: 7,
        user_id: "00000000-0000-4000-8000-000000000002",
        scoped_cubid_id: "scoped-user-2",
        attribution_points: 5,
        total_project_points: 17,
        project_pool_usd: 75,
        raw_usd: 22.06,
      },
    ],
    monthly_cycle_allocation_asset_fills: [
      {
        monthly_cycle_id: 1,
        run_id: 20,
        user_id: "00000000-0000-4000-8000-000000000001",
        pool_id: "pool-usdc",
        project_id: 7,
        asset_type: "stablecoin",
        asset_code: "USDC",
        source_amount: 50,
        usd_value: 50,
        preference_rank: 1,
        partial: false,
      },
      {
        monthly_cycle_id: 1,
        run_id: 20,
        user_id: "00000000-0000-4000-8000-000000000002",
        pool_id: "pool-usdc",
        project_id: 7,
        asset_type: "stablecoin",
        asset_code: "USDC",
        source_amount: 20,
        usd_value: 20,
        preference_rank: 1,
        partial: true,
      },
      {
        monthly_cycle_id: 1,
        run_id: 20,
        user_id: "00000000-0000-4000-8000-000000000002",
        pool_id: "pool-usd",
        project_id: 7,
        asset_type: "fiat",
        asset_code: "USD",
        source_amount: 5,
        usd_value: 5,
        preference_rank: 2,
        partial: false,
      },
    ],
    monthly_cycle_allocation_returned_pools: [
      {
        monthly_cycle_id: 1,
        run_id: 20,
        pool_id: "pool-token",
        project_id: 7,
        asset_type: "project_token",
        asset_code: "CIVIC",
        source_amount: 10,
        usd_value: 5,
        reason_code: "preference_unfulfillable",
      },
    ],
    monthly_cycle_bookkeeping_credits: [],
    monthly_cycle_events: [],
    payout_intents: [],
    ...overrides,
  })
}

const commandInput = {
  cycleKey: "2026-04",
  attemptId: "attempt-1",
  actorUserId: "00000000-0000-4000-8000-00000000admin",
  actorRole: "internal_admin" as const,
}

describe("monthly-cycle bookkeeping credit creation", () => {
  it("creates credited/not-paid records from verified approved results", async () => {
    const supabase = makeSupabase()
    const result = await executeMonthlyCycleBookkeepingCreditsCreateCommand(
      supabase as never,
      commandInput,
      { now: () => new Date("2026-05-01T04:00:00.000Z") },
    )

    expect(result).toMatchObject({
      ok: true,
      data: {
        status: "distribution",
        createdCount: 2,
        existingCount: 0,
        creditedCount: 2,
        totalCreditedUsd: 75,
        returnedPoolUsd: 5,
        assetFillCount: 3,
        sourceBreakdownCount: 2,
        noPayoutExecuted: true,
      },
    })
    expect(supabase.inserts.monthly_cycle_bookkeeping_credits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_result_id: 100,
          user_id: "00000000-0000-4000-8000-000000000001",
          status: "credited",
          payment_status: "not_paid",
          usd_equivalent_amount: 50,
        }),
        expect.objectContaining({
          source_result_id: 101,
          user_id: "00000000-0000-4000-8000-000000000002",
          status: "credited",
          payment_status: "not_paid",
          usd_equivalent_amount: 25,
        }),
      ]),
    )
    expect(supabase.inserts.monthly_cycle_bookkeeping_credits[1].asset_fills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetCode: "USDC", partial: true }),
        expect.objectContaining({ assetCode: "USD", preferenceRank: 2 }),
      ]),
    )
    expect(supabase.updates.monthly_cycles[0]).toMatchObject({
      status: "distribution",
      status_note: "Bookkeeping earnings credits created. No payout transfers executed.",
    })
    expect(supabase.inserts.payout_intents ?? []).toEqual([])
    expect(supabase.inserts.monthly_cycle_events.map((event) => event.event_type)).toEqual([
      "bookkeeping_credits_create_attempt",
      "bookkeeping_credits_create_success",
    ])
  })

  it("does not duplicate existing credits", async () => {
    const existingKey = "monthly-cycle:1:run:20:result:100:bookkeeping-credit:v1"
    const supabase = makeSupabase({
      monthly_cycle_bookkeeping_credits: [
        { id: 300, monthly_cycle_id: 1, idempotency_key: existingKey, usd_equivalent_amount: 50 },
      ],
    })

    const result = await executeMonthlyCycleBookkeepingCreditsCreateCommand(supabase as never, commandInput)

    expect(result).toMatchObject({ ok: true, data: { createdCount: 1, existingCount: 1, creditedCount: 2, totalCreditedUsd: 75 } })
    expect(supabase.inserts.monthly_cycle_bookkeeping_credits).toHaveLength(1)
  })

  it("rejects cycles that are not approved", async () => {
    const supabase = makeSupabase({ monthly_cycles: [{ ...baseCycle, status: "verification" }] })

    const result = await executeMonthlyCycleBookkeepingCreditsCreateCommand(supabase as never, commandInput)

    expect(result).toMatchObject({ ok: false, error: { code: "cycle_not_approved" } })
    expect(supabase.inserts.monthly_cycle_bookkeeping_credits ?? []).toEqual([])
  })

  it("requires a completed verified run with an artifact hash", async () => {
    const supabase = makeSupabase({ zkas_runs: [{ ...makeSupabase().rows.zkas_runs[0], verification_status: "pending" }] })

    const result = await executeMonthlyCycleBookkeepingCreditsCreateCommand(supabase as never, commandInput)

    expect(result).toMatchObject({ ok: false, error: { code: "verified_run_required" } })
  })

  it("requires positive verified user results", async () => {
    const supabase = makeSupabase({ zkas_run_results: [] })

    const result = await executeMonthlyCycleBookkeepingCreditsCreateCommand(supabase as never, commandInput)

    expect(result).toMatchObject({ ok: false, error: { code: "verified_results_required" } })
  })

  it("rejects non-admin callers before mutation", async () => {
    const supabase = makeSupabase()

    const result = await executeMonthlyCycleBookkeepingCreditsCreateCommand(supabase as never, {
      ...commandInput,
      actorRole: "system",
    })

    expect(result).toMatchObject({ ok: false, error: { code: "forbidden" } })
    expect(supabase.inserts.monthly_cycle_events ?? []).toEqual([])
    expect(supabase.inserts.monthly_cycle_bookkeeping_credits ?? []).toEqual([])
  })
})
