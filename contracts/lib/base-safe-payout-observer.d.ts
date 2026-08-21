import type { Abi, Hex, PublicClient } from "viem"

export const fundLoopSafePayoutModuleAbi: Abi
export function observeBaseSafePayoutReceipt(input:{client:PublicClient;moduleAddress:Hex;txHash:Hex;chainId:number;previousObservation?:Record<string,unknown>}):Promise<{
  status:"confirming"|"finalized"|"failed"|"reorged";txHash:Hex;blockNumber:bigint;blockHash:Hex;currentBlockNumber:bigint;confirmationCount:number;
  l1BatchFinalized:boolean;receiptSuccess:boolean;observedTokenAddress:Hex;observedRecipientAddress:Hex;observedNativeAtomicAmount:string;
  observedFeeRecipientAddress:Hex;observedUserFeeNativeAmount:string;observedGasBudgetNative:string;observedRequestHash:Hex;observedAt:string
}>
