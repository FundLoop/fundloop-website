import type { Tables } from "@/types/supabase"
import {
  getDeploymentManifest,
  getRuntimeChainByNetworkKey,
  resolveDeploymentEnvironment,
  type DeploymentEnvironment,
  type WalletRuntimeConfig,
} from "@/lib/onchain/runtime-config"
import { SUPPORTED_CHAIN_KEYS } from "@/lib/onchain/supported-chains"

type IntakeContractAuditInput = Pick<
  Tables<"chain_intake_contracts">,
  "id" | "chain_id" | "contract_address" | "treasury_address" | "abi_version" | "is_active" | "collection_mode"
> & {
  ref_chains: Pick<Tables<"ref_chains">, "id" | "network_key" | "display_name">
}

export type DeploymentAuditRow = {
  networkKey: string
  displayName: string
  manifestEnabled: boolean
  manifestContractAddress: string
  manifestTreasuryAddress: string
  manifestAbiVersion: string
  dbContractAddress: string | null
  dbTreasuryAddress: string | null
  dbAbiVersion: string | null
  dbIsActive: boolean
  status: "healthy" | "disabled" | "missing" | "mismatch"
  statusReason: string
  runtimeEnabled: boolean
}

function normalizeAddress(value: string | null) {
  return value?.trim().toLowerCase() ?? null
}

export function buildDeploymentAuditRows(
  runtimeConfig: WalletRuntimeConfig,
  rows: IntakeContractAuditInput[],
  environment: DeploymentEnvironment = resolveDeploymentEnvironment(),
): DeploymentAuditRow[] {
  const manifest = getDeploymentManifest(environment)

  return SUPPORTED_CHAIN_KEYS.map((networkKey) => {
    const manifestChain = manifest.chains.find((chain) => chain.networkKey === networkKey)
    const dbRow = rows.find((row) => row.ref_chains.network_key === networkKey && row.collection_mode === "contract") ?? null
    const runtimeChain = getRuntimeChainByNetworkKey(runtimeConfig, networkKey)
    const displayName = dbRow?.ref_chains.display_name ?? runtimeChain?.displayName ?? networkKey

    if (!manifestChain) {
      return {
        networkKey,
        displayName,
        manifestEnabled: false,
        manifestContractAddress: "Missing from manifest",
        manifestTreasuryAddress: "Missing from manifest",
        manifestAbiVersion: "Missing from manifest",
        dbContractAddress: dbRow?.contract_address ?? null,
        dbTreasuryAddress: dbRow?.treasury_address ?? null,
        dbAbiVersion: dbRow?.abi_version ?? null,
        dbIsActive: Boolean(dbRow?.is_active),
        status: "missing",
        statusReason: "This curated chain is missing from the tracked deployment manifest.",
        runtimeEnabled: false,
      }
    }

    if (!manifestChain.enabled) {
      return {
        networkKey,
        displayName,
        manifestEnabled: false,
        manifestContractAddress: manifestChain.contractAddress,
        manifestTreasuryAddress: manifestChain.treasuryAddress,
        manifestAbiVersion: manifestChain.abiVersion,
        dbContractAddress: dbRow?.contract_address ?? null,
        dbTreasuryAddress: dbRow?.treasury_address ?? null,
        dbAbiVersion: dbRow?.abi_version ?? null,
        dbIsActive: Boolean(dbRow?.is_active),
        status: dbRow?.is_active ? "mismatch" : "disabled",
        statusReason: dbRow?.is_active
          ? "The manifest disables this chain, but the database still marks the intake contract as active."
          : "This chain is intentionally disabled in the deployment manifest.",
        runtimeEnabled: false,
      }
    }

    if (!dbRow) {
      return {
        networkKey,
        displayName,
        manifestEnabled: true,
        manifestContractAddress: manifestChain.contractAddress,
        manifestTreasuryAddress: manifestChain.treasuryAddress,
        manifestAbiVersion: manifestChain.abiVersion,
        dbContractAddress: null,
        dbTreasuryAddress: null,
        dbAbiVersion: null,
        dbIsActive: false,
        status: "missing",
        statusReason: "The manifest enables this chain, but no matching chain_intake_contracts row exists yet.",
        runtimeEnabled: Boolean(runtimeChain),
      }
    }

    const matches =
      dbRow.is_active &&
      normalizeAddress(dbRow.contract_address) === normalizeAddress(manifestChain.contractAddress) &&
      normalizeAddress(dbRow.treasury_address) === normalizeAddress(manifestChain.treasuryAddress) &&
      dbRow.abi_version === manifestChain.abiVersion

    return {
      networkKey,
      displayName,
      manifestEnabled: true,
      manifestContractAddress: manifestChain.contractAddress,
      manifestTreasuryAddress: manifestChain.treasuryAddress,
      manifestAbiVersion: manifestChain.abiVersion,
      dbContractAddress: dbRow.contract_address,
      dbTreasuryAddress: dbRow.treasury_address,
      dbAbiVersion: dbRow.abi_version,
      dbIsActive: dbRow.is_active,
      status: matches ? "healthy" : "mismatch",
      statusReason: matches
        ? "Manifest and database deployment rows are aligned."
        : "The active database row does not match the tracked deployment manifest. Run the sync command before enabling payment execution.",
      runtimeEnabled: Boolean(runtimeChain),
    }
  })
}
