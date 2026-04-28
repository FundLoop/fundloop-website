import { describe, expect, it } from "vitest"
import { executeMonthlyCycleLockCommand } from "@/lib/monthly-cycles/monthly-cycle-lock-command"

const cycle = {
  id: 1,
  cycle_key: "2026-04",
  year: 2026,
  month: 4,
  period_start: "2026-04-01",
  period_end: "2026-04-30",
  status: "open",
  opened_at: "2026-04-01T00:00:00Z",
}

function matchesFilter(row: Record<string, unknown>, filter: { key: string; type: string; value: unknown }) {
  if (filter.type === "eq") return row[filter.key] === filter.value
  if (filter.type === "is") return row[filter.key] === filter.value
  if (filter.type === "in") return Array.isArray(filter.value) && filter.value.includes(row[filter.key])
  return true
}

class FakeBuilder {
  private filters: Array<{ key: string; type: string; value: unknown }> = []
  private maybeSingleResult = false
  private mutation: { kind: "insert" | "update"; payload: Record<string, unknown> } | null = null

  constructor(
    private db: FakeSupabase,
    private table: string,
  ) {}

  select() {
    return this
  }

  insert(payload: Record<string, unknown>) {
    this.mutation = { kind: "insert", payload }
    return this
  }

  update(payload: Record<string, unknown>) {
    this.mutation = { kind: "update", payload }
    return this
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, type: "eq", value })
    return this
  }

  is(key: string, value: unknown) {
    this.filters.push({ key, type: "is", value })
    return this
  }

  in(key: string, value: unknown) {
    this.filters.push({ key, type: "in", value })
    return this
  }

  gte() {
    return this
  }

  lte() {
    return this
  }

  lt() {
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
    if (this.mutation?.kind === "insert") {
      this.db.inserts[this.table] ??= []
      this.db.inserts[this.table].push(this.mutation.payload)
      return { data: null, error: null }
    }

    if (this.mutation?.kind === "update") {
      this.db.updates[this.table] ??= []
      this.db.updates[this.table].push(this.mutation.payload)
      if (this.table === "monthly_cycles") {
        const row = this.db.rows.monthly_cycles.find((candidate) =>
          this.filters.every((filter) => matchesFilter(candidate, filter)),
        )
        if (!row) return { data: null, error: null }
        Object.assign(row, this.mutation.payload)
        return this.maybeSingleResult ? { data: { id: row.id }, error: null } : { data: [{ id: row.id }], error: null }
      }
      return { data: null, error: null }
    }

    const rows = this.db.rows[this.table] ?? []
    const filtered = rows.filter((row) => this.filters.every((filter) => matchesFilter(row, filter)))
    return this.maybeSingleResult ? { data: filtered[0] ?? null, error: null } : { data: filtered, error: null }
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
    ref_payment_statuses: [{ id: 4, code: "confirmed" }],
    payments: [
      {
        id: 10,
        monthly_cycle_id: 1,
        project_id: 7,
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        revenue: 1000,
        payment_amount: 30,
        payment_percentage: 3,
        status_id: 4,
        confirmed_at: "2026-04-30T12:00:00Z",
        paid_at: null,
        deleted_at: null,
      },
    ],
    onchain_payment_submissions: [],
    zkas_datasets: [{ id: 20, monthly_cycle_id: 1, project_id: 7, month: "2026-04", status: "approved", file_hash: "hash", schema_version: "v1", row_count: 2 }],
    zkas_identity_artifacts: [{ id: 21, monthly_cycle_id: 1, month: "2026-04", status: "approved", provider: "cubid", artifact_hash: "artifact", schema_version: "v1" }],
    participants: [{ project_id: 7, user_id: "user-1" }],
    users: [{ user_id: "user-1", email: "a@example.com", cubid_id: "cubid-1", cubid_identity_status: "linked", cubid_score: 80, primary_email_identity: "a@example.com", status: "active" }],
    cubid_identity_snapshots: [{ user_id: "user-1", cubid_user_id: "cubid-1", primary_email: "a@example.com", primary_phone: "+15555550123", cubid_score: 90, available_stamp_types: ["email", "phone"], verified_stamp_types: ["email"], last_synced_at: "2026-04-28T00:00:00Z" }],
    project_stats_monthly: [],
    ...overrides,
  })
}

const commandInput = {
  cycleKey: "2026-04",
  attemptId: "attempt-1",
  actorUserId: "admin-1",
  actorRole: "internal_admin" as const,
}

describe("executeMonthlyCycleLockCommand", () => {
  it("locks an open cycle into a manifest and audit event", async () => {
    const supabase = makeSupabase()

    const result = await executeMonthlyCycleLockCommand(supabase as never, commandInput, {
      now: () => new Date("2026-05-01T00:00:00.000Z"),
    })

    expect(result.ok).toBe(true)
    expect(result.ok ? result.data : null).toMatchObject({
      cycleKey: "2026-04",
      status: "locked",
      counts: {
        payments: 1,
        identitySnapshots: 1,
        approvedDatasets: 1,
        identityArtifacts: 1,
      },
      overrideApplied: false,
    })
    expect(supabase.updates.monthly_cycles[0]).toMatchObject({
      status: "locked",
      locked_at: "2026-05-01T00:00:00.000Z",
      lock_override_unresolved_onchain: false,
    })
    expect(supabase.updates.monthly_cycles[0].locked_manifest).toMatchObject({
      version: "monthly-cycle-lock.v1",
      identity_snapshots: [expect.objectContaining({ cubid_id: "cubid-1" })],
    })
    expect(supabase.inserts.monthly_cycle_events.map((event) => event.event_type)).toEqual(["lock_attempt", "lock_success"])
  })

  it("rejects missing and non-open cycles", async () => {
    const missing = await executeMonthlyCycleLockCommand(makeSupabase({ monthly_cycles: [] }) as never, commandInput)
    expect(missing).toMatchObject({ ok: false, error: { code: "cycle_not_found" } })

    const locked = await executeMonthlyCycleLockCommand(
      makeSupabase({ monthly_cycles: [{ ...cycle, status: "locked" }] }) as never,
      commandInput,
    )
    expect(locked).toMatchObject({ ok: false, error: { code: "cycle_not_open" } })
  })

  it("blocks unresolved onchain submissions unless an override reason is supplied", async () => {
    const supabase = makeSupabase({
      onchain_payment_submissions: [{ id: 30, monthly_cycle_id: 1, status: "awaiting_confirmation" }],
    })

    const blocked = await executeMonthlyCycleLockCommand(supabase as never, commandInput)
    expect(blocked).toMatchObject({ ok: false, error: { code: "unresolved_onchain_submissions" } })

    const missingReason = await executeMonthlyCycleLockCommand(supabase as never, {
      ...commandInput,
      overrideUnresolvedOnchain: true,
      overrideReason: " ",
    })
    expect(missingReason).toMatchObject({ ok: false, error: { code: "override_reason_required" } })

    const overridden = await executeMonthlyCycleLockCommand(
      makeSupabase({ onchain_payment_submissions: [{ id: 30, monthly_cycle_id: 1, status: "awaiting_confirmation" }] }) as never,
      {
        ...commandInput,
        overrideUnresolvedOnchain: true,
        overrideReason: "Operator accepted the reconciliation risk.",
      },
    )
    expect(overridden).toMatchObject({
      ok: true,
      data: {
        overrideApplied: true,
        counts: { unresolvedOnchainSubmissions: 1 },
      },
    })
  })
})
