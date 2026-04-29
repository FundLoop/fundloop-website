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
      expect.objectContaining({ rail: "solana", capabilities: expect.objectContaining({ createPayoutBatch: true }) }),
      expect.objectContaining({ rail: "fiat_stub", capabilities: expect.objectContaining({ createPayoutBatch: true }) }),
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
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        verified: true,
        externalReference: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "submitted",
      },
    })
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

  it("keeps Solana and fiat execution as explicit unsupported scaffolds for now", async () => {
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
          amountUsd: 10.1234564,
          destination: { address: "0xb" },
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
        totalAmountUsd: 30.123456,
        intentCount: 2,
        items: [
          { intentId: 1, amountUsd: 20, position: 0 },
          { intentId: 2, amountUsd: 10.123456, position: 1 },
        ],
      },
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
