import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { network } from "hardhat"
import { observeBaseSafePayoutReceipt } from "../lib/base-safe-payout-observer.js"

const epochKey = `0x${"11".repeat(32)}`

async function fixture() {
  const { viem } = await network.connect()
  const [owner, signer, recipient, otherRecipient, attacker] = await viem.getWalletClients()
  const token = await viem.deployContract("MockERC20", ["Mock USDC", "USDC", 6], { client: { wallet: owner } })
  const otherToken = await viem.deployContract("MockERC20", ["Mock USDT", "USDT", 6], { client: { wallet: owner } })
  const epochSafe = await viem.deployContract("MockSafe", [owner.account.address], { client: { wallet: owner } })
  const platformSafe = await viem.deployContract("MockSafe", [owner.account.address], { client: { wallet: owner } })
  const epochModule = await viem.deployContract("FundLoopSafePayoutModule", [owner.account.address, epochSafe.address,
    signer.account.address, 20_000_000n, 50_000_000n, 100_000_000n], { client: { wallet: owner } })
  const platformModule = await viem.deployContract("FundLoopSafePayoutModule", [owner.account.address, platformSafe.address,
    signer.account.address, 20_000_000n, 50_000_000n, 100_000_000n], { client: { wallet: owner } })
  await epochSafe.write.enableModule([epochModule.address], { account: owner.account })
  await platformSafe.write.enableModule([platformModule.address], { account: owner.account })
  await epochModule.write.setTokenAllowed([token.address, true], { account: owner.account })
  await platformModule.write.setTokenAllowed([token.address, true], { account: owner.account })
  await token.write.mint([epochSafe.address, 200_000_000n], { account: owner.account })
  await token.write.mint([platformSafe.address, 200_000_000n], { account: owner.account })
  return { viem, owner, signer, recipient, otherRecipient, attacker, token, otherToken, epochSafe, platformSafe, epochModule, platformModule }
}

async function authorize(module, owner, token, recipient, amount, nonce, expiresAt = 4_000_000_000n, feeRecipient = owner.account.address, feeAmount = 0n) {
  const hash = await module.read.requestHash([token.address, recipient.account.address, amount, feeRecipient, feeAmount, epochKey, expiresAt, nonce])
  await module.write.authorizeRequest([hash], { account: owner.account })
  return { hash, expiresAt, feeRecipient, feeAmount }
}

describe("FundLoopSafePayoutModule", () => {
  it("keeps epoch and platform Safe balances separate and executes one exact authorized payout", async () => {
    const { viem, owner, signer, recipient, token, epochSafe, platformSafe, epochModule } = await fixture()
    const request = await authorize(epochModule, owner, token, recipient, 15_000_000n, 1n, 4_000_000_000n, platformSafe.address, 1_000_000n)
    const txHash = await epochModule.write.executePayout([token.address, recipient.account.address, 15_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 1n], { account: signer.account })
    assert.equal(await token.read.balanceOf([recipient.account.address]), 15_000_000n)
    assert.equal(await token.read.balanceOf([epochSafe.address]), 184_000_000n)
    assert.equal(await token.read.balanceOf([platformSafe.address]), 201_000_000n)
    const observation = await observeBaseSafePayoutReceipt({ client: await viem.getPublicClient(), moduleAddress: epochModule.address, txHash, chainId: 31337 })
    assert.equal(observation.status, "finalized")
    assert.equal(observation.observedUserFeeNativeAmount, "1000000")
    assert.equal(observation.observedFeeRecipientAddress.toLowerCase(), platformSafe.address.toLowerCase())
    assert.equal(observation.observedRequestHash, await epochModule.read.requestHash([token.address, recipient.account.address, 15_000_000n, platformSafe.address, 1_000_000n, epochKey, request.expiresAt, 1n]))
  })

  it("rejects over-limit, wrong-token, wrong-recipient, replay, expired, and revoked signer requests", async () => {
    const { owner, signer, recipient, otherRecipient, attacker, token, otherToken, epochModule } = await fixture()
    let request = await authorize(epochModule, owner, token, recipient, 20_000_001n, 1n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 20_000_001n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 1n], { account: signer.account }), /TransactionLimitExceeded/)
    request = await authorize(epochModule, owner, token, recipient, 1_000_000n, 2n)
    await assert.rejects(epochModule.write.executePayout([otherToken.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 2n], { account: signer.account }), /TokenNotAllowed/)
    await assert.rejects(epochModule.write.executePayout([token.address, otherRecipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 2n], { account: signer.account }), /RequestNotAuthorized/)
    await epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 2n], { account: signer.account })
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 2n], { account: signer.account }), /RequestAlreadyUsed/)
    request = await authorize(epochModule, owner, token, recipient, 1_000_000n, 3n, 1n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 3n], { account: signer.account }), /RequestExpired/)
    await epochModule.write.rotateSigner([attacker.account.address], { account: owner.account })
    request = await authorize(epochModule, owner, token, recipient, 1_000_000n, 4n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 4n], { account: signer.account }), /UnauthorizedSigner/)
  })

  it("enforces cumulative 24-hour and epoch limits independently of database state", async () => {
    const { owner, signer, recipient, token, epochModule } = await fixture()
    for (let nonce = 1n; nonce <= 2n; nonce++) {
      const request = await authorize(epochModule, owner, token, recipient, 20_000_000n, nonce)
      await epochModule.write.executePayout([token.address, recipient.account.address, 20_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, nonce], { account: signer.account })
    }
    let request = await authorize(epochModule, owner, token, recipient, 11_000_000n, 3n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 11_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 3n], { account: signer.account }), /RollingLimitExceeded/)
    await epochModule.write.setLimits([20_000_000n, 200_000_000n, 45_000_000n], { account: owner.account })
    request = await authorize(epochModule, owner, token, recipient, 6_000_000n, 4n)
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 6_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 4n], { account: signer.account }), /EpochLimitExceeded/)
  })

  it("requires owner authorization, enabled Safe module, allowed token, and unpaused state", async () => {
    const { owner, signer, recipient, attacker, token, epochSafe, epochModule } = await fixture()
    const request = await authorize(epochModule, owner, token, recipient, 1_000_000n, 1n)
    await assert.rejects(epochModule.write.authorizeRequest([request.hash], { account: attacker.account }), /OwnableUnauthorizedAccount/)
    await epochModule.write.setPaused([true], { account: owner.account })
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 1n], { account: signer.account }), /EnforcedPause/)
    await epochModule.write.setPaused([false], { account: owner.account })
    await epochSafe.write.disableModule([epochModule.address], { account: owner.account })
    await assert.rejects(epochModule.write.executePayout([token.address, recipient.account.address, 1_000_000n, request.feeRecipient, request.feeAmount, epochKey, request.expiresAt, 1n], { account: signer.account }), /ModuleNotEnabled/)
  })
})

describe("FundLoopPaymasterBudget", () => {
  it("tracks bounded sponsorship, replay, depletion, pause, and controller rotation", async () => {
    const { viem } = await network.connect()
    const [owner, controller, nextController, attacker] = await viem.getWalletClients()
    const budget = await viem.deployContract("FundLoopPaymasterBudget", [owner.account.address, controller.account.address, 100_000n], { client: { wallet: owner } })
    await budget.write.fund([150_000n], { account: owner.account })
    const first = `0x${"22".repeat(32)}`
    await budget.write.consume([first, 100_000n], { account: controller.account })
    await assert.rejects(budget.write.consume([first, 1n], { account: controller.account }), /SponsorshipAlreadyUsed/)
    await assert.rejects(budget.write.consume([`0x${"33".repeat(32)}`, 60_000n], { account: controller.account }), /BudgetDepleted/)
    await assert.rejects(budget.write.consume([`0x${"44".repeat(32)}`, 1n], { account: attacker.account }), /UnauthorizedController/)
    await budget.write.setPaused([true], { account: owner.account })
    await assert.rejects(budget.write.consume([`0x${"55".repeat(32)}`, 1n], { account: controller.account }), /EnforcedPause/)
    await budget.write.setPaused([false], { account: owner.account })
    await budget.write.setController([nextController.account.address], { account: owner.account })
    await budget.write.consume([`0x${"66".repeat(32)}`, 50_000n], { account: nextController.account })
    assert.equal(await budget.read.remainingBudget(), 0n)
  })
})
