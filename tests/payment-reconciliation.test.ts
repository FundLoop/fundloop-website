import { describe, expect, it } from "vitest"
import { encodeAbiParameters, encodeEventTopics } from "viem"
import { fundLoopIntakeAbi } from "@/lib/onchain/fundloop-intake-abi"
import { evaluateSubmissionAgainstReceipt, type ReconciliationSubmissionSnapshot } from "@/lib/onchain/payment-reconciliation"

const contractAddress = "0x1111111111111111111111111111111111111111"
const treasuryAddress = "0x2222222222222222222222222222222222222222"
const tokenAddress = "0x3333333333333333333333333333333333333333"
const walletAddress = "0x4444444444444444444444444444444444444444"

function buildDepositLog() {
  return {
    address: contractAddress as `0x${string}`,
    topics: encodeEventTopics({
      abi: fundLoopIntakeAbi,
      eventName: "Deposit",
      args: {
        projectId: BigInt(7),
        asset: tokenAddress as `0x${string}`,
        sender: walletAddress as `0x${string}`,
      },
    }) as [`0x${string}`, ...`0x${string}`[]],
    data: encodeAbiParameters(
      [
        { name: "periodId", type: "uint8" },
        { name: "amount", type: "uint256" },
        { name: "treasury", type: "address" },
        { name: "isNative", type: "bool" },
      ],
      [4, BigInt(1_000_000), treasuryAddress as `0x${string}`, false],
    ),
    logIndex: 2,
  }
}

function buildSnapshot(): ReconciliationSubmissionSnapshot {
  return {
    submissionId: 9,
    paymentId: 12,
    projectId: 7,
    projectSlug: "fundloop-studio",
      txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    walletAddress,
    amountRaw: "1000000",
    periodId: 4,
    chainNetworkKey: "base",
    intakeContractAddress: contractAddress,
    intakeTreasuryAddress: treasuryAddress,
    assetTokenAddress: tokenAddress,
    assetIsNative: false,
  }
}

describe("evaluateSubmissionAgainstReceipt", () => {
  it("returns confirming when the deposit matches but has not reached finality depth", () => {
    const evaluation = evaluateSubmissionAgainstReceipt(
      buildSnapshot(),
      {
        status: "success",
        to: contractAddress as `0x${string}`,
        blockNumber: BigInt(100),
        logs: [buildDepositLog()],
      },
      BigInt(102),
      5,
    )

    expect(evaluation.status).toBe("confirming")
    expect(evaluation.confirmationCount).toBe(3)
    expect(evaluation.matchedLogIndex).toBe(2)
  })

  it("returns confirmed when the deposit matches and reaches finality depth", () => {
    const evaluation = evaluateSubmissionAgainstReceipt(
      buildSnapshot(),
      {
        status: "success",
        to: contractAddress as `0x${string}`,
        blockNumber: BigInt(100),
        logs: [buildDepositLog()],
      },
      BigInt(110),
      5,
    )

    expect(evaluation.status).toBe("confirmed")
    expect(evaluation.confirmationCount).toBe(11)
  })

  it("returns failed when the transaction reverted", () => {
    const evaluation = evaluateSubmissionAgainstReceipt(
      buildSnapshot(),
      {
        status: "reverted",
        to: contractAddress as `0x${string}`,
        blockNumber: BigInt(100),
        logs: [],
      },
      BigInt(100),
      5,
    )

    expect(evaluation.status).toBe("failed")
    expect(evaluation.failureCode).toBe("tx_reverted")
  })

  it("returns failed when the deposit event does not match the recorded snapshot", () => {
    const evaluation = evaluateSubmissionAgainstReceipt(
      buildSnapshot(),
      {
        status: "success",
        to: contractAddress as `0x${string}`,
        blockNumber: BigInt(100),
        logs: [
          {
            ...buildDepositLog(),
            data: encodeAbiParameters(
              [
                { name: "periodId", type: "uint8" },
                { name: "amount", type: "uint256" },
                { name: "treasury", type: "address" },
                { name: "isNative", type: "bool" },
              ],
              [5, BigInt(1_000_000), treasuryAddress as `0x${string}`, false],
            ),
          },
        ],
      },
      BigInt(110),
      5,
    )

    expect(evaluation.status).toBe("failed")
    expect(evaluation.failureCode).toBe("deposit_event_mismatch")
  })
})
