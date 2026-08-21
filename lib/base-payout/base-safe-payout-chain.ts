import { createPublicClient, createWalletClient, http, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { fundLoopSafePayoutModuleAbi as moduleAbi,observeBaseSafePayoutReceipt } from "../../contracts/lib/base-safe-payout-observer.js"

export type BasePayoutChainRequest = { moduleAddress: Hex; tokenAddress: Hex; recipientAddress: Hex; nativeAtomicAmount: bigint;feeRecipientAddress:Hex;userFeeNativeAmount:bigint;gasBudgetNative:bigint; epochKey: Hex; expiresAt: bigint; moduleNonce: bigint }
export type BasePayoutChainObservation = { status:"confirming"|"finalized"|"failed"|"reorged";txHash:Hex;blockNumber:bigint;blockHash:Hex;currentBlockNumber:bigint;
  confirmationCount:number;l1BatchFinalized:boolean;receiptSuccess:boolean;observedTokenAddress:Hex;observedRecipientAddress:Hex;
  observedNativeAtomicAmount:string;observedFeeRecipientAddress:Hex;observedUserFeeNativeAmount:string;observedGasBudgetNative:string;observedRequestHash:Hex;observedAt:string }

export function createBaseSafePayoutChain(input:{rpcUrl:string;chainId:number;privateKey?:Hex}) {
  const chain={id:input.chainId,name:`FundLoop Base ${input.chainId}`,nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:[input.rpcUrl]}}} as const
  const publicClient=createPublicClient({chain,transport:http(input.rpcUrl)})
  return {
    async requestHash(request:BasePayoutChainRequest) {
      return publicClient.readContract({address:request.moduleAddress,abi:moduleAbi,functionName:"requestHash",
        args:[request.tokenAddress,request.recipientAddress,request.nativeAtomicAmount,request.feeRecipientAddress,request.userFeeNativeAmount,request.gasBudgetNative,request.epochKey,request.expiresAt,request.moduleNonce]}) as Promise<Hex>
    },
    async authorization(request:BasePayoutChainRequest,requestHash:Hex) {
      const [authorized,blockNumber]=await Promise.all([
        publicClient.readContract({address:request.moduleAddress,abi:moduleAbi,functionName:"authorizedRequests",args:[requestHash]}),
        publicClient.getBlockNumber(),
      ])
      return {authorized:Boolean(authorized),blockNumber}
    },
    async execute(request:BasePayoutChainRequest) {
      if(!input.privateKey) throw new Error("base_payout_limited_signer_unavailable")
      const account=privateKeyToAccount(input.privateKey)
      const wallet=createWalletClient({account,chain,transport:http(input.rpcUrl)})
      return wallet.writeContract({address:request.moduleAddress,abi:moduleAbi,functionName:"executePayout",
        args:[request.tokenAddress,request.recipientAddress,request.nativeAtomicAmount,request.feeRecipientAddress,request.userFeeNativeAmount,request.gasBudgetNative,request.epochKey,request.expiresAt,request.moduleNonce]})
    },
    async observe(request:BasePayoutChainRequest,txHash:Hex,previousObservation?:BasePayoutChainObservation):Promise<BasePayoutChainObservation> {
      return await observeBaseSafePayoutReceipt({client:publicClient,moduleAddress:request.moduleAddress,txHash,chainId:input.chainId,previousObservation}) as BasePayoutChainObservation
    },
  }
}
