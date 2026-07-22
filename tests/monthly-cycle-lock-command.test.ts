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

  gt() {
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
      const insertError = this.db.insertErrors[this.table]
      if (insertError) return { data: null, error: insertError }
      this.db.inserts[this.table] ??= []
      this.db.inserts[this.table].push(this.mutation.payload)
      return { data: null, error: null }
    }

    if (this.mutation?.kind === "update") {
      this.db.updates[this.table] ??= []
      this.db.updates[this.table].push(this.mutation.payload)
      const rows = this.db.rows[this.table] ?? []
      const matchingRows = rows.filter((candidate) => this.filters.every((filter) => matchesFilter(candidate, filter)))
      for (const row of matchingRows) {
        Object.assign(row, this.mutation.payload)
      }
      if (this.table === "monthly_cycles") {
        const row = matchingRows[0]
        if (!row) return { data: null, error: null }
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
  insertErrors: Record<string, { message: string }> = {}

  constructor(public rows: Record<string, Array<Record<string, unknown>>>) {}

  from(table: string) {
    return new FakeBuilder(this, table)
  }
}

function makeSupabase(overrides: Partial<Record<string, Array<Record<string, unknown>>>> = {}) {
  return new FakeSupabase({
    monthly_cycles: [{ ...cycle }],
    ref_payment_statuses: [{ id: 4, code: "confirmed" }],
    projects: [{ id: 7, slug: "civic-mesh", name: "Civic Mesh", status: "active", payment_percentage: 3, deleted_at: null }],
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
    project_monthly_contribution_submissions: [
      {
        id: 40,
        monthly_cycle_id: 1,
        project_id: 7,
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        source_currency_code: "USD",
        source_amount: 1000,
        usd_equivalent_amount: 1000,
        commitment_percentage: 3,
        calculated_contribution_amount: 30,
        source_reference: "ledger-2026-04",
        status: "submitted",
        submitted_by_user_id: "admin-1",
        submitted_at: "2026-04-30T12:00:00Z",
        updated_at: "2026-04-30T12:00:00Z",
      },
    ],
    project_attribution_datasets: [
      {
        id: 50,
        monthly_cycle_id: 1,
        project_id: 7,
        status: "approved",
        row_count: 1,
        total_attribution_points: 10,
        note: "Approved MVP attribution",
        proof_type: "raw_rows",
        proof_artifact_uri: null,
        verifier_backend: null,
        verification_status: "not_required",
        submitted_by_user_id: "admin-1",
        submitted_at: "2026-04-29T12:00:00Z",
        approved_by_user_id: "operator-1",
        approved_at: "2026-04-30T12:00:00Z",
        updated_at: "2026-04-30T12:00:00Z",
      },
    ],
    project_attribution_rows: [
      {
        id: 60,
        dataset_id: 50,
        monthly_cycle_id: 1,
        project_id: 7,
        row_index: 0,
        scoped_cubid_id: "scoped-cubid-1",
        user_id: "user-1",
        user_email: "a@example.com",
        attribution_points: 10,
        category: "maintainer",
        evidence_reference: "issue-thread-1",
        notes: "Resolved contributor",
        resolution_status: "resolved",
        resolution_message: null,
        created_at: "2026-04-29T12:00:00Z",
      },
    ],
    user_asset_preferences: [
      {
        id: 70,
        user_id: "user-1",
        rank: 1,
        asset_type: "stablecoin",
        asset_code: "USDC",
        project_id: null,
        accepted: true,
        updated_at: "2026-04-28T00:00:00Z",
      },
      {
        id: 71,
        user_id: "user-1",
        rank: 2,
        asset_type: "project_token",
        asset_code: "CIVIC",
        project_id: 7,
        accepted: false,
        updated_at: "2026-04-28T00:00:00Z",
      },
    ],
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
      mvp_inputs: {
        contribution_submissions: [expect.objectContaining({ project_id: 7, calculated_contribution_amount: 30 })],
        attribution_datasets: [expect.objectContaining({ id: 50, proof_type: "raw_rows" })],
        attribution_rows: [expect.objectContaining({ scoped_cubid_id: "scoped-cubid-1", attribution_points: 10 })],
        eligible_users: [expect.objectContaining({ user_id: "user-1", is_eligible: true, attributed_project_ids: [7] })],
        asset_preferences: [expect.objectContaining({ user_id: "user-1", has_custom_preferences: true })],
        counts: expect.objectContaining({
          contributionSubmissions: 1,
          attributionDatasets: 1,
          attributionRows: 1,
          eligibleUsers: 1,
          assetPreferenceSummaries: 1,
          usersRejectingProjectTokens: 1,
        }),
        checksums: expect.objectContaining({
          contributionSubmissions: expect.any(String),
          attributionRows: expect.any(String),
          assetPreferenceSummaries: expect.any(String),
        }),
      },
    })
    expect(supabase.inserts.monthly_cycle_events.map((event) => event.event_type)).toEqual(["lock_attempt", "lock_success"])
  })

  it("keeps the deterministic MVP lock fixture stable and destination-free", async () => {
    const first = makeSupabase()
    const second = makeSupabase({
      user_asset_preferences: [
        {
          id: 71,
          user_id: "user-1",
          rank: 2,
          asset_type: "project_token",
          asset_code: "CIVIC",
          project_id: 7,
          accepted: false,
          updated_at: "2026-04-28T00:00:00Z",
          wallet_address: "0xshould-not-leak",
        },
        {
          id: 70,
          user_id: "user-1",
          rank: 1,
          asset_type: "stablecoin",
          asset_code: "USDC",
          project_id: null,
          accepted: true,
          updated_at: "2026-04-28T00:00:00Z",
          bank_account: "should-not-leak",
        },
      ],
    })

    const firstResult = await executeMonthlyCycleLockCommand(first as never, commandInput, {
      now: () => new Date("2026-05-01T00:00:00.000Z"),
    })
    const secondResult = await executeMonthlyCycleLockCommand(second as never, commandInput, {
      now: () => new Date("2026-05-01T00:00:00.000Z"),
    })

    expect(firstResult.ok && secondResult.ok ? firstResult.data.lockedManifestHash : null).toBe(
      secondResult.ok ? secondResult.data.lockedManifestHash : null,
    )
    const manifest = second.updates.monthly_cycles[0].locked_manifest
    expect(manifest).toMatchObject({
      mvp_inputs: {
        counts: {
          contributionSubmissions: 1,
          attributionDatasets: 1,
          attributionRows: 1,
          eligibleUsers: 1,
          assetPreferenceSummaries: 1,
          usersRejectingProjectTokens: 1,
        },
        checksums: {
          contributionSubmissions: expect.stringMatching(/^[a-f0-9]{64}$/),
          attributionDatasets: expect.stringMatching(/^[a-f0-9]{64}$/),
          attributionRows: expect.stringMatching(/^[a-f0-9]{64}$/),
          eligibleUsers: expect.stringMatching(/^[a-f0-9]{64}$/),
          identitySnapshots: expect.stringMatching(/^[a-f0-9]{64}$/),
          assetPreferenceSummaries: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      },
    })
    expect(JSON.stringify(manifest)).not.toContain("should-not-leak")
    expect(JSON.stringify(manifest)).not.toContain("wallet_address")
    expect(JSON.stringify(manifest)).not.toContain("bank_account")
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

  it("blocks missing required MVP inputs unless an override reason is supplied", async () => {
    const blocked = await executeMonthlyCycleLockCommand(
      makeSupabase({
        project_monthly_contribution_submissions: [],
        project_attribution_datasets: [],
        project_attribution_rows: [],
      }) as never,
      commandInput,
    )

    expect(blocked).toMatchObject({ ok: false, error: { code: "missing_mvp_required_inputs" } })

    const missingReason = await executeMonthlyCycleLockCommand(
      makeSupabase({
        project_monthly_contribution_submissions: [],
        project_attribution_datasets: [],
        project_attribution_rows: [],
      }) as never,
      {
        ...commandInput,
        overrideRequiredInputs: true,
        overrideReason: " ",
      },
    )
    expect(missingReason).toMatchObject({ ok: false, error: { code: "override_reason_required" } })

    const overriddenSupabase = makeSupabase({
      project_monthly_contribution_submissions: [],
      project_attribution_datasets: [],
      project_attribution_rows: [],
    })
    const overridden = await executeMonthlyCycleLockCommand(overriddenSupabase as never, {
      ...commandInput,
      overrideRequiredInputs: true,
      overrideReason: "Operator accepted the missing MVP input risk.",
    })

    expect(overridden).toMatchObject({
      ok: true,
      data: {
        overrideApplied: true,
      },
    })
    expect(overriddenSupabase.updates.monthly_cycles[0].locked_manifest).toMatchObject({
      override: {
        required_inputs: true,
        reason: "Operator accepted the missing MVP input risk.",
      },
      mvp_inputs: {
        required_input_blockers: expect.arrayContaining([
          expect.objectContaining({ code: "missing_contribution_submissions" }),
          expect.objectContaining({ code: "missing_approved_attribution_datasets" }),
        ]),
      },
    })
    expect(overriddenSupabase.inserts.monthly_cycle_events.at(-1)?.metadata).toMatchObject({
      overrideApplied: true,
      requiredInputBlockers: expect.any(Array),
    })
  })

  it("fails before lock mutations when audit event insertion fails", async () => {
    const supabase = makeSupabase()
    supabase.insertErrors.monthly_cycle_events = { message: "event insert failed" }

    const result = await executeMonthlyCycleLockCommand(supabase as never, commandInput)

    expect(result).toMatchObject({ ok: false, error: { code: "query_failed", message: "event insert failed" } })
    expect(supabase.updates.monthly_cycles ?? []).toEqual([])
  })

  it("reattaches onchain submissions through the payment cycle instead of submitted month", async () => {
    const supabase = makeSupabase({
      onchain_payment_submissions: [
        {
          id: 30,
          payment_id: 10,
          monthly_cycle_id: null,
          status: "confirmed",
          submitted_at: "2026-05-04T00:00:00Z",
        },
      ],
    })

    const result = await executeMonthlyCycleLockCommand(supabase as never, commandInput)

    expect(result.ok ? result.data.counts.onchainSubmissions : null).toBe(1)
    expect(supabase.rows.onchain_payment_submissions[0]).toMatchObject({
      id: 30,
      monthly_cycle_id: 1,
    })
  })
})
