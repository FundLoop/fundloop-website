import { base, celo, mainnet } from "wagmi/chains"
import type { Chain } from "viem"

export type SupportedChainKey = "ethereum" | "base" | "celo"

export type SupportedChainConfig = {
  key: SupportedChainKey
  chain: Chain
  rpcEnvVar: string
}

export const SUPPORTED_CHAIN_CONFIGS: Record<SupportedChainKey, SupportedChainConfig> = {
  ethereum: {
    key: "ethereum",
    chain: mainnet,
    rpcEnvVar: "NEXT_PUBLIC_ETHEREUM_RPC_URL",
  },
  base: {
    key: "base",
    chain: base,
    rpcEnvVar: "NEXT_PUBLIC_BASE_RPC_URL",
  },
  celo: {
    key: "celo",
    chain: celo,
    rpcEnvVar: "NEXT_PUBLIC_CELO_RPC_URL",
  },
}

export const SUPPORTED_CHAIN_KEYS = Object.keys(SUPPORTED_CHAIN_CONFIGS) as SupportedChainKey[]

export const SUPPORTED_WAGMI_CHAINS = SUPPORTED_CHAIN_KEYS.map((key) => SUPPORTED_CHAIN_CONFIGS[key].chain) as readonly Chain[]

export function getSupportedChainConfig(networkKey: string) {
  return SUPPORTED_CHAIN_CONFIGS[networkKey as SupportedChainKey] ?? null
}

export function createConfiguredChain(networkKey: SupportedChainKey, rpcUrl: string): Chain {
  const chain = SUPPORTED_CHAIN_CONFIGS[networkKey].chain

  return {
    ...chain,
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  }
}
