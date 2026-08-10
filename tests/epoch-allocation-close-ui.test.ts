import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const operatorPage = readFileSync("app/[locale]/(app)/admin/cycles/[cycleKey]/prep/page.tsx", "utf8")
const operatorAction = readFileSync("components/admin/epoch-allocation-close-actions.tsx", "utf8")
const userPage = readFileSync("app/[locale]/(app)/workspace/earnings/page.tsx", "utf8")
const founderPage = readFileSync("app/[locale]/(app)/founder/projects/[slug]/reporting/page.tsx", "utf8")
const publicPage = readFileSync("app/[locale]/(public)/projects/[slug]/page.tsx", "utf8")
const readModel = readFileSync("lib/monthly-cycles/epoch-close-review.ts", "utf8")

describe("epoch close role surfaces", () => {
  it("shows the exact operator approval and payout-readying boundary", () => {
    expect(operatorPage).toContain("Approved epoch close")
    expect(operatorAction).toContain("Approve exact result and publish close package")
    expect(operatorPage).toContain("Awards remain non-payable and not user-owned")
    expect(operatorAction).toContain("invokeEpochAllocationCloseBrowser")
    expect(operatorAction).not.toContain(".from(")
  })

  it("separates user, founder, and public privacy copy", () => {
    expect(userPage).toContain("Your approved allocation is conditional and not payable")
    expect(founderPage).toContain("contains no user identifiers, Cubid scores, or cross-project membership")
    expect(publicPage).toContain("User identities, Cubid scores, individual awards, and cross-project membership remain private")
    expect(publicPage).toContain("Privacy threshold not met")
  })

  it("returns no close data in production", () => {
    expect(readModel).toContain('FUNDLOOP_DEPLOYMENT_ENV ?? "production"')
    expect(readModel).toContain("if (!enabled()) return null")
  })
})
