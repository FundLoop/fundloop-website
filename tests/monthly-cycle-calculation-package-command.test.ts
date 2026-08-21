import { describe, expect, it } from "vitest"
import { executeMonthlyCycleCalculationPackageCommand } from "@/lib/monthly-cycles/monthly-cycle-calculation-package-command"

const cycle = {
  id: 1,
  cycle_key: "2026-04",
  year: 2026,
  month: 4,
  period_start: "2026-04-01",
  period_end: "2026-04-30",
  status: "locked",
  locked_at: "2026-05-01T00:00:00.000Z",
  locked_manifest: {
    version: "monthly-cycle-lock.v1",
    mvp_inputs: {
      contribution_submissions: [
        {
          id: 30,
          project_id: 7,
          source_currency_code: "USD",
          source_amount: 1000,
          usd_equivalent_amount: 1000,
          commitment_percentage: 5,
          calculated_contribution_amount: 50,
          status: "submitted",
        },
      ],
      attribution_rows: [
        {
          id: 40,
          dataset_id: 20,
          project_id: 7,
          row_index: 1,
          scoped_cubid_id: "scope-user-1",
          user_id: "00000000-0000-4000-8000-000000000001",
          attribution_points: 3,
          resolution_status: "resolved",
        },
        {
          id: 41,
          dataset_id: 20,
          project_id: 7,
          row_index: 2,
          scoped_cubid_id: "scope-user-2",
          user_id: "00000000-0000-4000-8000-000000000002",
          attribution_points: 1,
          resolution_status: "resolved",
        },
      ],
      eligible_users: [
        {
          user_id: "00000000-0000-4000-8000-000000000001",
          cubid_id: "cubid-1",
          cubid_identity_status: "verified",
          is_eligible: true,
        },
        {
          user_id: "00000000-0000-4000-8000-000000000002",
          cubid_id: "cubid-2",
          cubid_identity_status: "linked",
          is_eligible: true,
        },
      ],
      asset_preferences: [
        {
          user_id: "00000000-0000-4000-8000-000000000001",
          has_custom_preferences: true,
          preferences: [{ rank: 1, asset_type: "fiat", asset_code: "USD", project_id: null, accepted: true }],
        },
        {
          user_id: "00000000-0000-4000-8000-000000000002",
          has_custom_preferences: true,
          preferences: [{ rank: 1, asset_type: "fiat", asset_code: "USD", project_id: null, accepted: true }],
        },
      ],
    },
  },
  locked_manifest_hash: "cycle-lock-hash",
  calculation_started_at: null,
}

function matchesFilter(row: Record<string, unknown>, filter: { key: string; type: string; value: unknown }) {
  if (filter.type === "eq") return row[filter.key] === filter.value
  if (filter.type === "neq") return row[filter.key] !== filter.value
  if (filter.type === "in") return Array.isArray(filter.value) && filter.value.includes(row[filter.key])
  return true
}

class FakeStorageBucket {
  constructor(private db: FakeSupabase) {}

  async upload(path: string, file: Blob) {
    if (this.db.failUploads) {
      return { data: null, error: { message: "Storage upload failed" } }
    }
    this.db.uploads[path] = await file.text()
    return { data: { path }, error: null }
  }
}

class FakeBuilder {
  private filters: Array<{ key: string; type: string; value: unknown }> = []
  private mutation: { kind: "insert" | "update"; payload: Record<string, unknown> | Array<Record<string, unknown>> } | null = null
  private singleResult = false
  private maybeSingleResult = false

  constructor(
    private db: FakeSupabase,
    private table: string,
  ) {}

  select() {
    return this
  }

  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
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

  neq(key: string, value: unknown) {
    this.filters.push({ key, type: "neq", value })
    return this
  }

  in(key: string, value: unknown) {
    this.filters.push({ key, type: "in", value })
    return this
  }

  order() {
    return this
  }

  single() {
    this.singleResult = true
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
      const payloads = Array.isArray(this.mutation.payload) ? this.mutation.payload : [this.mutation.payload]
      this.db.inserts[this.table] ??= []
      const inserted = payloads.map((payload) => {
        const row = { id: this.db.nextId++, ...payload }
        this.db.inserts[this.table].push(row)
        this.db.rows[this.table] ??= []
        this.db.rows[this.table].push(row)
        return row
      })
      const data = this.singleResult ? inserted[0] : inserted
      return { data, error: null }
    }

    if (this.mutation?.kind === "update") {
      this.db.updates[this.table] ??= []
      this.db.updates[this.table].push(this.mutation.payload as Record<string, unknown>)
      const rows = this.filteredRows()
      for (const row of rows) {
        Object.assign(row, this.mutation.payload)
      }
      if (this.singleResult || this.maybeSingleResult) return { data: rows[0] ?? null, error: null }
      return { data: rows, error: null }
    }

    const rows = this.filteredRows()
    if (this.singleResult) return { data: rows[0] ?? null, error: rows[0] ? null : { message: "No row" } }
    if (this.maybeSingleResult) return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }

  private filteredRows() {
    const rows = this.db.rows[this.table] ?? []
    return rows.filter((row) => this.filters.every((filter) => matchesFilter(row, filter)))
  }
}

class FakeSupabase {
  nextId = 100
  inserts: Record<string, Array<Record<string, unknown>>> = {}
  updates: Record<string, Array<Record<string, unknown>>> = {}
  uploads: Record<string, string> = {}
  failUploads = false
  storage = {
    from: () => new FakeStorageBucket(this),
  }

  constructor(public rows: Record<string, Array<Record<string, unknown>>>) {}

  from(table: string) {
    return new FakeBuilder(this, table)
  }
}

function makeSupabase(overrides: Partial<Record<string, Array<Record<string, unknown>>>> = {}) {
  return new FakeSupabase({
    monthly_cycles: [{ ...cycle }],
    monthly_cycle_events: [],
    epoch_valuation_source_lots: [],
    zkas_runs: [],
    zkas_datasets: [
      {
        id: 20,
        monthly_cycle_id: 1,
        project_id: 7,
        month: "2026-04",
        format: "csv",
        object_path: "2026-04/project-7/dataset.csv",
        file_hash: "dataset-hash",
        row_count: 12,
        status: "approved",
      },
    ],
    zkas_identity_artifacts: [
      {
        id: 21,
        monthly_cycle_id: 1,
        month: "2026-04",
        object_path: "2026-04/identity.json",
        artifact_hash: "identity-hash",
        schema_version: "identity.v1",
        status: "approved",
      },
    ],
    ref_payment_statuses: [{ id: 4, code: "confirmed" }],
    payments: [
      {
        id: 10,
        monthly_cycle_id: 1,
        project_id: 7,
        payment_amount: 50,
        period_end: "2026-04-30",
        status_id: 4,
      },
    ],
    zkas_run_datasets: [],
    zkas_run_payments: [],
    zkas_run_results: [],
    monthly_cycle_allocation_project_results: [],
    monthly_cycle_allocation_asset_fills: [],
    monthly_cycle_allocation_returned_pools: [],
    ...overrides,
  })
}

const commandInput = {
  cycleKey: "2026-04",
  attemptId: "attempt-1",
  actorUserId: "admin-1",
  actorRole: "internal_admin" as const,
}

describe("executeMonthlyCycleCalculationPackageCommand", () => {
  it("packages a locked cycle into a deterministic run and artifacts", async () => {
    const supabase = makeSupabase()
    const result = await executeMonthlyCycleCalculationPackageCommand(supabase as never, commandInput, {
      now: () => new Date("2026-05-01T01:00:00.000Z"),
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        cycleKey: "2026-04",
        status: "calculation",
        runStatus: "completed",
        counts: { datasets: 1, payments: 1, identityArtifacts: 1, resultRows: 2, projectResults: 2, assetFills: 2, returnedPools: 0 },
      },
    })
    expect(supabase.inserts.zkas_runs[0]).toMatchObject({
      month: "2026-04",
      monthly_cycle_id: 1,
      status: "completed",
    })
    expect(supabase.inserts.zkas_run_datasets[0]).toMatchObject({ dataset_id: 20, run_id: 101 })
    expect(supabase.inserts.zkas_run_payments[0]).toMatchObject({ payment_id: 10, monthly_cycle_id: 1, run_id: 101 })
    expect(supabase.inserts.zkas_run_results).toHaveLength(2)
    expect(supabase.inserts.zkas_run_results[0]).toMatchObject({
      run_id: 101,
      monthly_cycle_id: 1,
      zkas_user_id: "00000000-0000-4000-8000-000000000001",
      eligibility: true,
      allocation_usd: 37.5,
    })
    expect(supabase.inserts.monthly_cycle_allocation_project_results).toHaveLength(2)
    expect(supabase.inserts.monthly_cycle_allocation_asset_fills).toHaveLength(2)
    expect(supabase.updates.monthly_cycles[0]).toMatchObject({
      status: "calculation",
      calculation_started_at: "2026-05-01T01:00:00.000Z",
    })
    expect(supabase.updates.zkas_runs[0]).toMatchObject({
      status: "completed",
      result_artifact_path: "2026-04/run-101/run-result.v1.json",
      total_allocated_usd: 50,
      user_count: 2,
    })
    expect(Object.keys(supabase.uploads)).toEqual([
      "2026-04/cycle-1/calculation-package.v1.json",
      "2026-04/run-101/run-manifest.v1.json",
      "2026-04/run-101/run-result.v1.json",
    ])
    expect(supabase.uploads["2026-04/run-101/run-result.v1.json"]).toContain("mvp_capped_equalization_v1")
    expect(supabase.inserts.monthly_cycle_events.map((event) => event.event_type)).toEqual([
      "calculation_package_attempt",
      "calculation_package_success",
    ])
  })

  it("returns the persisted package hash when a package already exists", async () => {
    const result = await executeMonthlyCycleCalculationPackageCommand(
      makeSupabase({
        zkas_runs: [
          {
            id: 88,
            monthly_cycle_id: 1,
            month: "2026-04",
            status: "locked",
            locked_at: "2026-05-01T01:00:00.000Z",
            locked_manifest_hash: "run-manifest-hash",
            locked_manifest: { package_artifact_hash: "package-artifact-hash" },
            result_artifact_path: "2026-04/run-88/run-result.v1.json",
            result_artifact_hash: "result-artifact-hash",
          },
        ],
      }) as never,
      commandInput,
    )

    expect(result).toMatchObject({
      ok: true,
      data: {
        runId: 88,
        packageArtifactHash: "package-artifact-hash",
        resultArtifactHash: "result-artifact-hash",
        runManifestHash: "run-manifest-hash",
      },
    })
  })

  it("marks a partially-created run failed when artifact upload fails so operators can retry", async () => {
    const supabase = makeSupabase()
    supabase.failUploads = true

    const result = await executeMonthlyCycleCalculationPackageCommand(supabase as never, commandInput)

    expect(result).toMatchObject({ ok: false, error: { code: "artifact_upload_failed" } })
    expect(supabase.updates.zkas_runs[0]).toMatchObject({
      status: "failed",
      note: "Storage upload failed",
    })
  })

  it("rejects cycles that are not locked", async () => {
    const result = await executeMonthlyCycleCalculationPackageCommand(
      makeSupabase({ monthly_cycles: [{ ...cycle, status: "open", locked_at: null, locked_manifest: null, locked_manifest_hash: null }] }) as never,
      commandInput,
    )

    expect(result).toMatchObject({ ok: false, error: { code: "cycle_not_ready" } })
  })

  it("routes journal-backed sources away from the legacy point calculator", async () => {
    const result=await executeMonthlyCycleCalculationPackageCommand(makeSupabase({epoch_valuation_source_lots:[{id:99,monthly_cycle_id:1,state:"ready_for_lock"}]}) as never,commandInput)
    expect(result).toMatchObject({ok:false,error:{code:"settled_allocation_required"}})
  })

  it("rejects missing or ambiguous inputs", async () => {
    const missingDataset = await executeMonthlyCycleCalculationPackageCommand(makeSupabase({ zkas_datasets: [] }) as never, commandInput)
    expect(missingDataset).toMatchObject({ ok: false, error: { code: "missing_approved_datasets" } })

    const duplicateProject = await executeMonthlyCycleCalculationPackageCommand(
      makeSupabase({
        zkas_datasets: [
          makeSupabase().rows.zkas_datasets[0],
          { ...makeSupabase().rows.zkas_datasets[0], id: 22 },
        ],
      }) as never,
      commandInput,
    )
    expect(duplicateProject).toMatchObject({ ok: false, error: { code: "duplicate_project_dataset" } })

    const ambiguousArtifact = await executeMonthlyCycleCalculationPackageCommand(
      makeSupabase({
        zkas_identity_artifacts: [
          makeSupabase().rows.zkas_identity_artifacts[0],
          { ...makeSupabase().rows.zkas_identity_artifacts[0], id: 23 },
        ],
      }) as never,
      commandInput,
    )
    expect(ambiguousArtifact).toMatchObject({ ok: false, error: { code: "ambiguous_identity_artifacts" } })
  })
})
