import { describe,expect,it } from "vitest"
import { validateBaseSafePayoutOperatorInput } from "@/lib/edge-functions/base-safe-payout-contract"

describe("base safe payout operator contract",()=>{
  it("accepts only exact authorize, execute, and observe inputs",()=>{
    expect(validateBaseSafePayoutOperatorInput({action:"authorize",payoutIntentId:1,deploymentId:2,gasBudgetNative:"1000"}).ok).toBe(true)
    expect(validateBaseSafePayoutOperatorInput({action:"execute",commandId:3}).ok).toBe(true)
    expect(validateBaseSafePayoutOperatorInput({action:"observe",commandId:3,txHash:`0x${"a".repeat(64)}`}).ok).toBe(true)
    expect(validateBaseSafePayoutOperatorInput({action:"authorize",payoutIntentId:1,deploymentId:2,gasBudgetNative:"-1"}).ok).toBe(false)
    expect(validateBaseSafePayoutOperatorInput({action:"execute",commandId:3,actorUserId:"forged"}).ok).toBe(false)
    expect(validateBaseSafePayoutOperatorInput({action:"observe",commandId:3,txHash:"0xdead"}).ok).toBe(false)
  })
})
