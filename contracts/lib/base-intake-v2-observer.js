import { decodeEventLog, parseAbiItem } from "viem"

const receiptEvent = parseAbiItem("event BaseReceipt(bytes32 indexed receiptReference,uint256 indexed projectId,uint256 indexed accountingPeriodId,address token,address sender,uint256 grossAmount,uint16 projectFeeBps,uint32 projectFeeVersion,uint256 feeAmount,uint256 netEpochAmount,address platformTreasury,address epochTreasury)")
const transferEvent = parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 value)")

export async function observeBaseIntakeV2Receipt(input) {
  const { snapshot } = input
  let receipt
  try { receipt = await input.client.getTransactionReceipt({ hash: snapshot.txHash }) }
  catch {
    const replacement = await input.resolveReplacement?.(snapshot.txHash)
    if (!replacement) throw new Error("base_intake_v2_receipt_unavailable")
    receipt = await input.client.getTransactionReceipt({ hash: replacement })
  }
  const currentBlockNumber = await input.client.getBlockNumber()
  let eventMatched = false
  let observedLogIndex
  let observedReceiptReference
  let platformObserved = BigInt(0)
  let epochObserved = BigInt(0)
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === snapshot.contractAddress.toLowerCase() && Number(log.logIndex) === snapshot.logIndex) {
      try {
        const decoded = decodeEventLog({ abi: [receiptEvent], data: log.data, topics: log.topics })
        const a = decoded.args
        observedLogIndex = Number(log.logIndex)
        observedReceiptReference = a.receiptReference
        eventMatched = decoded.eventName === "BaseReceipt" && a.receiptReference.toLowerCase() === snapshot.receiptReference.toLowerCase() && a.projectId === snapshot.projectId &&
          a.accountingPeriodId === snapshot.accountingPeriodId && a.token.toLowerCase() === snapshot.tokenAddress.toLowerCase() &&
          a.sender.toLowerCase() === snapshot.senderAddress.toLowerCase() && a.grossAmount === snapshot.grossAmount &&
          a.projectFeeBps === snapshot.feeBps && a.projectFeeVersion === snapshot.feeVersion &&
          a.feeAmount === snapshot.platformFeeAmount && a.netEpochAmount === snapshot.netEpochAmount &&
          a.platformTreasury.toLowerCase() === snapshot.platformTreasuryAddress.toLowerCase() && a.epochTreasury.toLowerCase() === snapshot.epochTreasuryAddress.toLowerCase()
      } catch { /* unrelated log */ }
    }
    if (log.address.toLowerCase() === snapshot.tokenAddress.toLowerCase()) {
      try {
        const a = decodeEventLog({ abi: [transferEvent], data: log.data, topics: log.topics }).args
        if (a.from.toLowerCase() === snapshot.senderAddress.toLowerCase() && a.to.toLowerCase() === snapshot.platformTreasuryAddress.toLowerCase()) platformObserved += a.value
        if (a.from.toLowerCase() === snapshot.senderAddress.toLowerCase() && a.to.toLowerCase() === snapshot.epochTreasuryAddress.toLowerCase()) epochObserved += a.value
      } catch { /* unrelated log */ }
    }
  }
  if (receipt.status !== "success") throw new Error("base_intake_v2_receipt_reverted")
  const replacementTxHash = receipt.transactionHash.toLowerCase() === snapshot.txHash.toLowerCase() ? undefined : receipt.transactionHash
  const evidence = `${receipt.transactionHash}:${receipt.blockHash}:${receipt.blockNumber}:${currentBlockNumber}:${observedLogIndex ?? "none"}:${observedReceiptReference ?? "none"}:${platformObserved}:${epochObserved}`
  const evidenceHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(evidence)))).map((v) => v.toString(16).padStart(2,"0")).join("")
  return { receiptId: snapshot.id, currentBlockNumber: Number(currentBlockNumber), observedReceiptBlockNumber: Number(receipt.blockNumber), observedBlockHash: receipt.blockHash,
    observedTxHash: receipt.transactionHash, ...(replacementTxHash ? { replacementTxHash } : {}),
    platformObservedNativeAmount: platformObserved.toString(), epochObservedNativeAmount: epochObserved.toString(),
    evidenceHash, observedAt: (input.now ?? new Date()).toISOString(), observationSource: "trusted_viem_v1",
    receiptEventMatched: eventMatched, observedLogIndex: observedLogIndex ?? null,
    observedReceiptReference: observedReceiptReference ?? null }
}
