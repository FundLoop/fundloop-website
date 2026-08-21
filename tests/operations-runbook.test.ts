import { describe, expect, it } from "vitest"
import { getOperationsRunbookSection, OPERATIONS_RUNBOOK_SECTIONS } from "@/lib/operations/runbook"

describe("operations runbook", () => {
  it("covers the required operating domains", () => {
    expect(OPERATIONS_RUNBOOK_SECTIONS.map((section) => section.id)).toEqual([
      "release-health",
      "monthly-cycle",
      "identity-sync",
      "payment-payout-incidents",
      "artifact-retention",
    ])
  })

  it("links every section to a live operator action and durable engineering doc", () => {
    for (const section of OPERATIONS_RUNBOOK_SECTIONS) {
      expect(section.primaryActionHref).toMatch(/^\/admin\//)
      expect(section.primaryActionLabel.length).toBeGreaterThan(0)
      expect(section.docsPath).toMatch(/^docs\/engineering\/.+\.md$/)
      expect(section.checks.length).toBeGreaterThanOrEqual(3)
      expect(section.escalation.length).toBeGreaterThan(20)
    }
  })

  it("looks up a single section by id", () => {
    expect(getOperationsRunbookSection("identity-sync")).toMatchObject({
      title: "CUBID identity sync health",
      primaryActionHref: "/admin/identity",
    })
    expect(getOperationsRunbookSection("missing")).toBeNull()
  })
})
