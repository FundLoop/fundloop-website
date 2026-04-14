import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePath = vi.fn()
const recordPaymentFlowEvent = vi.fn()
const requireInternalAdminActor = vi.fn()

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
    update() {
      return this
    },
    limit() {
      return this
    },
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(response).then(onFulfilled, onRejected)
    },
  }
}

function createSupabaseMock(responsesByTable: Record<string, unknown[]>, userId = "user-1") {
  const counters = new Map<string, number>()

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
          },
        },
        error: null,
      }),
    },
    from(table: string) {
      const nextIndex = counters.get(table) ?? 0
      counters.set(table, nextIndex + 1)
      return createQueryResponse(responsesByTable[table]?.[nextIndex] ?? { data: null, error: null })
    },
  }
}

vi.mock("next/cache", () => ({
  revalidatePath,
}))

vi.mock("@/lib/observability/payment-flow-server", () => ({
  recordPaymentFlowEvent,
}))

vi.mock("@/lib/zkas/auth", () => ({
  requireInternalAdminActor,
}))

vi.mock("@/lib/onchain/payment-reconciliation", () => ({
  listProjectOnchainSubmissionSummaries: vi.fn(),
  runOnchainPaymentReconciliation: vi.fn(),
}))

vi.mock("@/lib/project-crypto-routes", () => ({
  getPromotedDefaultRouteId: vi.fn(),
  moveProjectCryptoRouteState: vi.fn(),
  renumberProjectCryptoRouteStates: vi.fn(),
}))

describe("project payment action observability", () => {
  beforeEach(() => {
    vi.resetModules()
    revalidatePath.mockReset()
    recordPaymentFlowEvent.mockReset()
    requireInternalAdminActor.mockReset()
  })

  it("logs payment-save success with the caller attempt id", async () => {
    const serverSupabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "fundloop-studio", name: "FundLoop Studio", organization_id: null, default_payment_method_id: null }, error: null }],
      participants: [{ data: { id: 11 }, error: null }],
      ref_roles: [{ data: [], error: null }],
    })

    const adminSupabase = createSupabaseMock({
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

    vi.doMock("@/lib/supabase-server", () => ({
      createServerSupabaseClient: async () => serverSupabase,
    }))
    vi.doMock("@/lib/supabase-admin", () => ({
      getAdminSupabaseClient: () => adminSupabase,
    }))

    const { createProjectPaymentDrafts } = await import("@/app/actions/project-payment-actions")
    const result = await createProjectPaymentDrafts({
      projectSlug: "fundloop-studio",
      attemptId: "attempt-save-1",
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

    expect(result.ok).toBe(true)
    expect(recordPaymentFlowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: "payment_save",
        outcome: "success",
        attemptId: "attempt-save-1",
        projectId: 7,
      }),
    )
  })

  it("logs receipt-recording failure when an unresolved submission already exists", async () => {
    const serverSupabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "fundloop-studio", name: "FundLoop Studio", organization_id: null, default_payment_method_id: null }, error: null }],
      participants: [{ data: { id: 11 }, error: null }],
      ref_roles: [{ data: [], error: null }],
    })

    const adminSupabase = createSupabaseMock({
      payments: [{ data: { id: 12, project_id: 7, notes: null }, error: null }],
      payment_methods: [
        {
          data: {
            id: 55,
            method_id: 1,
            project_id: 7,
            chain_id: 2,
            chain_asset_id: 3,
            intake_contract_id: 4,
            ref_chains: { network_key: "base" },
            chain_intake_contracts: {
              contract_address: "0x1111111111111111111111111111111111111111",
              treasury_address: "0x2222222222222222222222222222222222222222",
              abi_version: "fundloop-intake-v1",
            },
            ref_chain_assets: {
              token_address: "0x3333333333333333333333333333333333333333",
              is_native: false,
            },
          },
          error: null,
        },
      ],
      ref_payment_statuses: [{ data: { id: 4 }, error: null }],
      onchain_payment_submissions: [{ data: { id: 88 }, error: null }],
    })

    vi.doMock("@/lib/supabase-server", () => ({
      createServerSupabaseClient: async () => serverSupabase,
    }))
    vi.doMock("@/lib/supabase-admin", () => ({
      getAdminSupabaseClient: () => adminSupabase,
    }))

    const { recordOnchainPaymentSubmission } = await import("@/app/actions/project-payment-actions")
    const result = await recordOnchainPaymentSubmission({
      projectSlug: "fundloop-studio",
      attemptId: "attempt-receipt-1",
      paymentId: 12,
      paymentMethodId: 55,
      txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      amountRaw: "1000000",
      amountDecimal: "1",
      periodId: 4,
      chainId: 2,
      chainAssetId: 3,
      intakeContractId: 4,
      receipt: {},
    })

    expect(result.ok).toBe(false)
    expect(recordPaymentFlowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: "receipt_recording",
        outcome: "failure",
        attemptId: "attempt-receipt-1",
        submissionId: 88,
      }),
    )
  })

  it("logs admin-confirmation failure when the payment already has an onchain submission", async () => {
    requireInternalAdminActor.mockResolvedValue({ userId: "admin-1" })

    const adminSupabase = createSupabaseMock({
      payments: [{ data: { id: 22, project_id: 7, projects: { slug: "fundloop-studio" } }, error: null }],
      ref_payment_statuses: [{ data: { id: 9, code: "confirmed" }, error: null }],
      onchain_payment_submissions: [{ data: { id: 44 }, error: null }],
    })

    vi.doMock("@/lib/supabase-admin", () => ({
      getAdminSupabaseClient: () => adminSupabase,
    }))
    vi.doMock("@/lib/supabase-server", () => ({
      createServerSupabaseClient: async () => createSupabaseMock({}),
    }))

    const { confirmInternalPaymentReceipt } = await import("@/app/actions/project-payment-actions")
    const result = await confirmInternalPaymentReceipt(22, "attempt-admin-1")

    expect(result.ok).toBe(false)
    expect(recordPaymentFlowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: "admin_confirmation",
        outcome: "failure",
        attemptId: "attempt-admin-1",
        paymentId: 22,
        submissionId: 44,
      }),
    )
  })
})
