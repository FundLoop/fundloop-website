import { describe, expect, it } from "vitest"
import { executeProjectAttributionDatasetReviewCommand } from "@/lib/attribution/project-attribution-review-command"

type Response = { data: unknown; error: { message: string } | null }

function createQueryResponse(response: Response, operations: Array<{ table: string; method: string; args: unknown[] }>, table: string) {
  return {
    select(...args: unknown[]) {
      operations.push({ table, method: "select", args })
      return this
    },
    eq(...args: unknown[]) {
      operations.push({ table, method: "eq", args })
      return this
    },
    order(...args: unknown[]) {
      operations.push({ table, method: "order", args })
      return Promise.resolve(response)
    },
    maybeSingle() {
      operations.push({ table, method: "maybeSingle", args: [] })
      return Promise.resolve(response)
    },
    update(...args: unknown[]) {
      operations.push({ table, method: "update", args })
      return this
    },
    insert(...args: unknown[]) {
      operations.push({ table, method: "insert", args })
      return Promise.resolve(response)
    },
    single() {
      operations.push({ table, method: "single", args: [] })
      return Promise.resolve(response)
    },
  }
}

function createSupabaseMock(responsesByTable: Record<string, Response[]>) {
  const counters = new Map<string, number>()
  const operations: Array<{ table: string; method: string; args: unknown[] }> = []

  return {
    operations,
    from(table: string) {
      const nextIndex = counters.get(table) ?? 0
      counters.set(table, nextIndex + 1)
      return createQueryResponse(responsesByTable[table]?.[nextIndex] ?? { data: null, error: null }, operations, table)
    },
  }
}

const dataset = {
  id: 21,
  project_id: 7,
  monthly_cycle_id: 44,
  status: "submitted",
  row_count: 2,
  total_attribution_points: 5,
  note: "April attribution",
  proof_type: "raw_rows",
  proof_artifact_uri: null,
  verifier_backend: null,
  verification_status: "not_required",
  submitted_by_user_id: "founder-user",
  submitted_at: "2026-04-30T12:00:00.000Z",
  updated_at: "2026-04-30T12:00:00.000Z",
}
const project = { id: 7, slug: "civic-mesh", name: "Civic Mesh" }
const cycle = { id: 44, cycle_key: "2026-04" }
const rows = [
  {
    id: 100,
    row_index: 1,
    scoped_cubid_id: "cubid-user-1",
    user_id: "11111111-1111-4111-8111-111111111111",
    user_email: "one@example.com",
    attribution_points: 2,
    category: "research",
    evidence_reference: "issue-12",
    notes: "Great work",
    resolution_status: "resolved",
    resolution_message: null,
  },
]

describe("project attribution dataset review command", () => {
  it("approves submitted attribution datasets and records an audit event", async () => {
    const supabase = createSupabaseMock({
      project_attribution_datasets: [
        { data: dataset, error: null },
        { data: { ...dataset, status: "approved" }, error: null },
      ],
      projects: [{ data: project, error: null }],
      monthly_cycles: [{ data: cycle, error: null }],
      project_attribution_rows: [{ data: rows, error: null }],
      monthly_cycle_events: [{ data: null, error: null }],
    })

    const result = await executeProjectAttributionDatasetReviewCommand(supabase as never, {
      datasetId: 21,
      decision: "approved",
      attemptId: "attempt-1",
      actorUserId: "operator-user",
      actorRole: "internal_admin",
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: 21,
        projectSlug: "civic-mesh",
        cycleKey: "2026-04",
        status: "approved",
        decision: "approved",
        reviewedByUserId: "operator-user",
      }),
    })
    expect(
      supabase.operations.find((operation) => operation.table === "project_attribution_datasets" && operation.method === "update")
        ?.args[0],
    ).toEqual(
      expect.objectContaining({
        status: "approved",
        approved_by_user_id: "operator-user",
      }),
    )
    expect(
      supabase.operations.find((operation) => operation.table === "monthly_cycle_events" && operation.method === "insert")?.args[0],
    ).toEqual(
      expect.objectContaining({
        event_type: "attribution_dataset_review",
        outcome: "success",
        severity: "info",
      }),
    )
  })

  it("rejects submitted attribution datasets with a reason", async () => {
    const supabase = createSupabaseMock({
      project_attribution_datasets: [
        { data: dataset, error: null },
        { data: { ...dataset, status: "rejected" }, error: null },
      ],
      projects: [{ data: project, error: null }],
      monthly_cycles: [{ data: cycle, error: null }],
      project_attribution_rows: [{ data: rows, error: null }],
      monthly_cycle_events: [{ data: null, error: null }],
    })

    const result = await executeProjectAttributionDatasetReviewCommand(supabase as never, {
      datasetId: 21,
      decision: "rejected",
      reason: "Unresolved duplicate identities.",
      actorUserId: "operator-user",
      actorRole: "internal_admin",
    })

    expect(result.ok).toBe(true)
    expect(result.ok ? result.data.reason : null).toBe("Unresolved duplicate identities.")
    expect(
      supabase.operations.find((operation) => operation.table === "project_attribution_datasets" && operation.method === "update")
        ?.args[0],
    ).toEqual(
      expect.objectContaining({
        status: "rejected",
        rejected_by_user_id: "operator-user",
        rejection_reason: "Unresolved duplicate identities.",
      }),
    )
  })

  it("requires internal operator access before reading datasets", async () => {
    const supabase = createSupabaseMock({})

    const result = await executeProjectAttributionDatasetReviewCommand(supabase as never, {
      datasetId: 21,
      decision: "approved",
      actorUserId: "regular-user",
      actorRole: "user",
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "You do not have internal operator access to review attribution datasets.",
      },
    })
    expect(supabase.operations).toEqual([])
  })

  it("rejects datasets that are not submitted", async () => {
    const supabase = createSupabaseMock({
      project_attribution_datasets: [{ data: { ...dataset, status: "approved" }, error: null }],
    })

    const result = await executeProjectAttributionDatasetReviewCommand(supabase as never, {
      datasetId: 21,
      decision: "approved",
      actorUserId: "operator-user",
      actorRole: "internal_admin",
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("dataset_not_submitted")
  })
})
