import { network } from "hardhat"

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const allowedEnvironments = new Set(["local", "dev", "test"])

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

  const [deployer] = await viem.getWalletClients()
  const args = [
    deployer.account.address,
    required("PLATFORM_TREASURY_ADDRESS"),
    required("EPOCH_TREASURY_ADDRESS"),
    required("BASE_USDC_ADDRESS"),
    required("BASE_USDT_ADDRESS"),
    required("BASE_PYUSD_ADDRESS"),
  ]
  if (new Set(args.slice(1).map((value) => value.toLowerCase())).size !== args.length - 1) {
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
    tokens: { USDC: args[3], USDT: args[4], PYUSD: args[5] },
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "base_intake_v2_deployment_failed")
  process.exitCode = 1
})
