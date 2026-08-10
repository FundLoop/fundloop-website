import { describe,expect,it,vi } from "vitest"
import { executeBaseSafePayoutOperator } from "@/lib/base-payout/base-safe-payout-command"

const requestHash=`0x${"a".repeat(64)}` as const
const txHash=`0x${"b".repeat(64)}` as const
const blockHash=`0x${"c".repeat(64)}` as const
const tokenAddress="0x00000000000000000000000000000000000000a1" as const
const recipientAddress="0x0000000000000000000000000000000000000001" as const
const feeRecipientAddress="0x0000000000000000000000000000000000000010" as const
const moduleAddress="0x0000000000000000000000000000000000000020" as const
const epochKey=`0x${"d".repeat(64)}` as const

function chainFactory(){return {requestHash:vi.fn(async()=>requestHash),execute:vi.fn(async()=>txHash),observe:vi.fn(async()=>({status:"finalized" as const,
  txHash,blockNumber:BigInt(10),blockHash,currentBlockNumber:BigInt(20),confirmationCount:10,l1BatchFinalized:true,receiptSuccess:true,
  observedTokenAddress:tokenAddress,observedRecipientAddress:recipientAddress,observedNativeAtomicAmount:"10000000",observedRequestHash:requestHash,
  observedFeeRecipientAddress:feeRecipientAddress,observedUserFeeNativeAmount:"1000000",
  observedAt:"2026-08-10T01:00:00.000Z"}))}}

describe("base safe payout command",()=>{
  it("derives the request hash and server expiry before DB authorization",async()=>{
    const rpc=vi.fn().mockResolvedValueOnce({data:{deploymentId:2,chainId:31337,moduleAddress,tokenAddress,recipientAddress,feeRecipientAddress,nativeAtomicAmount:"10000000",
      userFeeNativeAmount:"1000000",epochKey,moduleNonce:"1",payoutIntentId:7},error:null}).mockResolvedValueOnce({data:{commandId:9,status:"authorized",noValueTransferred:true},error:null})
    const result=await executeBaseSafePayoutOperator({rpc} as never,"actor-1",{action:"authorize",payoutIntentId:7,deploymentId:2,gasBudgetNative:"1000"},
      {deploymentEnvironment:"local",rpcUrl:"http://127.0.0.1:8545",now:()=>new Date("2026-08-10T00:00:00Z"),chainFactory})
    expect(result).toMatchObject({ok:true,data:{status:"authorized"}})
    expect(rpc).toHaveBeenLastCalledWith("authorize_base_safe_payout",expect.objectContaining({p_command:expect.objectContaining({requestHash,
      expiresAt:"2026-08-10T00:15:00.000Z",gasBudgetNative:"1000"})}))
  })

  it("executes only the persisted command with the limited signer boundary",async()=>{
    const maybeSingle=vi.fn(async()=>({data:{id:9,token_address:tokenAddress,recipient_address:recipientAddress,fee_recipient_address:feeRecipientAddress,native_atomic_amount:"10000000",user_fee_native_amount:"1000000",
      epoch_key:epochKey,module_nonce:"1",expires_at:"2026-08-10T00:15:00Z",base_safe_payout_deployments:{chain_id:31337,module_address:moduleAddress}},error:null}))
    const client={from:vi.fn(()=>({select(){return this},eq(){return this},maybeSingle}))}
    expect(await executeBaseSafePayoutOperator(client as never,"actor-1",{action:"execute",commandId:9},
      {deploymentEnvironment:"local",rpcUrl:"local",privateKey:`0x${"1".repeat(64)}`,chainFactory})).toEqual({ok:true,data:{commandId:9,txHash,status:"submitted"}})
  })

  it("records only trusted receipt observation and finalized evidence",async()=>{
    const maybeSingle=vi.fn(async()=>({data:{id:9,token_address:tokenAddress,recipient_address:recipientAddress,fee_recipient_address:feeRecipientAddress,native_atomic_amount:"10000000",user_fee_native_amount:"1000000",
      epoch_key:epochKey,module_nonce:"1",expires_at:"2026-08-10T00:15:00Z",base_safe_payout_deployments:{chain_id:31337,module_address:moduleAddress}},error:null}))
    const rpc=vi.fn(async()=>({data:{commandId:9,status:"reconciled",paid:true,noUnmatchedPaidState:true},error:null}))
    const client={from:vi.fn(()=>({select(){return this},eq(){return this},maybeSingle})),rpc}
    const result=await executeBaseSafePayoutOperator(client as never,"actor-1",{action:"observe",commandId:9,txHash},
      {deploymentEnvironment:"local",rpcUrl:"local",chainFactory})
    expect(result).toMatchObject({ok:true,data:{status:"reconciled",paid:true}})
    expect(rpc).toHaveBeenCalledWith("reconcile_base_safe_payout",expect.objectContaining({p_command:expect.objectContaining({observationSource:"trusted_viem_v1",
      l1BatchFinalized:true,receiptSuccess:true,observedRequestHash:requestHash})}))
  })

  it("fails production closed before chain or database access",async()=>{
    expect(await executeBaseSafePayoutOperator({} as never,"actor-1",{action:"execute",commandId:9},
      {deploymentEnvironment:"production",rpcUrl:"local",chainFactory})).toMatchObject({ok:false,error:{code:"base_payout_runtime_disabled"}})
  })
})
