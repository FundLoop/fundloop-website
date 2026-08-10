import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const page = readFileSync("app/[locale]/(app)/admin/cycles/[cycleKey]/prep/page.tsx", "utf8")
const actions = readFileSync("components/admin/epoch-funded-allocation-actions.tsx", "utf8")
const readModel = readFileSync("lib/monthly-cycles/monthly-cycle-prep.ts", "utf8")

describe("epoch funded allocation operator review", () => {
  it("shows the score discount, redistribution, cap, provenance, and provisional boundary", () => {
    expect(page).toContain("Settled Cubid redistribution")
    expect(page).toContain("Score shortfalls and overlap-cap overflow")
    expect(page).toContain("preserved 3× cap")
    expect(page).toContain("no payable, payout, provider call, or value movement")
    expect(page).toContain("Manifest")
    expect(page).toContain("Result")
  })

  it("exposes explicit lock and calculate controls only through the typed Edge invoker", () => {
    expect(actions).toContain("invokeEpochFundedAllocationBrowser")
    expect(actions).toContain("Lock funded inputs")
    expect(actions).toContain("Calculate provisional redistribution")
    expect(actions).not.toContain(".from(")
  })

  it("returns no allocation data or controls in production", () => {
    expect(readModel).toContain('FUNDLOOP_DEPLOYMENT_ENV ?? "production"')
    expect(readModel).toContain("return {allocation:null,productionDisabled:true,runtimeAvailable:false}")
    expect(page).toContain("fundedAllocation.runtimeAvailable ? <EpochFundedAllocationActions")
  })
})
