import type { Abi, Hex, PublicClient } from "viem"

export const fundLoopSafePayoutModuleAbi: Abi
export function observeBaseSafePayoutReceipt(input:{client:PublicClient;moduleAddress:Hex;txHash:Hex;chainId:number}):Promise<{
  status:"confirming"|"finalized"|"failed";txHash:Hex;blockNumber:bigint;blockHash:Hex;currentBlockNumber:bigint;confirmationCount:number;
  l1BatchFinalized:boolean;receiptSuccess:boolean;observedTokenAddress:Hex;observedRecipientAddress:Hex;observedNativeAtomicAmount:string;
  observedFeeRecipientAddress:Hex;observedUserFeeNativeAmount:string;observedRequestHash:Hex;observedAt:string
}>
