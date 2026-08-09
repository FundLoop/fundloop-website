import { describe,expect,it } from "vitest"
import { isEpochFinancialPrepEnabled,pacificCycleBoundary,stablecoinPegStatus } from "@/lib/accounting/epoch-financial-prep"
import { validateEpochFinancialPrepInput } from "@/lib/edge-functions/epoch-financial-prep-contract"

describe("epoch financial prep contract",()=>{
  it("accepts versionless client commands and keeps trusted context server-owned",()=>{
    expect(validateEpochFinancialPrepInput({action:"prepare_sources",packageId:7})).toMatchObject({ok:true})
    expect(validateEpochFinancialPrepInput({action:"harvest",sourceLotId:4,targetCycleKey:"2026-12"})).toMatchObject({ok:true})
    expect(validateEpochFinancialPrepInput({action:"prepare_sources",packageId:7,deploymentEnvironment:"production"})).toMatchObject({ok:false})
    expect(validateEpochFinancialPrepInput({action:"harvest",sourceLotId:4,targetCycleKey:"2026-12",actorUserId:"crafted"})).toMatchObject({ok:false})
  })
  it("validates primary and manual-after-exhaustion FX shapes",()=>{
    const base={action:"post_fx",cycleKey:"2026-08",assetKey:"local_review_usd",preanalysis:{fresh:true},evidenceHash:"a".repeat(64)}
    expect(validateEpochFinancialPrepInput({...base,method:"primary",observationId:1})).toMatchObject({ok:true})
    expect(validateEpochFinancialPrepInput({...base,method:"manual_after_exhaustion",manualRateUsdPerUnit:"1.000000000000000000"})).toMatchObject({ok:true})
    expect(validateEpochFinancialPrepInput({...base,method:"manual_after_exhaustion",observationId:1})).toMatchObject({ok:false})
  })
  it("fails production closed and models Pacific DST plus stablecoin pause",()=>{
    expect(isEpochFinancialPrepEnabled({FUNDLOOP_DEPLOYMENT_ENV:"local"})).toBe(true)
    expect(isEpochFinancialPrepEnabled({FUNDLOOP_DEPLOYMENT_ENV:"production"})).toBe(false)
    expect(isEpochFinancialPrepEnabled({})).toBe(false)
    expect(pacificCycleBoundary(2026,1)).toContain("-08:00")
    expect(pacificCycleBoundary(2026,8)).toContain("-07:00")
    expect(stablecoinPegStatus("1.003")).toBe("within_band")
    expect(stablecoinPegStatus("1.003000000000000001")).toBe("outside_band")
  })
})
