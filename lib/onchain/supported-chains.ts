import { base, celo, mainnet } from "wagmi/chains"
import type { Chain } from "viem"

export type SupportedChainKey = "ethereum" | "base" | "celo"

type SupportedChainConfig = {
  key: SupportedChainKey
  chain: Chain
  rpcEnvVar: string
  intakeContractEnvVar: string
  treasuryEnvVar: string
}

export const SUPPORTED_CHAIN_CONFIGS: Record<SupportedChainKey, SupportedChainConfig> = {
  ethereum: {
    key: "ethereum",
    chain: mainnet,
    rpcEnvVar: "NEXT_PUBLIC_ETHEREUM_RPC_URL",
    intakeContractEnvVar: "NEXT_PUBLIC_ETHEREUM_INTAKE_CONTRACT",
    treasuryEnvVar: "NEXT_PUBLIC_ETHEREUM_TREASURY_ADDRESS",
  },
  base: {
    key: "base",
    chain: base,
    rpcEnvVar: "NEXT_PUBLIC_BASE_RPC_URL",
    intakeContractEnvVar: "NEXT_PUBLIC_BASE_INTAKE_CONTRACT",
    treasuryEnvVar: "NEXT_PUBLIC_BASE_TREASURY_ADDRESS",
  },
  celo: {
    key: "celo",
    chain: celo,
    rpcEnvVar: "NEXT_PUBLIC_CELO_RPC_URL",
    intakeContractEnvVar: "NEXT_PUBLIC_CELO_INTAKE_CONTRACT",
    treasuryEnvVar: "NEXT_PUBLIC_CELO_TREASURY_ADDRESS",
  },
}

export const SUPPORTED_WAGMI_CHAINS = [
  SUPPORTED_CHAIN_CONFIGS.ethereum.chain,
  SUPPORTED_CHAIN_CONFIGS.base.chain,
  SUPPORTED_CHAIN_CONFIGS.celo.chain,
] as const

export function getSupportedChainConfig(networkKey: string) {
  return SUPPORTED_CHAIN_CONFIGS[networkKey as SupportedChainKey] ?? null
}

export function getChainEnvValue(name: string) {
  return process.env[name]
}
