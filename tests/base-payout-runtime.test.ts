import { describe,expect,it } from "vitest"
import { isBasePayoutReviewEnabled } from "@/lib/base-payout/base-payout-operator-overview"

describe("base payout review runtime",()=>{
  it("is exact-allowlist and production fail closed",()=>{
    expect(isBasePayoutReviewEnabled({FUNDLOOP_DEPLOYMENT_ENV:"local",NEXT_PUBLIC_BASE_PAYOUT_REVIEW_ENABLED:"true"} as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isBasePayoutReviewEnabled({FUNDLOOP_DEPLOYMENT_ENV:"production",NEXT_PUBLIC_BASE_PAYOUT_REVIEW_ENABLED:"true"} as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isBasePayoutReviewEnabled({FUNDLOOP_DEPLOYMENT_ENV:"staging",NEXT_PUBLIC_BASE_PAYOUT_REVIEW_ENABLED:"true"} as unknown as NodeJS.ProcessEnv)).toBe(false)
  })
})
