import { readFileSync } from "node:fs"
import { describe,expect,it } from "vitest"

const page=readFileSync("app/[locale]/(app)/admin/cycles/[cycleKey]/prep/page.tsx","utf8")
const loader=readFileSync("lib/monthly-cycles/monthly-cycle-prep.ts","utf8")

describe("epoch financial prep operator review",()=>{
  it("labels the source ledger as provisional, production-disabled, and non-payable",()=>{
    expect(page).toContain("Funded allocation inputs")
    expect(page).toContain("Valuation, fees, and carryover")
    expect(page).toContain("Production disabled")
    expect(page).toContain("They are not claims, payables, revenue, provider instructions, or value movement.")
  })
  it("shows exact source, custody, native, FX, and distributable dimensions",()=>{
    expect(page).toContain("source.source_lot_key")
    expect(page).toContain("source.custody_key")
    expect(page).toContain("source.native_atomic_amount")
    expect(page).toContain("source.rate_usd_per_unit")
    expect(page).toContain("source.distributable_exact_usd")
  })
  it("fails the read surface closed in production",()=>{
    expect(loader).toContain('?? "production"')
    expect(loader).toContain('==="production"')
    expect(loader).toContain("return {summary:null,sources:[],productionDisabled:true}")
  })
})
