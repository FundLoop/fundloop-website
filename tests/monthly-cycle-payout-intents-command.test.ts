import { describe, expect, it } from "vitest"
import { executeMonthlyCyclePayoutIntentsCreateCommand } from "@/lib/monthly-cycles/monthly-cycle-payout-intents-command"

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
    if (Array.isArray(payload)) {
      this.db.inserts[this.table].push(...payload)
      this.db.rows[this.table] ??= []
      this.db.rows[this.table].push(...payload)
    } else {
      this.db.inserts[this.table].push(payload)
      this.db.rows[this.table] ??= []
      this.db.rows[this.table].push(payload)
    }
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
    zkas_published_user_results: [
      { id: 10, monthly_cycle_id: 1, user_id: "user-1", allocation_usd: 50 },
      { id: 11, monthly_cycle_id: 1, user_id: "user-2", allocation_usd: 25 },
    ],
    user_payout_routes: [
      { id: 100, user_id: "user-1", rail: "evm", currency_code: "USD", status: "active", is_default: true },
    ],
    payout_intents: [],
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

describe("monthly-cycle payout intent creation", () => {
  it("creates ready and draft payout intents from published user results", async () => {
    const supabase = makeSupabase()
    const result = await executeMonthlyCyclePayoutIntentsCreateCommand(
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
        readyCount: 1,
        draftCount: 1,
        totalAmountUsd: 75,
      },
    })
    expect(supabase.inserts.payout_intents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "user-1", status: "ready", payout_route_id: 100, rail: "evm" }),
        expect.objectContaining({ user_id: "user-2", status: "draft", status_reason: "missing_default_payout_route" }),
      ]),
    )
    expect(supabase.updates.monthly_cycles[0]).toMatchObject({
      status: "distribution",
      distribution_started_at: "2026-05-01T04:00:00.000Z",
    })
    expect(supabase.inserts.monthly_cycle_events.map((event) => event.event_type)).toEqual([
      "payout_intents_create_attempt",
      "payout_intents_create_success",
    ])
  })

  it("does not duplicate existing payout intents", async () => {
    const existingKey = "monthly-cycle:1:published-result:10:payout-intent:v1"
    const supabase = makeSupabase({
      payout_intents: [{ id: 200, monthly_cycle_id: 1, idempotency_key: existingKey, status: "ready", amount_usd: 50 }],
    })

    const result = await executeMonthlyCyclePayoutIntentsCreateCommand(supabase as never, commandInput)

    expect(result).toMatchObject({ ok: true, data: { createdCount: 1, existingCount: 1, totalAmountUsd: 75 } })
    expect(supabase.inserts.payout_intents).toHaveLength(1)
  })

  it("rejects cycles that are not approved", async () => {
    const supabase = makeSupabase({ monthly_cycles: [{ ...baseCycle, status: "verification" }] })

    const result = await executeMonthlyCyclePayoutIntentsCreateCommand(supabase as never, commandInput)

    expect(result).toMatchObject({ ok: false, error: { code: "cycle_not_approved" } })
  })

  it("requires positive published user results", async () => {
    const supabase = makeSupabase({ zkas_published_user_results: [] })

    const result = await executeMonthlyCyclePayoutIntentsCreateCommand(supabase as never, commandInput)

    expect(result).toMatchObject({ ok: false, error: { code: "published_results_required" } })
  })

  it("rejects non-admin payout intent callers before mutation", async () => {
    const supabase = makeSupabase()

    const result = await executeMonthlyCyclePayoutIntentsCreateCommand(supabase as never, {
      ...commandInput,
      actorRole: "system",
    })

    expect(result).toMatchObject({ ok: false, error: { code: "forbidden" } })
    expect(supabase.inserts.monthly_cycle_events ?? []).toEqual([])
    expect(supabase.inserts.payout_intents ?? []).toEqual([])
  })
})
