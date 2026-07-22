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
  rows: [{ scopedCubidId: "cubid-user-1", attributionPoints: 3 }],
}

const validOutput = {
  id: 21,
  projectId: 7,
  projectSlug: "civic-mesh",
  cycleId: 44,
  cycleKey: "2026-04",
  status: "submitted",
  rowCount: 1,
  totalAttributionPoints: 3,
  note: null,
  proofType: "raw_rows",
  proofArtifactUri: null,
  verifierBackend: null,
  verificationStatus: "not_required",
  submittedByUserId: "user-1",
  submittedAt: "2026-04-30T12:00:00.000Z",
  updatedAt: "2026-04-30T12:00:00.000Z",
  rows: [
    {
      id: 100,
      rowIndex: 1,
      scopedCubidId: "cubid-user-1",
      userId: "user-1",
      userEmail: "user@example.com",
      attributionPoints: 3,
      category: null,
      evidenceReference: null,
      notes: null,
      resolutionStatus: "resolved",
      resolutionMessage: null,
    },
  ],
}

describe("project attribution dataset adapters", () => {
  beforeEach(() => {
    invokeBrowserEdgeCommand.mockReset()
    invokeServerEdgeCommand.mockReset()
  })

  it("normalizes browser adapter output", async () => {
    invokeBrowserEdgeCommand.mockResolvedValue({ ok: true, data: validOutput })

    const { invokeProjectAttributionDatasetSubmitBrowser } = await import("@/lib/edge-functions/project-attribution-dataset-submit")

    await expect(invokeProjectAttributionDatasetSubmitBrowser(validInput)).resolves.toEqual({ ok: true, data: validOutput })
  })

  it("normalizes invalid server adapter responses", async () => {
    invokeServerEdgeCommand.mockResolvedValue({ ok: true, data: { id: 21 } })

    const { invokeProjectAttributionDatasetSubmitServer } = await import(
      "@/lib/edge-functions/project-attribution-dataset-submit-server"
    )

    const result = await invokeProjectAttributionDatasetSubmitServer(validInput)
    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })
})
