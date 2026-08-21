import { network } from "hardhat"

async function main() {
  const { viem } = await network.connect()
  const [owner, treasury, payer] = await viem.getWalletClients()

  if (!owner || !treasury || !payer) {
    throw new Error("Hardhat must expose at least three unlocked accounts for Playwright local-wallet setup.")
  }

  const token = await viem.deployContract("MockERC20", ["Mock USD", "MUSD", 6], {
    client: { wallet: owner },
  })

  const intake = await viem.deployContract("FundLoopIntake", [owner.account.address, treasury.account.address], {
    client: { wallet: owner },
  })

  await token.write.mint([payer.account.address, 2_000_000_000n], {
    account: owner.account,
  })

  await intake.write.setAllowedToken([token.address, true], {
    account: owner.account,
  })

  console.log(
    JSON.stringify({
      ownerAddress: owner.account.address,
      treasuryAddress: treasury.account.address,
      payerAddress: payer.account.address,
      tokenAddress: token.address,
      intakeAddress: intake.address,
      abiVersion: "fundloop-intake-v1",
      mintedAmountRaw: "2000000000",
      tokenSymbol: "MUSD",
      tokenDecimals: 6,
    }),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
