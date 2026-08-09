import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { network } from "hardhat"

async function fixture() {
  const { viem } = await network.connect()
  const [owner, sender, platformTreasury, epochTreasury, attacker] = await viem.getWalletClients()
  const tokens = await Promise.all(["USDC", "USDT", "PYUSD", "EVIL"].map((symbol) =>
    viem.deployContract("MockERC20", [`Mock ${symbol}`, symbol, 6], { client: { wallet: owner } })))
  const intake = await viem.deployContract("FundLoopBaseIntakeV2", [
    owner.account.address,
    platformTreasury.account.address,
    epochTreasury.account.address,
    tokens[0].address,
    tokens[1].address,
    tokens[2].address,
  ], { client: { wallet: owner } })
  return { viem, owner, sender, platformTreasury, epochTreasury, attacker, usdc: tokens[0], usdt: tokens[1], pyusd: tokens[2], evil: tokens[3], intake }
}

describe("FundLoopBaseIntakeV2", () => {
  it("splits gross receipt into exact snapshotted fee and net treasury balances", async () => {
    const { owner, sender, platformTreasury, epochTreasury, usdc, intake } = await fixture()
    await intake.write.setProjectFeeBps([42n, 250], { account: owner.account })
    await usdc.write.mint([sender.account.address, 10_000_000n], { account: owner.account })
    await usdc.write.approve([intake.address, 10_000_000n], { account: sender.account })
    await intake.write.deposit([42n, 7n, usdc.address, 10_000_000n, `0x${"11".repeat(32)}`], { account: sender.account })

    assert.equal(await usdc.read.balanceOf([platformTreasury.account.address]), 250_000n)
    assert.equal(await usdc.read.balanceOf([epochTreasury.account.address]), 9_750_000n)
    const [receipt] = await intake.getEvents.BaseReceipt()
    assert.equal(receipt.args.grossAmount, 10_000_000n)
    assert.equal(receipt.args.projectFeeBps, 250)
    assert.equal(receipt.args.feeAmount, 250_000n)
    assert.equal(receipt.args.netEpochAmount, 9_750_000n)
    assert.equal((await intake.getEvents.PlatformFeeTransferred())[0].args.amount, 250_000n)
    assert.equal((await intake.getEvents.EpochTreasuryFunded())[0].args.amount, 9_750_000n)
  })

  it("accepts only the three constructor-bound stablecoins", async () => {
    const { owner, sender, evil, intake } = await fixture()
    await evil.write.mint([sender.account.address, 1_000_000n], { account: owner.account })
    await evil.write.approve([intake.address, 1_000_000n], { account: sender.account })
    await assert.rejects(intake.write.deposit([1n, 1n, evil.address, 1_000_000n, `0x${"22".repeat(32)}`], { account: sender.account }), /TokenNotAllowed/)
  })

  it("rejects excessive fees, duplicate treasuries, reused receipts, and deposits while paused", async () => {
    const { owner, sender, platformTreasury, usdt, intake } = await fixture()
    await assert.rejects(intake.write.setProjectFeeBps([1n, 1001], { account: owner.account }), /FeeTooHigh/)
    await assert.rejects(intake.write.setTreasuries([platformTreasury.account.address, platformTreasury.account.address], { account: owner.account }), /DuplicateTreasury/)
    await usdt.write.mint([sender.account.address, 2_000_000n], { account: owner.account })
    await usdt.write.approve([intake.address, 2_000_000n], { account: sender.account })
    const reference = `0x${"33".repeat(32)}`
    await intake.write.deposit([1n, 1n, usdt.address, 1_000_000n, reference], { account: sender.account })
    await assert.rejects(intake.write.deposit([1n, 1n, usdt.address, 1_000_000n, reference], { account: sender.account }), /ReceiptReferenceUsed/)
    await intake.write.setPaused([true], { account: owner.account })
    await assert.rejects(intake.write.deposit([1n, 1n, usdt.address, 1n, `0x${"44".repeat(32)}`], { account: sender.account }), /EnforcedPause/)
  })

  it("restricts pause, token, treasury, and fee configuration to the owner", async () => {
    const { attacker, intake } = await fixture()
    await assert.rejects(intake.write.setPaused([true], { account: attacker.account }), /OwnableUnauthorizedAccount/)
    await assert.rejects(intake.write.setTokenEnabled([0, false], { account: attacker.account }), /OwnableUnauthorizedAccount/)
    await assert.rejects(intake.write.setProjectFeeBps([1n, 250], { account: attacker.account }), /OwnableUnauthorizedAccount/)
  })
})
