import { beforeEach, describe, expect, it, vi } from "vitest"

const invokeBrowserEdgeCommand = vi.fn()
const invokeServerEdgeCommand = vi.fn()

vi.mock("@/lib/edge-functions/invoke", () => ({
  invokeBrowserEdgeCommand,
}))

vi.mock("@/lib/edge-functions/invoke-server", () => ({
  invokeServerEdgeCommand,
}))

const validInput = {
  projectSlug: "civic-mesh",
  cycleKey: "2026-04",
  periodStart: "2026-04-01",
  periodEnd: "2026-04-30",
  sourceCurrency: "USD",
  sourceAmount: 1000,
  usdEquivalentAmount: 1000,
  commitmentPercentage: 1,
  calculatedContributionAmount: 10,
}

const validOutput = {
  id: 12,
  projectId: 7,
  projectSlug: "civic-mesh",
  cycleId: 44,
  cycleKey: "2026-04",
  periodStart: "2026-04-01",
  periodEnd: "2026-04-30",
  sourceCurrency: "USD",
  sourceAmount: 1000,
  usdEquivalentAmount: 1000,
  commitmentPercentage: 1,
  calculatedContributionAmount: 10,
  sourceReference: null,
  notes: null,
  status: "submitted",
  submittedByUserId: "user-1",
  submittedAt: "2026-04-30T12:00:00.000Z",
  updatedAt: "2026-04-30T12:00:00.000Z",
}

describe("project monthly contribution adapters", () => {
  beforeEach(() => {
    invokeBrowserEdgeCommand.mockReset()
    invokeServerEdgeCommand.mockReset()
  })

  it("normalizes browser adapter output", async () => {
    invokeBrowserEdgeCommand.mockResolvedValue({ ok: true, data: validOutput })

    const { invokeProjectMonthlyContributionSubmitBrowser } = await import(
      "@/lib/edge-functions/project-monthly-contribution-submit"
    )

    await expect(invokeProjectMonthlyContributionSubmitBrowser(validInput)).resolves.toEqual({ ok: true, data: validOutput })
  })

  it("normalizes invalid server adapter responses", async () => {
    invokeServerEdgeCommand.mockResolvedValue({ ok: true, data: { id: 12 } })

    const { invokeProjectMonthlyContributionSubmitServer } = await import(
      "@/lib/edge-functions/project-monthly-contribution-submit-server"
    )

    const result = await invokeProjectMonthlyContributionSubmitServer(validInput)
    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })
})
