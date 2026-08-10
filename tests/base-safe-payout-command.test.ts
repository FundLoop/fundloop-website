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

function chainFactory(){return {requestHash:vi.fn(async()=>requestHash),authorization:vi.fn(async()=>({authorized:true,blockNumber:BigInt(12)})),execute:vi.fn(async()=>txHash),observe:vi.fn(async()=>({status:"finalized" as const,
  txHash,blockNumber:BigInt(10),blockHash,currentBlockNumber:BigInt(20),confirmationCount:10,l1BatchFinalized:true,receiptSuccess:true,
  observedTokenAddress:tokenAddress,observedRecipientAddress:recipientAddress,observedNativeAtomicAmount:"10000000",observedRequestHash:requestHash,
  observedFeeRecipientAddress:feeRecipientAddress,observedUserFeeNativeAmount:"1000000",observedGasBudgetNative:"1000",
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

  it("persists a trusted proof of the exact Safe authorization",async()=>{
    const command={id:9,request_hash:requestHash,token_address:tokenAddress,recipient_address:recipientAddress,fee_recipient_address:feeRecipientAddress,
      native_atomic_amount:"10000000",user_fee_native_amount:"1000000",gas_budget_native:"1000",epoch_key:epochKey,module_nonce:"1",
      expires_at:"2026-08-10T00:15:00Z",base_safe_payout_deployments:{chain_id:31337,module_address:moduleAddress}}
    const rpc=vi.fn(async()=>({data:{commandId:9,status:"safe_authorized",noValueTransferred:true},error:null}))
    const client={from:vi.fn(()=>({select(){return this},eq(){return this},maybeSingle:vi.fn(async()=>({data:command,error:null}))})),rpc}
    const result=await executeBaseSafePayoutOperator(client as never,"actor-1",{action:"confirm_authorization",commandId:9},
      {deploymentEnvironment:"local",rpcUrl:"local",chainFactory})
    expect(result).toMatchObject({ok:true,data:{status:"safe_authorized"}})
    expect(rpc).toHaveBeenCalledWith("confirm_base_safe_payout_authorization",expect.objectContaining({p_command:expect.objectContaining({
      requestHash,blockNumber:"12",authorized:true,observationSource:"trusted_viem_v1"})}))
  })

  it("executes only the persisted command with the limited signer boundary",async()=>{
    const maybeSingle=vi.fn(async()=>({data:{id:9,token_address:tokenAddress,recipient_address:recipientAddress,fee_recipient_address:feeRecipientAddress,native_atomic_amount:"10000000",user_fee_native_amount:"1000000",gas_budget_native:"1000",
      epoch_key:epochKey,module_nonce:"1",expires_at:"2026-08-10T00:15:00Z",request_hash:requestHash,chain_authorized_at:"2026-08-10T00:05:00Z",base_safe_payout_deployments:{chain_id:31337,module_address:moduleAddress}},error:null}))
    const client={from:vi.fn(()=>({select(){return this},eq(){return this},maybeSingle}))}
    expect(await executeBaseSafePayoutOperator(client as never,"actor-1",{action:"execute",commandId:9},
      {deploymentEnvironment:"local",rpcUrl:"local",privateKey:`0x${"1".repeat(64)}`,chainFactory})).toEqual({ok:true,data:{commandId:9,txHash,status:"submitted"}})
  })

  it("refuses limited-signer execution until the Safe proof is persisted",async()=>{
    const maybeSingle=vi.fn(async()=>({data:{id:9,token_address:tokenAddress,recipient_address:recipientAddress,fee_recipient_address:feeRecipientAddress,native_atomic_amount:"10000000",user_fee_native_amount:"1000000",gas_budget_native:"1000",
      epoch_key:epochKey,module_nonce:"1",expires_at:"2026-08-10T00:15:00Z",request_hash:requestHash,chain_authorized_at:null,base_safe_payout_deployments:{chain_id:31337,module_address:moduleAddress}},error:null}))
    const client={from:vi.fn(()=>({select(){return this},eq(){return this},maybeSingle}))}
    expect(await executeBaseSafePayoutOperator(client as never,"actor-1",{action:"execute",commandId:9},
      {deploymentEnvironment:"local",rpcUrl:"local",privateKey:`0x${"1".repeat(64)}`,chainFactory})).toMatchObject({ok:false,error:{code:"base_payout_safe_authorization_required"}})
  })

  it("records only trusted receipt observation and finalized evidence",async()=>{
    const maybeSingle=vi.fn(async()=>({data:{id:9,token_address:tokenAddress,recipient_address:recipientAddress,fee_recipient_address:feeRecipientAddress,native_atomic_amount:"10000000",user_fee_native_amount:"1000000",gas_budget_native:"1000",
      epoch_key:epochKey,module_nonce:"1",expires_at:"2026-08-10T00:15:00Z",base_safe_payout_deployments:{chain_id:31337,module_address:moduleAddress}},error:null}))
    const rpc=vi.fn(async()=>({data:{commandId:9,status:"reconciled",paid:true,noUnmatchedPaidState:true},error:null}))
    const client={from:vi.fn((table:string)=>table==="base_payout_execution_commands"?({select(){return this},eq(){return this},maybeSingle}):
      ({select(){return this},eq(){return this},order(){return this},limit(){return this},maybeSingle:vi.fn(async()=>({data:null,error:null}))})),rpc}
    const result=await executeBaseSafePayoutOperator(client as never,"actor-1",{action:"observe",commandId:9,txHash},
      {deploymentEnvironment:"local",rpcUrl:"local",chainFactory})
    expect(result).toMatchObject({ok:true,data:{status:"reconciled",paid:true}})
    expect(rpc).toHaveBeenCalledWith("reconcile_base_safe_payout",expect.objectContaining({p_command:expect.objectContaining({observationSource:"trusted_viem_v1",
      l1BatchFinalized:true,receiptSuccess:true,observedRequestHash:requestHash})}))
  })

  it("preserves the original transaction hash when recording a replacement",async()=>{
    const original=`0x${"1".repeat(64)}` as const;const replacement=`0x${"2".repeat(64)}` as const
    const command={id:9,token_address:tokenAddress,recipient_address:recipientAddress,fee_recipient_address:feeRecipientAddress,
      native_atomic_amount:"10000000",user_fee_native_amount:"1000000",gas_budget_native:"1000",epoch_key:epochKey,module_nonce:"1",
      expires_at:"2026-08-10T00:15:00Z",base_safe_payout_deployments:{chain_id:31337,module_address:moduleAddress}}
    const rpc=vi.fn(async()=>({data:{commandId:9,status:"replaced",paid:false},error:null}))
    const client={from:vi.fn((table:string)=>table==="base_payout_execution_commands"?({select(){return this},eq(){return this},maybeSingle:vi.fn(async()=>({data:command,error:null}))}):
      ({select(){return this},eq(){return this},order(){return this},limit(){return this},maybeSingle:vi.fn(async()=>({data:null,error:null}))})),rpc}
    const replacementFactory=()=>({...chainFactory(),observe:vi.fn(async()=>({...await chainFactory().observe(),txHash:replacement}))})
    expect(await executeBaseSafePayoutOperator(client as never,"actor-1",{action:"observe",commandId:9,txHash:original,replacementTxHash:replacement},
      {deploymentEnvironment:"local",rpcUrl:"local",chainFactory:replacementFactory})).toMatchObject({ok:true,data:{status:"replaced"}})
    expect(rpc).toHaveBeenCalledWith("reconcile_base_safe_payout",expect.objectContaining({p_command:expect.objectContaining({status:"replaced",txHash:original,replacementTxHash:replacement})}))
  })

  it("persists a typed reorg observation from prior receipt evidence",async()=>{
    const command={id:9,token_address:tokenAddress,recipient_address:recipientAddress,fee_recipient_address:feeRecipientAddress,
      native_atomic_amount:"10000000",user_fee_native_amount:"1000000",gas_budget_native:"1000",epoch_key:epochKey,module_nonce:"1",
      expires_at:"2026-08-10T00:15:00Z",base_safe_payout_deployments:{chain_id:31337,module_address:moduleAddress}}
    const prior={status:"confirming",tx_hash:txHash,block_number:10,block_hash:blockHash,current_block_number:11,confirmation_count:1,
      l1_batch_finalized:false,receipt_success:true,observed_token_address:tokenAddress,observed_recipient_address:recipientAddress,
      observed_native_atomic_amount:"10000000",observed_fee_recipient_address:feeRecipientAddress,observed_user_fee_native_amount:"1000000",
      observed_request_hash:requestHash,observed_at:"2026-08-10T01:00:00Z"}
    const rpc=vi.fn(async()=>({data:{commandId:9,status:"reorged",paid:false},error:null}))
    const client={from:vi.fn((table:string)=>table==="base_payout_execution_commands"?({select(){return this},eq(){return this},maybeSingle:vi.fn(async()=>({data:command,error:null}))}):
      ({select(){return this},eq(){return this},order(){return this},limit(){return this},maybeSingle:vi.fn(async()=>({data:prior,error:null}))})),rpc}
    const reorgFactory=()=>({...chainFactory(),observe:vi.fn(async(_request,_hash,previous)=>({...previous!,status:"reorged" as const,receiptSuccess:false,l1BatchFinalized:false}))})
    expect(await executeBaseSafePayoutOperator(client as never,"actor-1",{action:"observe",commandId:9,txHash},
      {deploymentEnvironment:"local",rpcUrl:"local",chainFactory:reorgFactory})).toMatchObject({ok:true,data:{status:"reorged",paid:false}})
    expect(rpc).toHaveBeenCalledWith("reconcile_base_safe_payout",expect.objectContaining({p_command:expect.objectContaining({status:"reorged",txHash,replacementTxHash:""})}))
  })

  it("fails production closed before chain or database access",async()=>{
    expect(await executeBaseSafePayoutOperator({} as never,"actor-1",{action:"execute",commandId:9},
      {deploymentEnvironment:"production",rpcUrl:"local",chainFactory})).toMatchObject({ok:false,error:{code:"base_payout_runtime_disabled"}})
  })
})
