import { decodeEventLog, parseAbi } from "viem"

export const fundLoopSafePayoutModuleAbi = parseAbi([
  "function requestHash(address token,address recipient,uint256 recipientAmount,address feeRecipient,uint256 feeAmount,bytes32 epochKey,uint64 expiresAt,uint256 nonce) view returns (bytes32)",
  "function executePayout(address token,address recipient,uint256 recipientAmount,address feeRecipient,uint256 feeAmount,bytes32 epochKey,uint64 expiresAt,uint256 nonce)",
  "event PayoutExecuted(bytes32 indexed requestHash,bytes32 indexed epochKey,address indexed token,address recipient,uint256 recipientAmount,address feeRecipient,uint256 feeAmount)",
])

export async function observeBaseSafePayoutReceipt({ client, moduleAddress, txHash, chainId }) {
  const receipt = await client.getTransactionReceipt({ hash: txHash })
  const currentBlockNumber = await client.getBlockNumber()
  let finalizedBlockNumber = 0n
  try {
    finalizedBlockNumber = (await client.getBlock({ blockTag: "finalized" })).number
  } catch {
    if (chainId === 31337) finalizedBlockNumber = receipt.blockNumber
  }
  const event = receipt.logs
    .filter((log) => log.address.toLowerCase() === moduleAddress.toLowerCase())
    .map((log) => {
      try { return decodeEventLog({ abi: fundLoopSafePayoutModuleAbi, data: log.data, topics: log.topics }) } catch { return null }
    })
    .find((decoded) => decoded?.eventName === "PayoutExecuted")
  if (!event || event.eventName !== "PayoutExecuted") throw new Error("base_payout_event_missing")
  const finalized = finalizedBlockNumber >= receipt.blockNumber
  return {
    status: receipt.status === "success" ? (finalized ? "finalized" : "confirming") : "failed",
    txHash,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    currentBlockNumber,
    confirmationCount: Number(currentBlockNumber - receipt.blockNumber),
    l1BatchFinalized: finalized,
    receiptSuccess: receipt.status === "success",
    observedTokenAddress: event.args.token,
    observedRecipientAddress: event.args.recipient,
    observedNativeAtomicAmount: event.args.recipientAmount.toString(),
    observedFeeRecipientAddress: event.args.feeRecipient,
    observedUserFeeNativeAmount: event.args.feeAmount.toString(),
    observedRequestHash: event.args.requestHash,
    observedAt: new Date().toISOString(),
  }
}
