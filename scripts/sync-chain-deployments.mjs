import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

export const SUPPORTED_NETWORK_KEYS = ["ethereum", "base", "celo"]

function normalizeAddress(value) {
  return value?.trim().toLowerCase() ?? null
}

async function loadManifest(environment) {
  const manifestOverrideJson = process.env.FUNDLOOP_DEPLOYMENT_MANIFEST_JSON?.trim()
  if (manifestOverrideJson) {
    return JSON.parse(manifestOverrideJson)
  }

  const manifestOverridePath = process.env.FUNDLOOP_DEPLOYMENT_MANIFEST_PATH?.trim()
  if (manifestOverridePath) {
    const content = await readFile(manifestOverridePath, "utf8")
    return JSON.parse(content)
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const manifestPath = path.join(__dirname, "..", "lib", "onchain", "deployments", `${environment}.json`)
  const content = await readFile(manifestPath, "utf8")
  return JSON.parse(content)
}

export function buildChainIntakeContractSyncPlan({ manifest, refChains, existingContracts }) {
  const existingByNetworkKey = new Map(
    existingContracts
      .filter((row) => row.collection_mode === "contract")
      .map((row) => [row.ref_chains.network_key, row]),
  )

  const rows = manifest.chains.map((chain) => {
    const refChain = refChains.find((item) => item.network_key === chain.networkKey) ?? null
    const current = existingByNetworkKey.get(chain.networkKey) ?? null

    if (!refChain) {
      if (!chain.enabled && !current) {
        return {
          networkKey: chain.networkKey,
          action: "noop",
          reason: `Manifest disables ${chain.networkKey}, and no local reference row or contract exists.`,
          desired: chain,
          current,
        }
      }
      return {
        networkKey: chain.networkKey,
        action: "error",
        reason: `Missing ref_chains row for ${chain.networkKey}.`,
        desired: chain,
        current,
      }
    }

    if (!chain.enabled) {
      if (current?.is_active) {
        return {
          networkKey: chain.networkKey,
          action: "disable",
          reason: "Manifest disables this chain, but the database row is still active.",
          desired: { ...chain, chainId: refChain.id },
          current,
        }
      }

      return {
        networkKey: chain.networkKey,
        action: "noop",
        reason: "Manifest disables this chain and the database row is already inactive or absent.",
        desired: { ...chain, chainId: refChain.id },
        current,
      }
    }

    const desired = {
      chain_id: refChain.id,
      collection_mode: "contract",
      contract_address: chain.contractAddress,
      treasury_address: chain.treasuryAddress,
      abi_version: chain.abiVersion,
      is_active: true,
    }

    const matchesCurrent =
      current &&
      current.is_active === true &&
      normalizeAddress(current.contract_address) === normalizeAddress(chain.contractAddress) &&
      normalizeAddress(current.treasury_address) === normalizeAddress(chain.treasuryAddress) &&
      current.abi_version === chain.abiVersion

    if (matchesCurrent) {
      return {
        networkKey: chain.networkKey,
        action: "noop",
        reason: "Database row already matches the manifest.",
        desired,
        current,
      }
    }

    return {
      networkKey: chain.networkKey,
      action: "upsert",
      reason: current
        ? "Database row differs from the manifest and must be updated."
        : "Manifest enables this chain and a contract row must be created.",
      desired,
      current,
    }
  })

  return {
    rows,
    hasErrors: rows.some((row) => row.action === "error"),
    hasChanges: rows.some((row) => row.action === "upsert" || row.action === "disable"),
  }
}

export function formatSyncPlan(plan, environment) {
  const lines = [`Wallet deployment sync plan for ${environment}:`]

  plan.rows.forEach((row) => {
    lines.push(`- ${row.networkKey}: ${row.action} (${row.reason})`)
  })

  if (!plan.hasChanges) {
    lines.push("- No database changes are required.")
  }

  return lines.join("\n")
}

async function createAdminClientFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for deployment sync.")
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function runSync({ environment, apply }) {
  const manifest = await loadManifest(environment)
  const supabase = await createAdminClientFromEnv()
  const [{ data: refChains, error: refChainsError }, { data: existingContracts, error: contractsError }] =
    await Promise.all([
      supabase.from("ref_chains").select("id, network_key").in("network_key", SUPPORTED_NETWORK_KEYS),
      supabase
        .from("chain_intake_contracts")
        .select(`
          id,
          chain_id,
          collection_mode,
          contract_address,
          treasury_address,
          abi_version,
          is_active,
          ref_chains!inner(id, network_key)
        `)
        .eq("collection_mode", "contract"),
    ])

  if (refChainsError) {
    throw new Error(refChainsError.message)
  }

  if (contractsError) {
    throw new Error(contractsError.message)
  }

  const plan = buildChainIntakeContractSyncPlan({
    manifest,
    refChains: refChains ?? [],
    existingContracts: existingContracts ?? [],
  })

  if (!apply || !plan.hasChanges || plan.hasErrors) {
    return plan
  }

  for (const row of plan.rows) {
    if (row.action === "upsert") {
      const { error } = await supabase.from("chain_intake_contracts").upsert(row.desired, {
        onConflict: "chain_id,collection_mode",
      })

      if (error) {
        throw new Error(`Failed to upsert ${row.networkKey}: ${error.message}`)
      }
    }

    if (row.action === "disable" && row.current?.id) {
      const { error } = await supabase
        .from("chain_intake_contracts")
        .update({ is_active: false })
        .eq("id", row.current.id)

      if (error) {
        throw new Error(`Failed to disable ${row.networkKey}: ${error.message}`)
      }
    }
  }

  return plan
}

async function main() {
  const args = process.argv.slice(2)
  const envFlagIndex = args.indexOf("--env")
  const apply = args.includes("--apply")
  const environment = envFlagIndex >= 0 ? args[envFlagIndex + 1] : null

  if (!environment || !["local", "preview", "production"].includes(environment)) {
    throw new Error("Usage: node scripts/sync-chain-deployments.mjs --env <local|preview|production> [--apply]")
  }

  const plan = await runSync({ environment, apply })
  console.log(formatSyncPlan(plan, environment))

  if (plan.hasErrors) {
    process.exitCode = 1
    return
  }

  if (apply && plan.hasChanges) {
    console.log("Applied wallet deployment sync changes.")
  } else if (apply) {
    console.log("No wallet deployment sync changes were required.")
  }
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : null
const currentPath = fileURLToPath(import.meta.url)

if (executedPath === currentPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
