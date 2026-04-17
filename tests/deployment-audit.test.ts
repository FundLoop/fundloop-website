import { describe, expect, it } from "vitest"
import { buildDeploymentAuditRows } from "@/lib/onchain/deployment-audit"
import type { WalletRuntimeConfig } from "@/lib/onchain/runtime-config"

const runtimeConfig: WalletRuntimeConfig = {
  environment: "preview",
  manifestVersion: "fundloop-wallet-deployments.v1",
  reownProjectId: "reown-project-id",
  reownProjectIdConfigured: true,
  walletEnabled: false,
  activeChains: [],
  issues: [],
}

describe("deployment audit rows", () => {
  it("marks disabled manifest chains as mismatched when db rows stay active", () => {
    const rows = buildDeploymentAuditRows(
      runtimeConfig,
      [
        {
          id: 1,
          chain_id: 2,
          collection_mode: "contract",
          contract_address: "0x1111111111111111111111111111111111111111",
          treasury_address: "0x2222222222222222222222222222222222222222",
          abi_version: "fundloop-intake-v1",
          is_active: true,
          ref_chains: {
            id: 2,
            network_key: "base",
            display_name: "Base",
          },
        },
      ],
      "preview",
    )

    const baseRow = rows.find((row) => row.networkKey === "base")
    expect(baseRow?.status).toBe("mismatch")
    expect(baseRow?.statusReason).toMatch(/manifest disables this chain/i)
  })
})
