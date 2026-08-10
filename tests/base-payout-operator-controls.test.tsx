import { fireEvent,render,screen } from "@testing-library/react"
import { describe,expect,it,vi } from "vitest"
import { BasePayoutOperatorControls } from "@/components/admin/base-payout-operator-controls"

const {invoke}=vi.hoisted(()=>({invoke:vi.fn(async()=>({ok:true,data:{status:"authorized"}}))}))
vi.mock("@/lib/edge-functions/base-safe-payout-operator",()=>({invokeBaseSafePayoutOperator:invoke}))

describe("BasePayoutOperatorControls",()=>{
  it("shows fail-closed production copy",()=>{
    render(<BasePayoutOperatorControls enabled={false} deployments={[]} commands={[]} intents={[]}/>)
    expect(screen.getByText("Base payout review unavailable")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })
  it("shows independent limits and prepares an exact intent",async()=>{
    render(<BasePayoutOperatorControls enabled deployments={[{id:2,chain_id:31337,safe_role:"epoch",safe_address:"0xsafe",module_address:"0xmodule",
      is_paused:false,is_active:true,max_per_transaction_native:"20000000",max_rolling_24h_native:"500000000",max_per_epoch_native:"5000000000",
      base_paymaster_budgets:{remaining_native:"1000000",max_per_request_native:"100000",is_paused:false}}]} commands={[]}
      intents={[{id:7,rail:"evm",status:"draft",amount_usd:10,payout_route_id:3}]}/>)
    expect(screen.getByText("$20 transaction · $500 rolling · $5,000 epoch")).toBeTruthy()
    fireEvent.click(screen.getByRole("button",{name:"Prepare exact request"}))
    expect(invoke).toHaveBeenCalledWith({action:"authorize",payoutIntentId:7,deploymentId:2,gasBudgetNative:"1000"})
  })
  it("requires a verified Safe authorization before limited-signer execution",()=>{
    render(<BasePayoutOperatorControls enabled deployments={[]} intents={[]} commands={[{id:9,payout_intent_id:7,status:"authorized",
      request_hash:`0x${"a".repeat(64)}`,native_atomic_amount:"1000",user_fee_native_amount:"25",token_address:"0xtoken",
      recipient_address:"0xrecipient",fee_recipient_address:"0xfee",authorized_at:"2026-08-10T00:00:00Z",chain_authorized_at:null}]}/>)
    expect((screen.getByRole("button",{name:"Execute limited signer"}) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole("button",{name:"Verify Safe authorization"}))
    expect(invoke).toHaveBeenCalledWith({action:"confirm_authorization",commandId:9})
  })
})
