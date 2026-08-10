import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { network } from "hardhat"
import { encodeFunctionData } from "viem"
import { observeBaseSafePayoutReceipt } from "../lib/base-safe-payout-observer.js"

const epochKey = `0x${"11".repeat(32)}`

async function safeCall(safe, owner, contract, functionName, args) {
  const data = encodeFunctionData({ abi: contract.abi, functionName, args })
  return safe.write.execOwnerTransaction([contract.address, 0n, data], { account: owner.account })
}

async function fixture(gasFunding = 1_000_000n) {
  const { viem } = await network.connect()
  const [owner, signer, recipient, otherRecipient, attacker] = await viem.getWalletClients()
  const token = await viem.deployContract("MockERC20", ["Mock USDC", "USDC", 6], { client: { wallet: owner } })
  const otherToken = await viem.deployContract("MockERC20", ["Mock USDT", "USDT", 6], { client: { wallet: owner } })
  const epochSafe = await viem.deployContract("MockSafe", [owner.account.address], { client: { wallet: owner } })
  const platformSafe = await viem.deployContract("MockSafe", [owner.account.address], { client: { wallet: owner } })
  const gasSponsor = await viem.deployContract("FundLoopPaymasterBudget", [epochSafe.address, epochSafe.address, 100_000n], { client: { wallet: owner } })
  const epochModule = await viem.deployContract("FundLoopSafePayoutModule", [epochSafe.address,
    signer.account.address, gasSponsor.address, 20_000_000n, 50_000_000n, 100_000_000n], { client: { wallet: owner } })
  await epochSafe.write.enableModule([epochModule.address], { account: owner.account })
  await safeCall(epochSafe, owner, epochModule, "setTokenAllowed", [token.address, true])
  await safeCall(epochSafe, owner, gasSponsor, "setController", [epochModule.address])
  await gasSponsor.write.fund([], { account: owner.account, value: gasFunding })
  await token.write.mint([epochSafe.address, 200_000_000n], { account: owner.account })
  await token.write.mint([platformSafe.address, 200_000_000n], { account: owner.account })
  return { viem, owner, signer, recipient, otherRecipient, attacker, token, otherToken, epochSafe, platformSafe, epochModule, gasSponsor }
}

async function authorize(safe, module, owner, token, recipient, amount, nonce, expiresAt = 4_000_000_000n, feeRecipient = owner.account.address, feeAmount = 0n, gasBudget = 10_000n) {
  const hash = await module.read.requestHash([token.address, recipient.account.address, amount, feeRecipient, feeAmount, gasBudget, epochKey, expiresAt, nonce])
  await safeCall(safe, owner, module, "authorizeRequest", [hash])
  return { hash, expiresAt, feeRecipient, feeAmount, gasBudget }
}

describe("FundLoopSafePayoutModule", () => {
  it("keeps epoch and platform Safe balances separate and executes one exact authorized payout", async () => {
    const { viem, owner, signer, recipient, token, epochSafe, platformSafe, epochModule, gasSponsor } = await fixture()
    const request = await authorize(epochSafe, epochModule, owner, token, recipient, 15_000_000n, 1n, 4_000_000_000n, platformSafe.address, 1_000_000n)
    const txHash = await epochModule.write.executePayout([token.address, recipient.account.address, 15_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 1n], { account: signer.account })
    assert.equal(await token.read.balanceOf([recipient.account.address]), 15_000_000n)
    assert.equal(await token.read.balanceOf([epochSafe.address]), 184_000_000n)
    assert.equal(await token.read.balanceOf([platformSafe.address]), 201_000_000n)
    assert.equal(await gasSponsor.read.remainingBudget(), 990_000n)
    const observation = await observeBaseSafePayoutReceipt({ client: await viem.getPublicClient(), moduleAddress: epochModule.address, txHash, chainId: 31337 })
    assert.equal(observation.status, "finalized")
    assert.equal(observation.observedUserFeeNativeAmount, "1000000")
    assert.equal(observation.observedFeeRecipientAddress.toLowerCase(), platformSafe.address.toLowerCase())
    assert.equal(observation.observedGasBudgetNative, "10000")
    assert.equal(observation.observedRequestHash, await epochModule.read.requestHash([token.address, recipient.account.address, 15_000_000n, platformSafe.address, 1_000_000n, request.gasBudget, epochKey, request.expiresAt, 1n]))
  })

  it("rejects over-limit, wrong-token, wrong-recipient, replay, expired, and revoked signer requests", async () => {
    const { owner, signer, recipient, otherRecipient, attacker, token, otherToken, epochSafe, epochModule } = await fixture()
    let request = await authorize(epochSafe, epochModule, owner, token, recipient, 20_000_001n, 1n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 20_000_001n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 1n], { account: signer.account }), /TransactionLimitExceeded/)
    request = await authorize(epochSafe, epochModule, owner, token, recipient, 1_000_000n, 2n)
    await assert.rejects(epochModule.write.executePayout([otherToken.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 2n], { account: signer.account }), /TokenNotAllowed/)
    await assert.rejects(epochModule.write.executePayout([token.address, otherRecipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 2n], { account: signer.account }), /RequestNotAuthorized/)
    await epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 2n], { account: signer.account })
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 2n], { account: signer.account }), /RequestAlreadyUsed/)
    request = await authorize(epochSafe, epochModule, owner, token, recipient, 1_000_000n, 3n, 1n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 3n], { account: signer.account }), /RequestExpired/)
    await safeCall(epochSafe, owner, epochModule, "rotateSigner", [attacker.account.address])
    request = await authorize(epochSafe, epochModule, owner, token, recipient, 1_000_000n, 4n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 4n], { account: signer.account }), /UnauthorizedSigner/)
  })

  it("enforces cumulative 24-hour and epoch limits independently of database state", async () => {
    const { owner, signer, recipient, token, epochSafe, epochModule } = await fixture()
    for (let nonce = 1n; nonce <= 2n; nonce++) {
      const request = await authorize(epochSafe, epochModule, owner, token, recipient, 20_000_000n, nonce)
      await epochModule.write.executePayout([token.address, recipient.account.address, 20_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, nonce], { account: signer.account })
    }
    let request = await authorize(epochSafe, epochModule, owner, token, recipient, 11_000_000n, 3n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 11_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 3n], { account: signer.account }), /RollingLimitExceeded/)
    await safeCall(epochSafe, owner, epochModule, "setLimits", [20_000_000n, 200_000_000n, 45_000_000n])
    request = await authorize(epochSafe, epochModule, owner, token, recipient, 6_000_000n, 4n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 6_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 4n], { account: signer.account }), /EpochLimitExceeded/)
  })

  it("requires owner authorization, enabled Safe module, allowed token, and unpaused state", async () => {
    const { owner, signer, recipient, attacker, token, epochSafe, epochModule } = await fixture()
    const request = await authorize(epochSafe, epochModule, owner, token, recipient, 1_000_000n, 1n)
    await assert.rejects(epochModule.write.authorizeRequest([request.hash], { account: attacker.account }), /OwnableUnauthorizedAccount/)
    await assert.rejects(epochModule.write.authorizeRequest([request.hash], { account: owner.account }), /OwnableUnauthorizedAccount/)
    await safeCall(epochSafe, owner, epochModule, "setPaused", [true])
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 1n], { account: signer.account }), /EnforcedPause/)
    await safeCall(epochSafe, owner, epochModule, "setPaused", [false])
    await epochSafe.write.disableModule([epochModule.address], { account: owner.account })
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 1n], { account: signer.account }), /ModuleNotEnabled/)
  })

  it("atomically refuses payout when the connected gas sponsor is depleted", async () => {
    const { owner, signer, recipient, token, epochSafe, epochModule } = await fixture(5_000n)
    const request = await authorize(epochSafe, epochModule, owner, token, recipient, 1_000_000n, 1n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient,
      request.feeAmount, request.gasBudget, epochKey, request.expiresAt, 1n], { account: signer.account }), /BudgetDepleted/)
    assert.equal(await token.read.balanceOf([recipient.account.address]), 0n)
  })

  it("turns a disappeared previously observed receipt into immutable reorg evidence", async () => {
    const previousObservation = { status: "confirming", txHash: `0x${"12".repeat(32)}`, blockNumber: 10n, blockHash: `0x${"34".repeat(32)}`,
      currentBlockNumber: 11n, confirmationCount: 1, l1BatchFinalized: false, receiptSuccess: true,
      observedTokenAddress: "0x00000000000000000000000000000000000000a1", observedRecipientAddress: "0x0000000000000000000000000000000000000001",
      observedNativeAtomicAmount: "100", observedFeeRecipientAddress: "0x0000000000000000000000000000000000000010",
      observedUserFeeNativeAmount: "10", observedGasBudgetNative: "1", observedRequestHash: `0x${"56".repeat(32)}`, observedAt: "2026-08-10T00:00:00Z" }
    const client = { getTransactionReceipt: async()=>{throw new Error("receipt missing")}, getBlockNumber: async()=>20n }
    const observation = await observeBaseSafePayoutReceipt({client,moduleAddress:"0x0000000000000000000000000000000000000020",
      txHash:previousObservation.txHash,chainId:31337,previousObservation})
    assert.equal(observation.status,"reorged");assert.equal(observation.blockHash,previousObservation.blockHash);assert.equal(observation.currentBlockNumber,20n)
  })
})

describe("FundLoopPaymasterBudget", () => {
  it("tracks bounded sponsorship, replay, depletion, pause, and controller rotation", async () => {
    const { viem } = await network.connect()
    const [owner, controller, nextController, attacker] = await viem.getWalletClients()
    const budget = await viem.deployContract("FundLoopPaymasterBudget", [owner.account.address, controller.account.address, 100_000n], { client: { wallet: owner } })
    await budget.write.fund([], { account: owner.account, value: 150_000n })
    const first = `0x${"22".repeat(32)}`
    await budget.write.sponsor([first, controller.account.address, 100_000n], { account: controller.account })
    await assert.rejects(budget.write.sponsor([first, controller.account.address, 1n], { account: controller.account }), /SponsorshipAlreadyUsed/)
    await assert.rejects(budget.write.sponsor([`0x${"33".repeat(32)}`, controller.account.address, 60_000n], { account: controller.account }), /BudgetDepleted/)
    await assert.rejects(budget.write.sponsor([`0x${"44".repeat(32)}`, controller.account.address, 1n], { account: attacker.account }), /UnauthorizedController/)
    await budget.write.setPaused([true], { account: owner.account })
    await assert.rejects(budget.write.sponsor([`0x${"55".repeat(32)}`, controller.account.address, 1n], { account: controller.account }), /EnforcedPause/)
    await budget.write.setPaused([false], { account: owner.account })
    await budget.write.setController([nextController.account.address], { account: owner.account })
    await budget.write.sponsor([`0x${"66".repeat(32)}`, nextController.account.address, 50_000n], { account: nextController.account })
    assert.equal(await budget.read.remainingBudget(), 0n)
  })
})
