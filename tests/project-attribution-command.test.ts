import { describe, expect, it } from "vitest"
import { executeProjectAttributionDatasetSubmitCommand } from "@/lib/attribution/project-attribution-command"

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
    in(...args: unknown[]) {
      operations.push({ table, method: "in", args })
      return this
    },
    maybeSingle() {
      operations.push({ table, method: "maybeSingle", args: [] })
      return Promise.resolve(response)
    },
    upsert(...args: unknown[]) {
      operations.push({ table, method: "upsert", args })
      return this
    },
    delete() {
      operations.push({ table, method: "delete", args: [] })
      return this
    },
    insert(...args: unknown[]) {
      operations.push({ table, method: "insert", args })
      return this
    },
    single() {
      operations.push({ table, method: "single", args: [] })
      return Promise.resolve(response)
    },
    then(resolve: (value: Response) => void) {
      operations.push({ table, method: "then", args: [] })
      resolve(response)
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

const input = {
  actorUserId: "founder-user",
  projectSlug: "civic-mesh",
  cycleKey: "2026-04",
  status: "submitted" as const,
  rows: [
    {
      scopedCubidId: "cubid-user-1",
      userId: "11111111-1111-4111-8111-111111111111",
      attributionPoints: 2,
      category: "research",
      evidenceReference: "issue-12",
      notes: "Great work",
    },
    {
      scopedCubidId: "cubid-user-2",
      attributionPoints: 3,
    },
  ],
  note: "April attribution",
}

const project = { id: 7, slug: "civic-mesh", name: "Civic Mesh", organization_id: null }
const openCycle = { id: 44, cycle_key: "2026-04", status: "open" }
const userOne = {
  user_id: "11111111-1111-4111-8111-111111111111",
  email: "one@example.com",
  cubid_id: "cubid-user-1",
  cubid_identity_status: "verified",
  primary_email_identity: "one@example.com",
}
const userTwo = {
  user_id: "22222222-2222-4222-8222-222222222222",
  email: "two@example.com",
  cubid_id: "cubid-user-2",
  cubid_identity_status: "linked",
  primary_email_identity: "two@example.com",
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
const insertedRows = [
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
  {
    id: 101,
    row_index: 2,
    scoped_cubid_id: "cubid-user-2",
    user_id: "22222222-2222-4222-8222-222222222222",
    user_email: "two@example.com",
    attribution_points: 3,
    category: null,
    evidence_reference: null,
    notes: null,
    resolution_status: "resolved",
    resolution_message: null,
  },
]

describe("project attribution dataset command", () => {
  it("creates the canonical current attribution dataset for authorized project admins", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: { id: 9, is_admin: true }, error: null }],
      monthly_cycles: [{ data: openCycle, error: null }],
      users: [
        { data: userOne, error: null },
        { data: userTwo, error: null },
      ],
      project_attribution_datasets: [{ data: dataset, error: null }],
      project_attribution_rows: [
        { data: null, error: null },
        { data: insertedRows, error: null },
      ],
    })

    const result = await executeProjectAttributionDatasetSubmitCommand(supabase as never, input)

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: 21,
        projectId: 7,
        projectSlug: "civic-mesh",
        cycleId: 44,
        cycleKey: "2026-04",
        status: "submitted",
        rowCount: 2,
        totalAttributionPoints: 5,
        rows: expect.arrayContaining([
          expect.objectContaining({ scopedCubidId: "cubid-user-1", userId: "11111111-1111-4111-8111-111111111111" }),
        ]),
      }),
    })
    expect(
      supabase.operations.find((operation) => operation.table === "project_attribution_datasets" && operation.method === "upsert")
        ?.args[1],
    ).toEqual({ onConflict: "project_id,monthly_cycle_id" })
    expect(supabase.operations.some((operation) => operation.table === "project_attribution_rows" && operation.method === "delete")).toBe(
      true,
    )
  })

  it("rejects non-admin project participants before writing", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: null, error: null }],
      ref_roles: [{ data: [], error: null }],
    })

    const result = await executeProjectAttributionDatasetSubmitCommand(supabase as never, input)

    expect(result.ok ? null : result.error.code).toBe("permission_denied")
    expect(supabase.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "participants", method: "eq", args: ["is_admin", true] }),
    ]))
    expect(supabase.operations.some((operation) => operation.table === "project_attribution_datasets")).toBe(false)
  })

  it("rejects non-project members before writing", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: null, error: null }],
      ref_roles: [{ data: [], error: null }],
    })

    const result = await executeProjectAttributionDatasetSubmitCommand(supabase as never, input)

    expect(result).toEqual({
      ok: false,
      error: {
        code: "permission_denied",
        message: "You do not have permission to submit attribution for this project.",
        projectId: 7,
        cycleId: null,
      },
    })
    expect(supabase.operations.some((operation) => operation.table === "project_attribution_datasets")).toBe(false)
  })

  it("rejects non-open monthly cycles", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: { id: 9, is_admin: true }, error: null }],
      monthly_cycles: [{ data: { ...openCycle, status: "locked" }, error: null }],
    })

    const result = await executeProjectAttributionDatasetSubmitCommand(supabase as never, input)

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("cycle_not_open")
  })

  it("rejects unresolved scoped CUBID identities", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: { id: 9, is_admin: true }, error: null }],
      monthly_cycles: [{ data: openCycle, error: null }],
      users: [{ data: null, error: null }],
    })

    const result = await executeProjectAttributionDatasetSubmitCommand(supabase as never, {
      ...input,
      rows: [{ scopedCubidId: "missing-cubid", attributionPoints: 1 }],
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("user_resolution_failed")
  })

  it("rejects users without CUBID linkage", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: { id: 9, is_admin: true }, error: null }],
      monthly_cycles: [{ data: openCycle, error: null }],
      users: [{ data: { ...userOne, cubid_identity_status: "unlinked" }, error: null }],
    })

    const result = await executeProjectAttributionDatasetSubmitCommand(supabase as never, {
      ...input,
      rows: [{ scopedCubidId: "cubid-user-1", attributionPoints: 1 }],
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("user_not_cubid_linked")
  })
})
