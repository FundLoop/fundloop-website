import { describe, expect, it } from "vitest"
import {
  buildPayoutBatchDraft,
  getExecutionAdapter,
  listExecutionAdapterCapabilities,
  resolveExecutionAdapter,
} from "@/lib/execution"

const actor = {
  actorUserId: "admin-1",
  actorRole: "internal_admin" as const,
}

describe("chain-abstracted execution interface", () => {
  it("exposes the expected execution rails and capabilities", () => {
    expect(listExecutionAdapterCapabilities()).toEqual([
      expect.objectContaining({ rail: "evm", capabilities: expect.objectContaining({ createDepositIntent: true }) }),
      expect.objectContaining({
        rail: "solana",
        capabilities: expect.objectContaining({ createDepositIntent: true, verifyDepositReceipt: true, createPayoutBatch: true }),
      }),
      expect.objectContaining({
        rail: "fiat_stub",
        capabilities: expect.objectContaining({ createDepositIntent: true, verifyDepositReceipt: true, createPayoutBatch: true }),
      }),
    ])

    expect(resolveExecutionAdapter("evm")).toMatchObject({ ok: true, data: { rail: "evm" } })
    expect(resolveExecutionAdapter("bitcoin")).toMatchObject({ ok: false, error: { code: "unsupported_rail" } })
  })

  it("creates a FundLoop-facing EVM deposit intent without exposing page-level chain logic", async () => {
    const adapter = getExecutionAdapter("evm")
    const result = await adapter.createDepositIntent({
      projectId: 1,
      projectSlug: "civic-mesh",
      paymentId: 10,
      paymentMethodId: 20,
      rail: "evm",
      money: { amountUsd: 25, currencyCode: "USD" },
      reference: "payment:10",
      route: {
        chainId: 1,
        chainNetworkKey: "ethereum",
        chainAssetId: 2,
        intakeContractId: 3,
        contractAddress: "0x0000000000000000000000000000000000000001",
        tokenAddress: null,
        isNativeAsset: true,
      },
      metadata: { workflow: "receipt-recording", source: "caller" },
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        rail: "evm",
        paymentId: 10,
        destination: {
          kind: "contract",
          networkKey: "ethereum",
          address: "0x0000000000000000000000000000000000000001",
        },
        metadata: {
          workflow: "receipt-recording",
          source: "execution-interface.v1",
        },
      },
    })
  })

  it("verifies EVM deposit receipts through the execution adapter", async () => {
    const adapter = getExecutionAdapter("evm")
    const result = await adapter.verifyDepositReceipt({
      rail: "evm",
      paymentId: 10,
      depositIntentReference: "payment:10",
      submittedTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectedAmountUsd: 25,
      submittedAmountUsd: 25,
      receipt: { transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      metadata: { workflow: "receipt-recording", source: "caller" },
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        verified: true,
        externalReference: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "submitted",
        metadata: {
          workflow: "receipt-recording",
          source: "execution-interface.v1",
        },
      },
    })
  })

  it("rejects EVM deposit receipts whose embedded transaction hash differs from the submitted hash", async () => {
    const adapter = getExecutionAdapter("evm")
    const result = await adapter.verifyDepositReceipt({
      rail: "evm",
      paymentId: 10,
      depositIntentReference: "payment:10",
      submittedTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectedAmountUsd: 25,
      submittedAmountUsd: 25,
      receipt: { transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    })

    expect(result).toMatchObject({ ok: false, error: { code: "tx_hash_mismatch", rail: "evm" } })
  })

  it("rejects mismatched EVM deposit receipt amounts through the execution adapter", async () => {
    const adapter = getExecutionAdapter("evm")
    const result = await adapter.verifyDepositReceipt({
      rail: "evm",
      paymentId: 10,
      depositIntentReference: "payment:10",
      submittedTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectedAmountUsd: 25,
      submittedAmountUsd: 10,
      receipt: {},
    })

    expect(result).toMatchObject({ ok: false, error: { code: "amount_mismatch", rail: "evm" } })
  })

  it("creates a Solana deposit intent using the configured deposit address", async () => {
    const adapter = getExecutionAdapter("solana")
    const result = await adapter.createDepositIntent({
      projectId: 1,
      projectSlug: "civic-mesh",
      paymentId: 10,
      paymentMethodId: 20,
      rail: "solana",
      money: { amountUsd: 25, currencyCode: "USD" },
      reference: "payment:10",
      route: {
        chainId: 4,
        chainNetworkKey: "solana-mainnet",
        chainAssetId: 5,
        intakeContractId: 6,
        contractAddress: "11111111111111111111111111111111",
        treasuryAddress: "FundLoopSolanaTreasury111111111111111111111",
        tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        isNativeAsset: false,
      },
      metadata: { workflow: "receipt-recording", source: "caller" },
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        rail: "solana",
        paymentId: 10,
        destination: {
          kind: "address",
          networkKey: "solana-mainnet",
          address: "FundLoopSolanaTreasury111111111111111111111",
          tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        },
        metadata: {
          workflow: "receipt-recording",
          source: "execution-interface.v1",
          rail: "solana",
        },
      },
    })
  })

  it("verifies Solana deposit receipts by matching the submitted signature", async () => {
    const adapter = getExecutionAdapter("solana")
    const signature = "5NnY2hRr7H6d8RooKq4QgE3ffkU3e1zjfwj7cD2D8mN4L2iB44Q9PbBvHfcp7W4dTeuAsvQhMRBb1bQycWm9zYp"
    const result = await adapter.verifyDepositReceipt({
      rail: "solana",
      paymentId: 10,
      depositIntentReference: "payment:10",
      submittedTxHash: signature,
      expectedAmountUsd: 25,
      submittedAmountUsd: 25,
      receipt: { signature, slot: 123456 },
      metadata: { workflow: "receipt-recording", source: "caller" },
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        verified: true,
        externalReference: signature,
        status: "submitted",
        metadata: {
          workflow: "receipt-recording",
          source: "execution-interface.v1",
          rail: "solana",
        },
      },
    })
  })

  it("rejects Solana receipts whose embedded signature differs from the submitted signature", async () => {
    const adapter = getExecutionAdapter("solana")
    const result = await adapter.verifyDepositReceipt({
      rail: "solana",
      paymentId: 10,
      depositIntentReference: "payment:10",
      submittedTxHash: "5NnY2hRr7H6d8RooKq4QgE3ffkU3e1zjfwj7cD2D8mN4L2iB44Q9PbBvHfcp7W4dTeuAsvQhMRBb1bQycWm9zYp",
      expectedAmountUsd: 25,
      submittedAmountUsd: 25,
      receipt: { signature: "4qixV2TQ6vV4Xe3R9ryS14CjhmT6b2oZs68gqsJZpLJ9aLV4d8sUGvCfy6QqEKbfHF5tw8LZ4SWUBekUhTmtL7A" },
    })

    expect(result).toMatchObject({ ok: false, error: { code: "signature_mismatch", rail: "solana" } })
  })

  it("keeps Solana payout execution as an explicit unsupported scaffold for now", async () => {
    const solana = getExecutionAdapter("solana")
    const result = await solana.executePayoutBatch({
      batchId: 1,
      rail: "solana",
      currencyCode: "USD",
      totalAmountUsd: 10,
      intentCount: 1,
      executionPayload: {},
      actor,
    })

    expect(result).toMatchObject({ ok: false, error: { code: "capability_not_implemented", rail: "solana" } })
  })

  it("builds Solana payout batch drafts with Solana-specific execution scaffolding", async () => {
    const solana = getExecutionAdapter("solana")
    const result = await solana.createPayoutBatch({
      monthlyCycleId: 1,
      cycleKey: "2026-04",
      rail: "solana",
      currencyCode: "USD",
      actor,
      intents: [
        {
          intentId: 2,
          userId: "user-b",
          routeId: 20,
          rail: "solana",
          currencyCode: "USD",
          amountUsd: 10.5,
          destination: {
            network: "solana-mainnet",
            address: "RecipientSolanaWallet222222222222222222222",
            tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          },
        },
        {
          intentId: 1,
          userId: "user-a",
          routeId: 10,
          rail: "solana",
          currencyCode: "USD",
          amountUsd: 20,
          destination: {
            network: "solana-mainnet",
            address: "RecipientSolanaWallet111111111111111111111",
          },
        },
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        rail: "solana",
        totalAmountUsd: 30.5,
        intentCount: 2,
        executionPayload: {
          version: "fundloop-solana-payout-batch.v1",
          execution_mode: "manual_transfer_scaffold",
          rail: "solana",
          network_keys: ["solana-mainnet"],
          token_addresses: ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
        },
        items: [
          { intentId: 1, amountUsd: 20, position: 0 },
          { intentId: 2, amountUsd: 10.5, position: 1 },
        ],
      },
    })
  })

  it("rejects Solana payout batch drafts without Solana destination addresses", async () => {
    const solana = getExecutionAdapter("solana")
    const result = await solana.createPayoutBatch({
      monthlyCycleId: 1,
      cycleKey: "2026-04",
      rail: "solana",
      currencyCode: "USD",
      actor,
      intents: [
        {
          intentId: 1,
          userId: "user-a",
          routeId: 10,
          rail: "solana",
          currencyCode: "USD",
          amountUsd: 20,
          destination: { network: "ethereum" },
        },
      ],
    })

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_payout_destination", rail: "solana" } })
  })

  it("creates fiat inbound deposit intents as provider-not-configured stubs", async () => {
    const fiat = getExecutionAdapter("fiat_stub")
    const result = await fiat.createDepositIntent({
      projectId: 1,
      projectSlug: "civic-mesh",
      paymentId: 10,
      paymentMethodId: 20,
      rail: "fiat_stub",
      money: { amountUsd: 25, currencyCode: "USD" },
      reference: "payment:10",
      route: {},
      metadata: { workflow: "receipt-recording", source: "caller" },
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        rail: "fiat_stub",
        destination: {
          kind: "external",
          networkKey: "fiat_stub",
          address: null,
          tokenAddress: null,
        },
        metadata: {
          workflow: "receipt-recording",
          source: "execution-interface.v1",
          rail: "fiat_stub",
          execution_mode: "provider_not_configured",
          provider: "unconfigured",
        },
      },
    })
  })

  it("keeps fiat receipt verification disabled until a provider is configured", async () => {
    const fiat = getExecutionAdapter("fiat_stub")
    const result = await fiat.verifyDepositReceipt({
      rail: "fiat_stub",
      paymentId: 10,
      depositIntentReference: "payment:10",
      submittedTxHash: "external-reference-1",
      expectedAmountUsd: 25,
      submittedAmountUsd: 25,
      receipt: { providerReference: "external-reference-1" },
    })

    expect(result).toMatchObject({ ok: false, error: { code: "fiat_provider_not_configured", rail: "fiat_stub" } })
  })

  it("builds fiat payout batch drafts as provider-not-configured stubs", async () => {
    const fiat = getExecutionAdapter("fiat_stub")
    const result = await fiat.createPayoutBatch({
      monthlyCycleId: 1,
      cycleKey: "2026-04",
      rail: "fiat_stub",
      currencyCode: "USD",
      actor,
      intents: [
        {
          intentId: 2,
          userId: "user-b",
          routeId: 20,
          rail: "fiat_stub",
          currencyCode: "USD",
          amountUsd: 10.5,
          destination: { method: "ach", accountReference: "bank-account-b" },
        },
        {
          intentId: 1,
          userId: "user-a",
          routeId: 10,
          rail: "fiat_stub",
          currencyCode: "USD",
          amountUsd: 20,
          destination: { method: "ach", accountReference: "bank-account-a" },
        },
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        rail: "fiat_stub",
        totalAmountUsd: 30.5,
        intentCount: 2,
        executionPayload: {
          version: "fundloop-fiat-payout-batch.v1",
          execution_mode: "provider_not_configured",
          rail: "fiat_stub",
          provider: "unconfigured",
          currency_codes: ["USD"],
          destination_methods: ["ach"],
        },
        items: [
          { intentId: 1, amountUsd: 20, position: 0 },
          { intentId: 2, amountUsd: 10.5, position: 1 },
        ],
      },
    })
  })

  it("rejects fiat payout batch drafts without placeholder destinations", async () => {
    const fiat = getExecutionAdapter("fiat_stub")
    const result = await fiat.createPayoutBatch({
      monthlyCycleId: 1,
      cycleKey: "2026-04",
      rail: "fiat_stub",
      currencyCode: "USD",
      actor,
      intents: [
        {
          intentId: 1,
          userId: "user-a",
          routeId: 10,
          rail: "fiat_stub",
          currencyCode: "USD",
          amountUsd: 20,
          destination: {},
        },
      ],
    })

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_payout_destination", rail: "fiat_stub" } })
  })

  it("builds deterministic payout batch drafts from ready payout intents", () => {
    const result = buildPayoutBatchDraft({
      monthlyCycleId: 1,
      cycleKey: "2026-04",
      rail: "evm",
      currencyCode: "USD",
      actor,
      intents: [
        {
          intentId: 2,
          userId: "user-b",
          routeId: 20,
          rail: "evm",
          currencyCode: "USD",
          amountUsd: 10.1234566,
          destination: { network: "ethereum", address: "0xb", nested: { z: true, a: "first" } },
        },
        {
          intentId: 1,
          userId: "user-a",
          routeId: 10,
          rail: "evm",
          currencyCode: "USD",
          amountUsd: 20,
          destination: { address: "0xa" },
        },
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        totalAmountUsd: 30.123457,
        intentCount: 2,
        items: [
          { intentId: 1, amountUsd: 20, position: 0 },
          { intentId: 2, amountUsd: 10.123457, position: 1 },
        ],
      },
    })
    const payload = result.ok ? result.data.executionPayload as { intents: Array<{ destination: unknown }> } : null
    expect(payload?.intents[1]?.destination).toEqual({
      address: "0xb",
      nested: { a: "first", z: true },
      network: "ethereum",
    })
  })

  it("rejects mixed rail payout batch drafts", () => {
    const result = buildPayoutBatchDraft({
      monthlyCycleId: 1,
      cycleKey: "2026-04",
      rail: "evm",
      currencyCode: "USD",
      actor,
      intents: [
        {
          intentId: 1,
          userId: "user-a",
          routeId: 10,
          rail: "solana",
          currencyCode: "USD",
          amountUsd: 20,
          destination: {},
        },
      ],
    })

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_payout_intent", rail: "evm" } })
  })
})
