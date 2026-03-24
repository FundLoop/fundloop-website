import { network } from "hardhat"

async function main() {
  const treasury = process.env.TREASURY_ADDRESS
  if (!treasury) {
    throw new Error("TREASURY_ADDRESS is required")
  }

  const { viem } = await network.connect()
  const [deployer] = await viem.getWalletClients()

  const intake = await viem.deployContract("FundLoopIntake", [deployer.account.address, treasury], {
    client: { wallet: deployer },
  })

  console.log(`FundLoopIntake deployed at ${intake.address}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
