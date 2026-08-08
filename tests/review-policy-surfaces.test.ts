import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Terms preview surfaces", () => {
  it("labels the public preview and avoids effective acceptance language", () => {
    const route = readFileSync("app/[locale]/(public)/terms/page.tsx", "utf8")
    expect(route).toContain("REVIEW_POLICY_BANNER")
    expect(route).toContain("No live contribution")
    expect(route).not.toContain("you agree to be bound")
  })

  it("gates both simulated money boundaries", () => {
    const founder = readFileSync("app/[locale]/(app)/projects/[slug]/payments/page.tsx", "utf8")
    const earnings = readFileSync("app/[locale]/(app)/workspace/earnings/page.tsx", "utf8")
    expect(founder).toContain('sourceSurface="project_funding_preview"')
    expect(founder).toContain("disabled={!termsPreviewAcknowledged")
    expect(earnings).toContain("termsPreviewRequired")
  })
})

