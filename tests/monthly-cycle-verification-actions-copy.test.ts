import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync("components/admin/monthly-cycle-verification-actions.tsx", "utf8")
const pageSource = readFileSync("app/[locale]/(app)/admin/cycles/[cycleKey]/verification/page.tsx", "utf8")

describe("monthly-cycle verification approval copy", () => {
  it("frames approval as bookkeeping credit readiness, not payout execution", () => {
    expect(source).toContain("Approve for bookkeeping credits")
    expect(source).toContain("No payouts have been executed")
    expect(source).toContain("It does not transfer funds or mark users as paid")
    expect(source).not.toContain("Approve for distribution")
    expect(pageSource).toContain("Approval does not execute payouts")
    expect(pageSource).toContain("Approval prepares bookkeeping credits")
  })
})
