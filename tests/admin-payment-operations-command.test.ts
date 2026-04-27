import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  executeAdminOnchainPaymentReconciliationRunCommand,
  executeAdminPaymentReceiptConfirmCommand,
  type AdminPaymentOperationsCommandDeps,
} from "@/lib/payments/admin-payment-operations-command"

const { runOnchainPaymentReconciliation } = vi.hoisted(() => ({
  runOnchainPaymentReconciliation: vi.fn(),
}))

vi.mock("@/lib/onchain/payment-reconciliation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/onchain/payment-reconciliation")>(
    "@/lib/onchain/payment-reconciliation",
  )

  return {
    ...actual,
    runOnchainPaymentReconciliation,
  }
})

type QueryResponse = { data?: unknown; error?: { message: string } | null }

function createSupabaseMock(responsesByTable: Record<string, QueryResponse[]>) {
  const counters = new Map<string, number>()
  const inserts: Array<{ table: string; payload: unknown }> = []
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

  function createQuery(table: string, response: QueryResponse) {
    return {
      select() {
        return this
      },
      eq() {
        return this
      },
      in() {
        return this
      },
      limit() {
        return this
      },
      maybeSingle() {
        return Promise.resolve(response)
      },
      single() {
        return Promise.resolve(response)
      },
      insert(payload: unknown) {
        inserts.push({ table, payload })
        return this
      },
      update(payload: unknown) {
        inserts.push({ table: `${table}:update`, payload })
        return this
      },
      then(onFulfilled: (value: QueryResponse) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(response).then(onFulfilled, onRejected)
      },
    }
  }

  return {
    inserts,
    rpc,
    from(table: string) {
      const nextIndex = counters.get(table) ?? 0
      counters.set(table, nextIndex + 1)
      return createQuery(table, responsesByTable[table]?.[nextIndex] ?? { data: null, error: null })
    },
  }
}

const deps: AdminPaymentOperationsCommandDeps = {
  environment: "local",
}

describe("admin payment operation commands", () => {
  beforeEach(() => {
    runOnchainPaymentReconciliation.mockReset()
  })

  it("rejects manual confirmation when an onchain submission already exists", async () => {
    const supabase = createSupabaseMock({
      payments: [{ data: { id: 22, project_id: 7, projects: { slug: "fundloop-studio" } }, error: null }],
      ref_payment_statuses: [{ data: { id: 9, code: "confirmed" }, error: null }],
      onchain_payment_submissions: [{ data: { id: 44 }, error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
    })

    const result = await executeAdminPaymentReceiptConfirmCommand(
      supabase as never,
      {
        actorUserId: "admin-1",
        actorRole: "internal_admin",
        attemptId: "attempt-admin-1",
        paymentId: 22,
      },
      deps,
    )

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("requires_reconciliation")
    expect(supabase.inserts.filter((entry) => entry.table === "payment_flow_events")).toHaveLength(2)
  })

  it("returns a query failure when confirmation prerequisites cannot be loaded", async () => {
    const supabase = createSupabaseMock({
      payments: [{ data: null, error: { message: "database timeout" } }],
      ref_payment_statuses: [{ data: { id: 9, code: "confirmed" }, error: null }],
      onchain_payment_submissions: [{ data: null, error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
    })

    const result = await executeAdminPaymentReceiptConfirmCommand(
      supabase as never,
      {
        actorUserId: "admin-1",
        actorRole: "internal_admin",
        attemptId: "attempt-admin-query-failed",
        paymentId: 22,
      },
      deps,
    )

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("query_failed")
    expect(supabase.inserts).not.toContainEqual(expect.objectContaining({ table: "payments:update" }))
    expect(supabase.inserts.filter((entry) => entry.table === "payment_flow_events")).toHaveLength(2)
  })

  it("preserves payment-not-found when the payment lookup returns no row", async () => {
    const supabase = createSupabaseMock({
      payments: [{ data: null, error: null }],
      ref_payment_statuses: [{ data: { id: 9, code: "confirmed" }, error: null }],
      onchain_payment_submissions: [{ data: null, error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
    })

    const result = await executeAdminPaymentReceiptConfirmCommand(
      supabase as never,
      {
        actorUserId: "admin-1",
        actorRole: "internal_admin",
        attemptId: "attempt-admin-payment-missing",
        paymentId: 404,
      },
      deps,
    )

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("payment_not_found")
  })

  it("preserves status-not-configured when the confirmed status lookup returns no row", async () => {
    const supabase = createSupabaseMock({
      payments: [{ data: { id: 22, project_id: 7, projects: { slug: "fundloop-studio" } }, error: null }],
      ref_payment_statuses: [{ data: null, error: null }],
      onchain_payment_submissions: [{ data: null, error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
    })

    const result = await executeAdminPaymentReceiptConfirmCommand(
      supabase as never,
      {
        actorUserId: "admin-1",
        actorRole: "internal_admin",
        attemptId: "attempt-admin-status-missing",
        paymentId: 22,
      },
      deps,
    )

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("status_not_configured")
  })

  it("confirms a manual payment and records observability", async () => {
    const supabase = createSupabaseMock({
      payments: [{ data: { id: 22, project_id: 7, projects: { slug: "fundloop-studio" } }, error: null }],
      ref_payment_statuses: [{ data: { id: 9, code: "confirmed" }, error: null }],
      onchain_payment_submissions: [{ data: null, error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
    })

    const result = await executeAdminPaymentReceiptConfirmCommand(
      supabase as never,
      {
        actorUserId: "admin-1",
        actorRole: "internal_admin",
        attemptId: "attempt-admin-2",
        paymentId: 22,
      },
      deps,
    )

    expect(result).toMatchObject({
      ok: true,
      data: {
        paymentId: 22,
        statusCode: "confirmed",
      },
    })
    expect(supabase.inserts).toContainEqual(
      expect.objectContaining({
        table: "payments:update",
        payload: expect.objectContaining({
          status_id: 9,
        }),
      }),
    )
    expect(supabase.inserts).not.toContainEqual(expect.objectContaining({ table: "onchain_payment_submissions:update" }))
    expect(supabase.inserts.filter((entry) => entry.table === "payment_flow_events")).toHaveLength(2)
  })

  it("records a system reconciliation run and returns the summary", async () => {
    runOnchainPaymentReconciliation.mockResolvedValue({
      source: "cron",
      processedCount: 2,
      confirmedCount: 1,
      failedCount: 1,
      confirmingCount: 0,
      unresolvedCount: 0,
      results: [],
      touchedProjectSlugs: ["fundloop-studio"],
    })

    const supabase = createSupabaseMock({
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
      cron_logs: [{ data: null, error: null }],
    })

    const result = await executeAdminOnchainPaymentReconciliationRunCommand(
      supabase as never,
      {
        actorUserId: null,
        actorRole: "system",
        attemptId: "attempt-reconcile-1",
        source: "cron",
        paymentId: 22,
      },
      deps,
    )

    expect(runOnchainPaymentReconciliation).toHaveBeenCalledWith(
      {
        source: "cron",
        limit: undefined,
        paymentId: 22,
        submissionId: undefined,
      },
      { supabase },
    )
    expect(result).toMatchObject({
      ok: true,
      data: {
        processedCount: 2,
        confirmedCount: 1,
      },
    })
    expect(supabase.inserts.filter((entry) => entry.table === "payment_flow_events")).toHaveLength(2)
  })
})
