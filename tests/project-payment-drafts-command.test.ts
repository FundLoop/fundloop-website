import { describe, expect, it } from "vitest"
import { executeProjectPaymentDraftsCommand } from "@/lib/payments/project-payment-drafts-command"

function createQueryResponse(response: unknown) {
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
    maybeSingle() {
      return Promise.resolve(response)
    },
    single() {
      return Promise.resolve(response)
    },
    insert() {
      return this
    },
    order() {
      return this
    },
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(response).then(onFulfilled, onRejected)
    },
  }
}

function createSupabaseMock(responsesByTable: Record<string, unknown[]>) {
  const counters = new Map<string, number>()

  return {
    from(table: string) {
      const nextIndex = counters.get(table) ?? 0
      counters.set(table, nextIndex + 1)
      return createQueryResponse(responsesByTable[table]?.[nextIndex] ?? { data: null, error: null })
    },
  }
}

describe("project payment drafts command", () => {
  it("creates draft payments for a project admin", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "fundloop-studio", name: "FundLoop Studio", organization_id: null }, error: null }],
      participants: [{ data: { id: 11 }, error: null }],
      ref_roles: [{ data: [], error: null }],
      ref_payment_statuses: [{ data: { id: 3 }, error: null }],
      ref_payment_methods: [{ data: [{ id: 1 }], error: null }],
      payments: [
        {
          data: [
            {
              id: 99,
              project_id: 7,
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              revenue: 1000,
              payment_amount: 10,
              payment_percentage: 1,
              payment_method_id: 1,
              status_id: 3,
              notes: null,
              created_at: "2026-04-14T12:00:00.000Z",
              updated_at: "2026-04-14T12:00:00.000Z",
              paid_at: null,
              confirmed_at: null,
              projects: { name: "FundLoop Studio", slug: "fundloop-studio" },
              ref_payment_methods: { name: "Crypto contract", code: "crypto_contract" },
              ref_payment_statuses: { name: "Draft", code: "draft" },
            },
          ],
          error: null,
        },
      ],
    })

    const result = await executeProjectPaymentDraftsCommand(supabase as never, {
      actorUserId: "user-1",
      projectSlug: "fundloop-studio",
      payments: [
        {
          period_start: "2026-04-01",
          period_end: "2026-04-30",
          revenue: 1000,
          payment_amount: 10,
          payment_percentage: 1,
          payment_method_id: 1,
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      data: {
        actorUserId: "user-1",
        projectId: 7,
        payments: [
          expect.objectContaining({
            id: 99,
            project_id: 7,
            project_name: "FundLoop Studio",
            payment_method_code: "crypto_contract",
            status_code: "draft",
          }),
        ],
      },
    })
  })

  it("rejects non-admin actors", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "fundloop-studio", name: "FundLoop Studio", organization_id: null }, error: null }],
      participants: [{ data: null, error: null }],
      ref_roles: [{ data: [], error: null }],
    })

    const result = await executeProjectPaymentDraftsCommand(supabase as never, {
      actorUserId: "user-1",
      projectSlug: "fundloop-studio",
      payments: [
        {
          period_start: "2026-04-01",
          period_end: "2026-04-30",
          revenue: 1000,
          payment_amount: 10,
          payment_percentage: 1,
          payment_method_id: 1,
        },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "permission_denied",
        message: "You do not have permission to manage payments for this project.",
        projectId: 7,
        paymentMethodId: null,
      },
    })
  })

  it("rejects unavailable payment methods with context for observability", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "fundloop-studio", name: "FundLoop Studio", organization_id: null }, error: null }],
      participants: [{ data: { id: 11 }, error: null }],
      ref_roles: [{ data: [], error: null }],
      ref_payment_statuses: [{ data: { id: 3 }, error: null }],
      ref_payment_methods: [{ data: [], error: null }],
    })

    const result = await executeProjectPaymentDraftsCommand(supabase as never, {
      actorUserId: "user-1",
      projectSlug: "fundloop-studio",
      payments: [
        {
          period_start: "2026-04-01",
          period_end: "2026-04-30",
          revenue: 1000,
          payment_amount: 10,
          payment_percentage: 1,
          payment_method_id: 55,
        },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "reference_data_unavailable",
        message: "One or more selected payment methods are no longer available.",
        projectId: 7,
        paymentMethodId: 55,
      },
    })
  })
})
