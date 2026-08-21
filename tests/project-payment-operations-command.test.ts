import { describe, expect, it } from "vitest"
import {
  executeProjectCryptoRouteMoveCommand,
  executeProjectOnchainPaymentSubmissionRecordCommand,
  type PaymentOperationsCommandDeps,
} from "@/lib/payments/project-payment-operations-command"

type QueryResponse = { data?: unknown; error?: { message: string } | null; count?: number | null }

function createSupabaseMock(responsesByTable: Record<string, QueryResponse[]>) {
  const counters = new Map<string, number>()
  const inserts: Array<{ table: string; payload: unknown }> = []

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
      not() {
        return this
      },
      neq() {
        return this
      },
      order() {
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
    from(table: string) {
      const nextIndex = counters.get(table) ?? 0
      counters.set(table, nextIndex + 1)
      return createQuery(table, responsesByTable[table]?.[nextIndex] ?? { data: null, error: null })
    },
  }
}

const deps: PaymentOperationsCommandDeps = {
  environment: "local",
  getDeploymentAvailabilityForRoute: () => ({ available: true, reason: null }),
}

const routeSnapshot = {
  id: 55,
  method_id: 1,
  project_id: 7,
  chain_id: 2,
  chain_asset_id: 3,
  intake_contract_id: 4,
  ref_chains: { network_key: "base", ecosystem: "evm" },
  chain_intake_contracts: {
    contract_address: "0x1111111111111111111111111111111111111111",
    treasury_address: "0x2222222222222222222222222222222222222222",
    abi_version: "fundloop-intake-v1",
  },
  ref_chain_assets: {
    token_address: "0x3333333333333333333333333333333333333333",
    is_native: false,
  },
}

const managedRouteRow = {
  ...routeSnapshot,
  label: "Base USDC",
  is_default: true,
  is_enabled: true,
  sort_order: 1,
  collection_mode: "contract",
  ref_chains: {
    id: 2,
    display_name: "Base",
    ecosystem: "evm",
    network_key: "base",
    evm_chain_id: 8453,
    native_asset_symbol: "ETH",
    is_active: true,
  },
  ref_chain_assets: {
    id: 3,
    symbol: "USDC",
    name: "USD Coin",
    token_address: "0x3333333333333333333333333333333333333333",
    decimals: 6,
    is_native: false,
    is_stablecoin: true,
    is_active: true,
  },
  chain_intake_contracts: {
    id: 4,
    contract_address: "0x1111111111111111111111111111111111111111",
    treasury_address: "0x2222222222222222222222222222222222222222",
    abi_version: "fundloop-intake-v1",
    is_active: true,
  },
}

const solanaSignature =
  "5NnY2hRr7H6d8RooKq4QgE3ffkU3e1zjfwj7cD2D8mN4L2iB44Q9PbBvHfcp7W4dTeuAsvQhMRBb1bQycWm9zYp"

const solanaRouteSnapshot = {
  id: 77,
  method_id: 1,
  project_id: 7,
  chain_id: 9,
  chain_asset_id: 10,
  intake_contract_id: 11,
  ref_chains: { network_key: "solana-mainnet", ecosystem: "solana" },
  chain_intake_contracts: {
    contract_address: "11111111111111111111111111111111",
    treasury_address: "FundLoopSolanaTreasury111111111111111111111",
    abi_version: "solana-transfer-v1",
  },
  ref_chain_assets: {
    token_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    is_native: false,
  },
}

const managedSolanaRouteRow = {
  ...solanaRouteSnapshot,
  label: "Solana USDC",
  is_default: true,
  is_enabled: true,
  sort_order: 1,
  collection_mode: "contract",
  ref_chains: {
    id: 9,
    display_name: "Solana",
    ecosystem: "solana",
    network_key: "solana-mainnet",
    evm_chain_id: -1,
    native_asset_symbol: "SOL",
    is_active: true,
  },
  ref_chain_assets: {
    id: 10,
    symbol: "USDC",
    name: "USD Coin",
    token_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    is_native: false,
    is_stablecoin: true,
    is_active: true,
  },
  chain_intake_contracts: {
    id: 11,
    contract_address: "11111111111111111111111111111111",
    treasury_address: "FundLoopSolanaTreasury111111111111111111111",
    abi_version: "solana-transfer-v1",
    is_active: true,
  },
}

describe("project payment operation commands", () => {
  it("rejects route moves when the route is not owned by the project", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "civic-mesh", name: "Civic Mesh", organization_id: null, default_payment_method_id: null }, error: null }],
      participants: [{ data: { id: 1 }, error: null }],
      ref_roles: [{ data: [], error: null }],
      payment_methods: [{ data: [], error: null }],
    })

    const result = await executeProjectCryptoRouteMoveCommand(
      supabase as never,
      {
        actorUserId: "user-1",
        projectSlug: "civic-mesh",
        paymentMethodId: 99,
        direction: "up",
      },
      deps,
    )

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("route_not_found")
  })

  it("returns reference data failures when participant admin lookup errors", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "civic-mesh", name: "Civic Mesh", organization_id: null, default_payment_method_id: null }, error: null }],
      participants: [{ data: null, error: { message: "participants lookup failed" } }],
      ref_roles: [{ data: [], error: null }],
    })

    const result = await executeProjectCryptoRouteMoveCommand(
      supabase as never,
      {
        actorUserId: "user-1",
        projectSlug: "civic-mesh",
        paymentMethodId: 99,
        direction: "up",
      },
      deps,
    )

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("reference_data_unavailable")
  })

  it("returns reference data failures when receipt lookup queries fail", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "civic-mesh", name: "Civic Mesh", organization_id: null, default_payment_method_id: null }, error: null }],
      participants: [{ data: { id: 1 }, error: null }],
      ref_roles: [{ data: [], error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
      payments: [{ data: null, error: { message: "payment lookup failed" } }],
      payment_methods: [{ data: routeSnapshot, error: null }],
      ref_payment_statuses: [{ data: { id: 4 }, error: null }],
      onchain_payment_submissions: [{ data: null, error: null }],
    })

    const result = await executeProjectOnchainPaymentSubmissionRecordCommand(
      supabase as never,
      {
        actorUserId: "user-1",
        projectSlug: "civic-mesh",
        attemptId: "attempt-receipt-lookup-failure",
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
      },
      deps,
    )

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("reference_data_unavailable")
    expect(supabase.inserts.filter((entry) => entry.table === "payment_flow_events")).toHaveLength(2)
  })

  it("records observability and rejects duplicate unresolved onchain submissions", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "civic-mesh", name: "Civic Mesh", organization_id: null, default_payment_method_id: null }, error: null }],
      participants: [{ data: { id: 1 }, error: null }],
      ref_roles: [{ data: [], error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
      payments: [{ data: { id: 12, project_id: 7, payment_amount: 1, notes: null }, error: null }],
      payment_methods: [
        {
          data: routeSnapshot,
          error: null,
        },
      ],
      ref_payment_statuses: [{ data: { id: 4 }, error: null }],
      onchain_payment_submissions: [{ data: { id: 88 }, error: null }],
    })

    const result = await executeProjectOnchainPaymentSubmissionRecordCommand(
      supabase as never,
      {
        actorUserId: "user-1",
        projectSlug: "civic-mesh",
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
      },
      deps,
    )

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("submission_unresolved")
    expect(supabase.inserts.filter((entry) => entry.table === "payment_flow_events")).toHaveLength(2)
  })

  it("marks inserted submissions failed when the payment update fails", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "civic-mesh", name: "Civic Mesh", organization_id: null, default_payment_method_id: null }, error: null }],
      participants: [{ data: { id: 1 }, error: null }],
      ref_roles: [{ data: [], error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
      payments: [
        { data: { id: 12, project_id: 7, payment_amount: 1, notes: null }, error: null },
        { data: null, error: { message: "payment update failed" } },
      ],
      payment_methods: [
        { data: routeSnapshot, error: null },
        { data: [managedRouteRow], error: null },
      ],
      ref_payment_statuses: [{ data: { id: 4 }, error: null }],
      onchain_payment_submissions: [
        { data: null, error: null },
        { data: { id: 99 }, error: null },
        { data: null, error: null },
      ],
    })

    const result = await executeProjectOnchainPaymentSubmissionRecordCommand(
      supabase as never,
      {
        actorUserId: "user-1",
        projectSlug: "civic-mesh",
        attemptId: "attempt-receipt-update-failure",
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
      },
      deps,
    )

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("payment_update_failed")
    expect(supabase.inserts).toContainEqual(
      expect.objectContaining({
        table: "onchain_payment_submissions",
        payload: expect.objectContaining({
          status: "submitted",
          metadata: expect.objectContaining({
            source: "execution-interface.v1",
            deposit_intent_reference: "payment:12:method:55:attempt:attempt-receipt-update-failure",
          }),
        }),
      }),
    )
    expect(supabase.inserts).toContainEqual(
      expect.objectContaining({
        table: "onchain_payment_submissions:update",
        payload: expect.objectContaining({
          failure_code: "payment_update_failed",
          status: "failed",
        }),
      }),
    )
  })

  it("records Solana onchain payment submissions through the execution adapter", async () => {
    const supabase = createSupabaseMock({
      projects: [{ data: { id: 7, slug: "civic-mesh", name: "Civic Mesh", organization_id: null, default_payment_method_id: null }, error: null }],
      participants: [{ data: { id: 1 }, error: null }],
      ref_roles: [{ data: [], error: null }],
      payment_flow_events: [{ data: null, error: null }, { data: null, error: null }],
      payments: [
        { data: { id: 12, project_id: 7, payment_amount: 1, notes: null }, error: null },
        { data: null, error: null },
      ],
      payment_methods: [
        { data: solanaRouteSnapshot, error: null },
        { data: [managedSolanaRouteRow], error: null },
      ],
      ref_payment_statuses: [{ data: { id: 4 }, error: null }],
      onchain_payment_submissions: [
        { data: null, error: null },
        { data: { id: 101 }, error: null },
      ],
    })

    const result = await executeProjectOnchainPaymentSubmissionRecordCommand(
      supabase as never,
      {
        actorUserId: "user-1",
        projectSlug: "civic-mesh",
        attemptId: "attempt-solana-receipt",
        paymentId: 12,
        paymentMethodId: 77,
        txHash: solanaSignature,
        walletAddress: "ContributorSolanaWallet111111111111111111111",
        amountRaw: "1000000",
        amountDecimal: "1",
        periodId: 4,
        chainId: 9,
        chainAssetId: 10,
        intakeContractId: 11,
        receipt: { signature: solanaSignature, slot: 123456 },
      },
      deps,
    )

    expect(result).toEqual({ ok: true, data: { submissionId: 101 } })
    expect(supabase.inserts).toContainEqual(
      expect.objectContaining({
        table: "onchain_payment_submissions",
        payload: expect.objectContaining({
          chain_network_key: "solana-mainnet",
          intake_contract_address: "11111111111111111111111111111111",
          intake_treasury_address: "FundLoopSolanaTreasury111111111111111111111",
          asset_token_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          tx_hash: solanaSignature,
          status: "submitted",
          metadata: expect.objectContaining({
            source: "execution-interface.v1",
            rail: "solana",
            deposit_destination_kind: "address",
            receipt_verification: expect.objectContaining({
              rail: "solana",
              verification_mode: "signature_scaffold",
            }),
          }),
        }),
      }),
    )
  })
})
