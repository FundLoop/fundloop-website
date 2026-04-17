import { describe, expect, it } from "vitest"
import {
  assertWalletRuntimeConfigForStartup,
  buildWalletRuntimeConfig,
  getDeploymentAvailabilityForRoute,
  getRequiredConfirmationDepth,
  resolveDeploymentEnvironment,
} from "@/lib/onchain/runtime-config"

describe("wallet runtime config", () => {
  it("defaults to local when no deployment env is set", () => {
    expect(resolveDeploymentEnvironment({} as unknown as NodeJS.ProcessEnv)).toBe("local")
  })

  it("builds enabled runtime chains when env is fully configured", () => {
    const config = buildWalletRuntimeConfig({
      FUNDLOOP_DEPLOYMENT_ENV: "local",
      NEXT_PUBLIC_REOWN_PROJECT_ID: "reown-project-id",
      NEXT_PUBLIC_ETHEREUM_RPC_URL: "https://ethereum.example",
      NEXT_PUBLIC_BASE_RPC_URL: "https://base.example",
      NEXT_PUBLIC_CELO_RPC_URL: "https://celo.example",
    } as unknown as NodeJS.ProcessEnv)

    expect(config.walletEnabled).toBe(false)
    expect(config.activeChains).toHaveLength(0)
    expect(config.issues.some((issue) => issue.code === "no_enabled_wallet_chains")).toBe(true)
  })

  it("fails strict startup validation in preview when wallet env is missing", () => {
    const config = buildWalletRuntimeConfig({
      FUNDLOOP_DEPLOYMENT_ENV: "preview",
    } as unknown as NodeJS.ProcessEnv)

    expect(() => assertWalletRuntimeConfigForStartup(config)).toThrow(/Wallet runtime configuration is invalid/)
  })

  it("reports deployment drift when a route does not match the active manifest", () => {
    const config = buildWalletRuntimeConfig({
      FUNDLOOP_DEPLOYMENT_ENV: "local",
      NEXT_PUBLIC_REOWN_PROJECT_ID: "reown-project-id",
      NEXT_PUBLIC_ETHEREUM_RPC_URL: "https://ethereum.example",
      NEXT_PUBLIC_BASE_RPC_URL: "https://base.example",
      NEXT_PUBLIC_CELO_RPC_URL: "https://celo.example",
    } as unknown as NodeJS.ProcessEnv)

    const availability = getDeploymentAvailabilityForRoute(config, {
      networkKey: "base",
      contractAddress: "0x1111111111111111111111111111111111111111",
      treasuryAddress: "0x2222222222222222222222222222222222222222",
      abiVersion: "fundloop-intake-v1",
    })

    expect(availability.available).toBe(false)
    expect(availability.reason).toMatch(/No enabled base wallet deployment/)
  })

  it("reads confirmation depth from the manifest even when the chain is disabled", () => {
    const config = buildWalletRuntimeConfig({
      FUNDLOOP_DEPLOYMENT_ENV: "production",
      NEXT_PUBLIC_REOWN_PROJECT_ID: "reown-project-id",
      NEXT_PUBLIC_ETHEREUM_RPC_URL: "https://ethereum.example",
      NEXT_PUBLIC_BASE_RPC_URL: "https://base.example",
      NEXT_PUBLIC_CELO_RPC_URL: "https://celo.example",
    } as unknown as NodeJS.ProcessEnv)

    expect(getRequiredConfirmationDepth(config, "ethereum")).toBe(12)
    expect(getRequiredConfirmationDepth(config, "base")).toBe(20)
    expect(getRequiredConfirmationDepth(config, "celo")).toBe(30)
  })
})
