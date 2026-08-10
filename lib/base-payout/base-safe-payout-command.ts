import type { SupabaseClient } from "@supabase/supabase-js"
import type { Hex } from "viem"
import type { Database } from "../../types/supabase.ts"
import { createBaseSafePayoutChain, type BasePayoutChainRequest } from "./base-safe-payout-chain.ts"
import type { BaseSafePayoutOperatorInput } from "../edge-functions/base-safe-payout-contract.ts"

type Result={ok:true;data:Record<string,unknown>}|{ok:false;error:{code:string;message:string}}
type ChainLike={requestHash:(request:BasePayoutChainRequest)=>Promise<Hex>;execute:(request:BasePayoutChainRequest)=>Promise<Hex>;
  observe:(request:BasePayoutChainRequest,txHash:Hex,previous?:import("./base-safe-payout-chain.ts").BasePayoutChainObservation)=>Promise<import("./base-safe-payout-chain.ts").BasePayoutChainObservation>}
type Env={deploymentEnvironment:string;rpcUrl:string;privateKey?:Hex;now?:()=>Date;chainFactory?:(input:{rpcUrl:string;chainId:number;privateKey?:Hex})=>ChainLike}
const code=(message:string)=>message.match(/base_(?:payout|paymaster)_[a-z_]+/)?.[0]??"base_payout_failed"

function chainRequest(value:Record<string,unknown>):BasePayoutChainRequest {
  return {moduleAddress:value.moduleAddress as Hex,tokenAddress:value.tokenAddress as Hex,recipientAddress:value.recipientAddress as Hex,
    nativeAtomicAmount:BigInt(String(value.nativeAtomicAmount)),feeRecipientAddress:value.feeRecipientAddress as Hex,
    userFeeNativeAmount:BigInt(String(value.userFeeNativeAmount)),gasBudgetNative:BigInt(String(value.gasBudgetNative)),epochKey:value.epochKey as Hex,expiresAt:BigInt(String(value.expiresAt)),moduleNonce:BigInt(String(value.moduleNonce))}
}

export async function executeBaseSafePayoutOperator(supabase:SupabaseClient<Database>,actorUserId:string,input:BaseSafePayoutOperatorInput,env:Env):Promise<Result> {
  if(env.deploymentEnvironment==="production") return {ok:false,error:{code:"base_payout_runtime_disabled",message:"Base payouts are unavailable in production."}}
  if(input.action==="authorize") {
    const prepared=await supabase.rpc("get_base_safe_payout_authorization_input",{p_payout_intent_id:input.payoutIntentId,p_deployment_id:input.deploymentId})
    if(prepared.error) return {ok:false,error:{code:code(prepared.error.message),message:prepared.error.message}}
    const value=prepared.data as Record<string,unknown>
    const expiresAt=new Date((env.now?.()??new Date()).getTime()+15*60*1000)
    const request={...value,expiresAt:Math.floor(expiresAt.getTime()/1000).toString(),gasBudgetNative:input.gasBudgetNative}
    const chain=(env.chainFactory??createBaseSafePayoutChain)({rpcUrl:env.rpcUrl,chainId:Number(value.chainId)})
    const requestHash=await chain.requestHash(chainRequest(request))
    const command={contractVersion:"base_safe_payout_authorize.v1",deploymentEnvironment:env.deploymentEnvironment,...request,
      requestHash,expiresAt:expiresAt.toISOString(),gasBudgetNative:input.gasBudgetNative}
    const result=await supabase.rpc("authorize_base_safe_payout",{p_actor_user_id:actorUserId,p_command:command})
    if(result.error) return {ok:false,error:{code:code(result.error.message),message:result.error.message}}
    return {ok:true,data:result.data as Record<string,unknown>}
  }
  const commandQuery=await supabase.from("base_payout_execution_commands").select("*,base_safe_payout_deployments!inner(chain_id,module_address)").eq("id",input.commandId).maybeSingle()
  if(commandQuery.error||!commandQuery.data) return {ok:false,error:{code:"base_payout_command_not_found",message:commandQuery.error?.message??"Base payout command not found."}}
  const row=commandQuery.data
  const deployment=Array.isArray(row.base_safe_payout_deployments)?row.base_safe_payout_deployments[0]:row.base_safe_payout_deployments
  const request=chainRequest({moduleAddress:deployment.module_address,tokenAddress:row.token_address,recipientAddress:row.recipient_address,
    nativeAtomicAmount:row.native_atomic_amount,feeRecipientAddress:row.fee_recipient_address,userFeeNativeAmount:row.user_fee_native_amount,
    gasBudgetNative:row.gas_budget_native,epochKey:row.epoch_key,expiresAt:Math.floor(new Date(row.expires_at).getTime()/1000),moduleNonce:row.module_nonce})
  const chain=(env.chainFactory??createBaseSafePayoutChain)({rpcUrl:env.rpcUrl,chainId:Number(deployment.chain_id),privateKey:env.privateKey})
  if(input.action==="execute") {
    try { return {ok:true,data:{commandId:input.commandId,txHash:await chain.execute(request),status:"submitted"}} }
    catch(error){const message=error instanceof Error?error.message:"Base payout execution failed.";return {ok:false,error:{code:code(message),message}}}
  }
  const observedHash=input.replacementTxHash??input.txHash
  try {
    const previousQuery=await supabase.from("base_payout_execution_observations").select("status,tx_hash,block_number,block_hash,current_block_number,confirmation_count,l1_batch_finalized,receipt_success,observed_token_address,observed_recipient_address,observed_native_atomic_amount,observed_fee_recipient_address,observed_user_fee_native_amount,observed_request_hash,observed_at")
      .eq("command_id",input.commandId).order("observed_at",{ascending:false}).limit(1).maybeSingle()
    const previous=previousQuery.data?{status:previousQuery.data.status,txHash:previousQuery.data.tx_hash as Hex,blockNumber:BigInt(previousQuery.data.block_number),
      blockHash:previousQuery.data.block_hash as Hex,currentBlockNumber:BigInt(previousQuery.data.current_block_number),confirmationCount:previousQuery.data.confirmation_count,
      l1BatchFinalized:previousQuery.data.l1_batch_finalized,receiptSuccess:previousQuery.data.receipt_success,observedTokenAddress:previousQuery.data.observed_token_address as Hex,
      observedRecipientAddress:previousQuery.data.observed_recipient_address as Hex,observedNativeAtomicAmount:String(previousQuery.data.observed_native_atomic_amount),
      observedFeeRecipientAddress:previousQuery.data.observed_fee_recipient_address as Hex,observedUserFeeNativeAmount:String(previousQuery.data.observed_user_fee_native_amount),
      observedGasBudgetNative:String(row.gas_budget_native),observedRequestHash:previousQuery.data.observed_request_hash as Hex,observedAt:previousQuery.data.observed_at} as import("./base-safe-payout-chain.ts").BasePayoutChainObservation:undefined
    const observation=await chain.observe(request,observedHash,previous)
    const evidenceBytes=new TextEncoder().encode(JSON.stringify(observation,(_key,value)=>typeof value==="bigint"?value.toString():value))
    const evidenceHash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",evidenceBytes))).map((value)=>value.toString(16).padStart(2,"0")).join("")
    const rpc=await supabase.rpc("reconcile_base_safe_payout",{p_command:{contractVersion:"base_safe_payout_observation.v1",deploymentEnvironment:env.deploymentEnvironment,
      commandId:input.commandId,status:input.replacementTxHash?"replaced":observation.status,txHash:input.txHash,replacementTxHash:input.replacementTxHash??"",
      blockNumber:Number(observation.blockNumber),blockHash:observation.blockHash,currentBlockNumber:Number(observation.currentBlockNumber),
      confirmationCount:observation.confirmationCount,l1BatchFinalized:observation.l1BatchFinalized,receiptSuccess:observation.receiptSuccess,
      observedTokenAddress:observation.observedTokenAddress,observedRecipientAddress:observation.observedRecipientAddress,
      observedNativeAtomicAmount:observation.observedNativeAtomicAmount,observedFeeRecipientAddress:observation.observedFeeRecipientAddress,
      observedUserFeeNativeAmount:observation.observedUserFeeNativeAmount,observedGasBudgetNative:observation.observedGasBudgetNative,
      observedRequestHash:observation.observedRequestHash,
      observationSource:"trusted_viem_v1",evidenceHash,observedAt:observation.observedAt}})
    if(rpc.error)return {ok:false,error:{code:code(rpc.error.message),message:rpc.error.message}}
    return {ok:true,data:rpc.data as Record<string,unknown>}
  } catch(error){const message=error instanceof Error?error.message:"Base payout observation failed.";return {ok:false,error:{code:code(message),message}}}
}
