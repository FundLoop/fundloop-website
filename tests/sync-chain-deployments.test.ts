import { describe, expect, it } from "vitest"
import { buildChainIntakeContractSyncPlan } from "../scripts/sync-chain-deployments.mjs"

describe("chain deployment sync plan", () => {
  it("marks manifest-enabled differences as upserts", () => {
    const plan = buildChainIntakeContractSyncPlan({
      manifest: {
        version: "fundloop-wallet-deployments.v1",
        environment: "production",
        chains: [
          {
            networkKey: "ethereum",
            evmChainId: 1,
            enabled: true,
            abiVersion: "fundloop-intake-v1",
            contractAddress: "0x1111111111111111111111111111111111111111",
            treasuryAddress: "0x2222222222222222222222222222222222222222",
          },
        ],
      },
      refChains: [{ id: 1, network_key: "ethereum" }],
      existingContracts: [
        {
          id: 9,
          chain_id: 1,
          collection_mode: "contract",
          contract_address: "0x3333333333333333333333333333333333333333",
          treasury_address: "0x2222222222222222222222222222222222222222",
          abi_version: "fundloop-intake-v1",
          is_active: true,
          ref_chains: { id: 1, network_key: "ethereum" },
        },
      ],
    })

    expect(plan.hasChanges).toBe(true)
    expect(plan.rows[0]?.action).toBe("upsert")
  })

  it("marks manifest-disabled active rows for disable", () => {
    const plan = buildChainIntakeContractSyncPlan({
      manifest: {
        version: "fundloop-wallet-deployments.v1",
        environment: "production",
        chains: [
          {
            networkKey: "base",
            evmChainId: 8453,
            enabled: false,
            abiVersion: "fundloop-intake-v1",
            contractAddress: "0x0000000000000000000000000000000000000000",
            treasuryAddress: "0x0000000000000000000000000000000000000000",
          },
        ],
      },
      refChains: [{ id: 2, network_key: "base" }],
      existingContracts: [
        {
          id: 10,
          chain_id: 2,
          collection_mode: "contract",
          contract_address: "0x3333333333333333333333333333333333333333",
          treasury_address: "0x2222222222222222222222222222222222222222",
          abi_version: "fundloop-intake-v1",
          is_active: true,
          ref_chains: { id: 2, network_key: "base" },
        },
      ],
    })

    expect(plan.rows[0]?.action).toBe("disable")
  })

  it("treats a disabled chain missing from local reference data as a no-op", () => {
    const plan = buildChainIntakeContractSyncPlan({
      manifest: {
        version: "fundloop-wallet-deployments.playwright-local.v1",
        environment: "local",
        chains: [{
          networkKey: "ethereum",
          evmChainId: 1,
          enabled: false,
          abiVersion: "fundloop-intake-v1",
          contractAddress: "0x0000000000000000000000000000000000000000",
          treasuryAddress: "0x0000000000000000000000000000000000000000",
        }],
      },
      refChains: [],
      existingContracts: [],
    })

    expect(plan.hasErrors).toBe(false)
    expect(plan.hasChanges).toBe(false)
    expect(plan.rows[0]?.action).toBe("noop")
  })
})
