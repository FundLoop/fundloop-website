import { network } from "hardhat"

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const allowedEnvironments = new Set(["local", "dev", "test"])
const BASE_SEPOLIA_USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e"
const ZERO = "0x0000000000000000000000000000000000000000"

function required(name) {
  const value = process.env[name]?.trim()
  if (!value || !ADDRESS.test(value)) throw new Error(`${name} must be a valid non-zero EVM address`)
  if (/^0x0{40}$/i.test(value)) throw new Error(`${name} must not be the zero address`)
  return value
}

async function main() {
  const environment = process.env.FUNDLOOP_DEPLOYMENT_ENV?.trim().toLowerCase() ?? ""
  if (!allowedEnvironments.has(environment)) throw new Error("base_intake_v2_deployment_disabled")

  const { viem, networkName } = await network.connect()
  const publicClient = await viem.getPublicClient()
  const chainId = await publicClient.getChainId()
  if (![31337, 84532].includes(chainId)) throw new Error("base_intake_v2_chain_not_allowed")

  const localFixtureMode = environment === "local" && process.env.FUNDLOOP_LOCAL_BASE_FIXTURE_MODE === "true"
  if (chainId === 31337 && !localFixtureMode) throw new Error("base_intake_v2_local_fixture_mode_required")
  const tokenAddresses = chainId === 84532
    ? [BASE_SEPOLIA_USDC, ZERO, ZERO]
    : [required("BASE_USDC_ADDRESS"), required("BASE_USDT_ADDRESS"), required("BASE_PYUSD_ADDRESS")]
  const providerApprovals = chainId === 84532 ? [true, false, false] : [true, true, true]
  const [deployer] = await viem.getWalletClients()
  const args = [
    deployer.account.address,
    required("PLATFORM_TREASURY_ADDRESS"),
    required("EPOCH_TREASURY_ADDRESS"),
    ...tokenAddresses,
    ...providerApprovals,
  ]
  if (new Set(args.slice(1, 6).filter((value) => value !== ZERO).map((value) => value.toLowerCase())).size !== args.slice(1, 6).filter((value) => value !== ZERO).length) {
    throw new Error("base_intake_v2_addresses_must_be_distinct")
  }

  const intake = await viem.deployContract("FundLoopBaseIntakeV2", args, { client: { wallet: deployer } })
  console.log(JSON.stringify({
    version: "fundloop-base-intake-v2",
    environment,
    networkName,
    chainId,
    enabled: true,
    contractAddress: intake.address,
    platformTreasuryAddress: args[1],
    epochTreasuryAddress: args[2],
    providerEvidence: localFixtureMode ? "local_fixture_only" : "reviewed_issuer",
    tokens: {
      USDC: { address: args[3], enabled: providerApprovals[0] },
      USDT: { address: args[4], enabled: providerApprovals[1] },
      PYUSD: { address: args[5], enabled: providerApprovals[2] },
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "base_intake_v2_deployment_failed")
  process.exitCode = 1
})
