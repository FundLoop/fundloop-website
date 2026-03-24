import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { network } from "hardhat"

describe("FundLoopIntake", async () => {
  const { viem } = await network.connect()

  it("forwards native deposits and emits a deposit event", async () => {
    const [owner, sender, treasury] = await viem.getWalletClients()
    const publicClient = await viem.getPublicClient()
    const intake = await viem.deployContract("FundLoopIntake", [owner.account.address, treasury.account.address], {
      client: { wallet: owner },
    })

    const treasuryBalanceBefore = await publicClient.getBalance({ address: treasury.account.address })
    const txHash = await intake.write.depositNative([42n], {
      account: sender.account,
      value: 123456789n,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    const treasuryBalanceAfter = await publicClient.getBalance({ address: treasury.account.address })

    assert.equal(receipt.status, "success")
    assert.equal(treasuryBalanceAfter - treasuryBalanceBefore, 123456789n)

    const events = await intake.getEvents.Deposit()
    assert.equal(events.length, 1)
    assert.equal(events[0].args.projectId, 42n)
    assert.equal(events[0].args.amount, 123456789n)
    assert.equal(events[0].args.sender?.toLowerCase(), sender.account.address.toLowerCase())
    assert.equal(events[0].args.isNative, true)
  })

  it("forwards ERC20 deposits for allowed tokens", async () => {
    const [owner, sender, treasury] = await viem.getWalletClients()
    const publicClient = await viem.getPublicClient()
    const token = await viem.deployContract("MockERC20", ["Mock USD", "MUSD", 6], { client: { wallet: owner } })
    const intake = await viem.deployContract("FundLoopIntake", [owner.account.address, treasury.account.address], {
      client: { wallet: owner },
    })

    await token.write.mint([sender.account.address, 5_000_000n], { account: owner.account })
    await intake.write.setAllowedToken([token.address, true], { account: owner.account })
    await token.write.approve([intake.address, 2_500_000n], { account: sender.account })

    const txHash = await intake.write.depositToken([11n, token.address, 2_500_000n], { account: sender.account })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    const treasuryBalance = await token.read.balanceOf([treasury.account.address])

    assert.equal(receipt.status, "success")
    assert.equal(treasuryBalance, 2_500_000n)

    const events = await intake.getEvents.Deposit()
    assert.equal(events.length, 1)
    assert.equal(events[0].args.projectId, 11n)
    assert.equal(events[0].args.asset?.toLowerCase(), token.address.toLowerCase())
    assert.equal(events[0].args.amount, 2_500_000n)
    assert.equal(events[0].args.isNative, false)
  })

  it("rejects unsupported tokens", async () => {
    const [owner, sender, treasury] = await viem.getWalletClients()
    const token = await viem.deployContract("MockERC20", ["Mock USD", "MUSD", 6], { client: { wallet: owner } })
    const intake = await viem.deployContract("FundLoopIntake", [owner.account.address, treasury.account.address], {
      client: { wallet: owner },
    })

    await token.write.mint([sender.account.address, 5_000_000n], { account: owner.account })
    await token.write.approve([intake.address, 1_000_000n], { account: sender.account })

    await assert.rejects(
      intake.write.depositToken([9n, token.address, 1_000_000n], { account: sender.account }),
      /TokenNotAllowed/,
    )
  })
})
