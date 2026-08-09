import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { network } from "hardhat"
import { observeBaseIntakeV2Receipt } from "../lib/base-intake-v2-observer.js"

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
    true,
    true,
    true,
  ], { client: { wallet: owner } })
  return { viem, owner, sender, platformTreasury, epochTreasury, attacker, usdc: tokens[0], usdt: tokens[1], pyusd: tokens[2], evil: tokens[3], intake }
}

describe("FundLoopBaseIntakeV2", () => {
  it("splits gross receipt into exact snapshotted fee and net treasury balances", async () => {
    const { viem, owner, sender, platformTreasury, epochTreasury, usdc, intake } = await fixture()
    const publicClient = await viem.getPublicClient()
    await intake.write.setProjectFeeBps([42n, 250], { account: owner.account })
    await usdc.write.mint([sender.account.address, 10_000_000n], { account: owner.account })
    await usdc.write.approve([intake.address, 10_000_000n], { account: sender.account })
    const txHash = await intake.write.deposit([42n, 7n, usdc.address, 10_000_000n, `0x${"11".repeat(32)}`], { account: sender.account })
    const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    assert.equal(await usdc.read.balanceOf([platformTreasury.account.address]), 250_000n)
    assert.equal(await usdc.read.balanceOf([epochTreasury.account.address]), 9_750_000n)
    const [receipt] = await intake.getEvents.BaseReceipt()
    assert.equal(receipt.args.grossAmount, 10_000_000n)
    assert.equal(receipt.args.projectFeeBps, 250)
    assert.equal(receipt.args.projectFeeVersion, 1)
    assert.equal(receipt.args.feeAmount, 250_000n)
    assert.equal(receipt.args.netEpochAmount, 9_750_000n)
    assert.equal((await intake.getEvents.PlatformFeeTransferred())[0].args.amount, 250_000n)
    assert.equal((await intake.getEvents.EpochTreasuryFunded())[0].args.amount, 9_750_000n)
    const observation = await observeBaseIntakeV2Receipt({
      snapshot: { id: 1, txHash, blockHash: txReceipt.blockHash, blockNumber: txReceipt.blockNumber,
        logIndex: Number(receipt.logIndex), receiptReference: receipt.args.receiptReference,
        contractAddress: intake.address, tokenAddress: usdc.address, projectId: 42n, accountingPeriodId: 7n,
        senderAddress: sender.account.address, platformTreasuryAddress: platformTreasury.account.address,
        epochTreasuryAddress: epochTreasury.account.address, grossAmount: 10_000_000n, feeBps: 250, feeVersion: 1,
        platformFeeAmount: 250_000n, netEpochAmount: 9_750_000n },
      client: publicClient,
      now: new Date("2026-08-09T12:00:00Z"),
    })
    assert.equal(observation.platformObservedNativeAmount, "250000")
    assert.equal(observation.epochObservedNativeAmount, "9750000")
    assert.equal(observation.observationSource, "trusted_viem_v1")
    assert.equal(observation.receiptEventMatched, true)
    assert.equal(observation.observedLogIndex, Number(receipt.logIndex))
    assert.equal(observation.observedReceiptReference, receipt.args.receiptReference)
    assert.equal(observation.observedReceiptBlockNumber, Number(txReceipt.blockNumber))
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
    await assert.rejects(intake.write.deposit([1n, 1n, usdt.address, 1_000_000n, reference], { account: sender.account }), /FeeNotConfigured/)
    await intake.write.setProjectFeeBps([1n, 250], { account: owner.account })
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

  it("cannot activate an unverified provider token", async () => {
    const { viem, owner, platformTreasury, epochTreasury, usdc } = await fixture()
    const intake = await viem.deployContract("FundLoopBaseIntakeV2", [owner.account.address,
      platformTreasury.account.address, epochTreasury.account.address, usdc.address,
      "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000",
      true, false, false], { client: { wallet: owner } })
    await assert.rejects(intake.write.setTokenEnabled([1, true], { account: owner.account }), /TokenNotProviderApproved/)
  })

  it("binds observations to the exact log, receipt reference, block, and historical fee version", async () => {
    const { viem, owner, sender, platformTreasury, epochTreasury, usdc, intake } = await fixture()
    const publicClient = await viem.getPublicClient()
    await intake.write.setProjectFeeBps([42n, 100], { account: owner.account })
    await usdc.write.mint([sender.account.address, 1_000_000n], { account: owner.account })
    await usdc.write.approve([intake.address, 1_000_000n], { account: sender.account })
    const receiptReference = `0x${"55".repeat(32)}`
    const txHash = await intake.write.deposit([42n, 7n, usdc.address, 1_000_000n, receiptReference], { account: sender.account })
    const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    const [receipt] = await intake.getEvents.BaseReceipt()
    await intake.write.setProjectFeeBps([42n, 250], { account: owner.account })
    assert.equal(await intake.read.projectFeeVersion([42n]), 2)

    const snapshot = { id: 1, txHash, blockHash: txReceipt.blockHash, blockNumber: txReceipt.blockNumber,
      logIndex: Number(receipt.logIndex), receiptReference, contractAddress: intake.address, tokenAddress: usdc.address,
      projectId: 42n, accountingPeriodId: 7n, senderAddress: sender.account.address,
      platformTreasuryAddress: platformTreasury.account.address, epochTreasuryAddress: epochTreasury.account.address,
      grossAmount: 1_000_000n, feeBps: 100, feeVersion: 1,
      platformFeeAmount: 10_000n, netEpochAmount: 990_000n }
    const exact = await observeBaseIntakeV2Receipt({ snapshot, client: publicClient })
    assert.equal(exact.receiptEventMatched, true)
    assert.equal(exact.observedReceiptBlockNumber, Number(txReceipt.blockNumber))
    assert.equal((await observeBaseIntakeV2Receipt({ snapshot: { ...snapshot, logIndex: Number(receipt.logIndex) + 1 }, client: publicClient })).receiptEventMatched, false)
    assert.equal((await observeBaseIntakeV2Receipt({ snapshot: { ...snapshot, receiptReference: `0x${"66".repeat(32)}` }, client: publicClient })).receiptEventMatched, false)
    assert.equal((await observeBaseIntakeV2Receipt({ snapshot: { ...snapshot, feeVersion: 2 }, client: publicClient })).receiptEventMatched, false)
  })
})
