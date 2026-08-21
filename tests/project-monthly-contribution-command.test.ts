import { describe, expect, it } from "vitest"
import { executeProjectMonthlyContributionSubmitCommand } from "@/lib/contributions/project-monthly-contribution-command"

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

const input = {
  actorUserId: "user-1",
  projectSlug: "civic-mesh",
  cycleKey: "2026-04",
  periodStart: "2026-04-01",
  periodEnd: "2026-04-30",
  sourceCurrency: "USD",
  sourceAmount: 1000,
  usdEquivalentAmount: 1000,
  commitmentPercentage: 1,
  calculatedContributionAmount: 10,
  sourceReference: "invoice-2026-04",
  notes: "April revenue",
}

const project = { id: 7, slug: "civic-mesh", name: "Civic Mesh", organization_id: null, payment_percentage: 1 }
const openCycle = { id: 44, cycle_key: "2026-04", period_start: "2026-04-01", period_end: "2026-04-30", status: "open" }
const submission = {
  id: 12,
  project_id: 7,
  monthly_cycle_id: 44,
  period_start: "2026-04-01",
  period_end: "2026-04-30",
  source_currency_code: "USD",
  source_amount: 1000,
  usd_equivalent_amount: 1000,
  commitment_percentage: 1,
  calculated_contribution_amount: 10,
  source_reference: "invoice-2026-04",
  notes: "April revenue",
  status: "submitted",
  submitted_by_user_id: "user-1",
  submitted_at: "2026-04-30T12:00:00.000Z",
  updated_at: "2026-04-30T12:00:00.000Z",
  projects: { slug: "civic-mesh" },
  monthly_cycles: { cycle_key: "2026-04" },
}

describe("project monthly contribution command", () => {
  it("creates or replaces the canonical current contribution submission for an authorized project admin", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: { id: 9, is_admin: true }, error: null }],
      monthly_cycles: [{ data: openCycle, error: null }],
      project_monthly_contribution_submissions: [{ data: submission, error: null }],
    })

    const result = await executeProjectMonthlyContributionSubmitCommand(supabase as never, input)

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: 12,
        projectId: 7,
        projectSlug: "civic-mesh",
        cycleId: 44,
        cycleKey: "2026-04",
        sourceCurrency: "USD",
        usdEquivalentAmount: 1000,
        calculatedContributionAmount: 10,
      }),
    })
    expect(
      supabase.operations.find(
        (operation) => operation.table === "project_monthly_contribution_submissions" && operation.method === "upsert",
      )?.args[1],
    ).toEqual({ onConflict: "project_id,monthly_cycle_id" })
  })

  it("recomputes the authoritative contribution amount server-side", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: { id: 9, is_admin: true }, error: null }],
      monthly_cycles: [{ data: openCycle, error: null }],
      project_monthly_contribution_submissions: [{ data: { ...submission, calculated_contribution_amount: 10 }, error: null }],
    })

    await executeProjectMonthlyContributionSubmitCommand(supabase as never, {
      ...input,
      calculatedContributionAmount: 0,
    })

    const upsertPayload = supabase.operations.find(
      (operation) => operation.table === "project_monthly_contribution_submissions" && operation.method === "upsert",
    )?.args[0] as Record<string, unknown>
    expect(upsertPayload.calculated_contribution_amount).toBe(10)
  })

  it("rejects non-admin project participants before writing", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: null, error: null }],
      ref_roles: [{ data: [], error: null }],
    })

    const result = await executeProjectMonthlyContributionSubmitCommand(supabase as never, input)

    expect(result.ok ? null : result.error.code).toBe("permission_denied")
    expect(supabase.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "participants", method: "eq", args: ["is_admin", true] }),
    ]))
    expect(supabase.operations.some((operation) => operation.table === "project_monthly_contribution_submissions")).toBe(false)
  })

  it("rejects non-project members before writing", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: null, error: null }],
      ref_roles: [{ data: [], error: null }],
    })

    const result = await executeProjectMonthlyContributionSubmitCommand(supabase as never, input)

    expect(result).toEqual({
      ok: false,
      error: {
        code: "permission_denied",
        message: "You do not have permission to submit contributions for this project.",
        projectId: 7,
        cycleId: null,
      },
    })
    expect(supabase.operations.some((operation) => operation.table === "project_monthly_contribution_submissions")).toBe(false)
  })

  it("rejects non-open monthly cycles", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: { id: 9, is_admin: true }, error: null }],
      monthly_cycles: [{ data: { ...openCycle, status: "locked" }, error: null }],
    })

    const result = await executeProjectMonthlyContributionSubmitCommand(supabase as never, input)

    expect(result).toEqual({
      ok: false,
      error: {
        code: "cycle_not_open",
        message: "Monthly contribution submissions can only be changed while the cycle is open.",
        projectId: 7,
        cycleId: 44,
      },
    })
  })

  it("rejects contribution periods that do not match cycle bounds", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: project, error: null }],
      participants: [{ data: { id: 9, is_admin: true }, error: null }],
      monthly_cycles: [{ data: openCycle, error: null }],
    })

    const result = await executeProjectMonthlyContributionSubmitCommand(supabase as never, {
      ...input,
      periodEnd: "2026-04-29",
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("period_mismatch")
  })

  it("rejects submissions when the project commitment is missing or mismatched", async () => {
    const missing = await executeProjectMonthlyContributionSubmitCommand(
      createSupabaseMock({
        projects: [{ data: { ...project, payment_percentage: null }, error: null }],
        participants: [{ data: { id: 9, is_admin: true }, error: null }],
      }) as never,
      input,
    )
    const mismatched = await executeProjectMonthlyContributionSubmitCommand(
      createSupabaseMock({
        projects: [{ data: { ...project, payment_percentage: 3 }, error: null }],
        participants: [{ data: { id: 9, is_admin: true }, error: null }],
      }) as never,
      input,
    )

    expect(missing.ok ? null : missing.error.code).toBe("commitment_missing")
    expect(mismatched.ok ? null : mismatched.error.code).toBe("commitment_mismatch")
  })
})
