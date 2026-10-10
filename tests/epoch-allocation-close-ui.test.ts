import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { isEpochClosePreviewEnabled } from "@/lib/monthly-cycles/epoch-close-visibility"

const operatorPage = readFileSync("app/[locale]/(app)/admin/cycles/[cycleKey]/prep/page.tsx", "utf8")
const operatorAction = readFileSync("components/admin/epoch-allocation-close-actions.tsx", "utf8")
const userPage = readFileSync("app/[locale]/(app)/workspace/earnings/page.tsx", "utf8")
const founderPage = readFileSync("app/[locale]/(app)/founder/projects/[slug]/reporting/page.tsx", "utf8")
const publicPage = readFileSync("app/[locale]/(public)/projects/[slug]/page.tsx", "utf8")
const readModel = readFileSync("lib/monthly-cycles/epoch-close-review.ts", "utf8")
const publicApiReadModel = readFileSync("lib/api/v1/public-projects.ts", "utf8")

describe("epoch close role surfaces", () => {
  it("shows separate exact root review and payout-readying approval", () => {
    expect(operatorPage).toContain("Approved epoch close")
    expect(operatorAction).toContain("Reproduce result and prepare close root")
    expect(operatorAction).toContain("Approve exact root and enter payout readying")
    expect(operatorAction).toContain("epoch-close-root-review")
    expect(operatorAction).toContain("initialRootReview")
    expect(operatorPage).toContain('epochClose?.status === "root_review_required"')
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
    // The public cycle views hold provisional, pre-payout packages only, so every surface that can
    // publish them shares one gate.
    expect(isEpochClosePreviewEnabled({})).toBe(false)
    expect(isEpochClosePreviewEnabled({ FUNDLOOP_DEPLOYMENT_ENV: "production" })).toBe(false)
    expect(isEpochClosePreviewEnabled({ FUNDLOOP_DEPLOYMENT_ENV: "dev" })).toBe(true)
    expect(readModel).toContain("if (!enabled()) return null")
    expect(readModel).toContain("isEpochClosePreviewEnabled")
    expect(publicApiReadModel).toContain("if (!isEpochClosePreviewEnabled()) return { ok: true as const, cycle: null }")
  })
})
