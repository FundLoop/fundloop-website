import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePath = vi.fn()

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
  })

  it("logs receipt-recording failure when an unresolved submission already exists", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "fundloop-studio", name: "FundLoop Studio", organization_id: null, default_payment_method_id: null }, error: null }],
      participants: [{ data: { id: 11 }, error: null }],
      ref_roles: [{ data: [], error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
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

    const { executeProjectOnchainPaymentSubmissionRecordCommand } = await import("@/lib/payments/project-payment-operations-command")
    const result = await executeProjectOnchainPaymentSubmissionRecordCommand(supabase as never, {
      actorUserId: "user-1",
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
    }, {
      environment: "local",
      getDeploymentAvailabilityForRoute: () => ({ available: true, reason: null }),
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.submissionId).toBe(88)
  })
})
