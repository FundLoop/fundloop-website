import { describe, expect, it } from "vitest"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"
import {
  normalizeProjectAttributionDatasetReviewResult,
  validateProjectAttributionDatasetReviewInput,
} from "@/lib/edge-functions/project-attribution-dataset-review-contract"

const validOutput = {
  id: 21,
  projectId: 7,
  projectSlug: "civic-mesh",
  cycleId: 44,
  cycleKey: "2026-04",
  status: "approved",
  rowCount: 2,
  totalAttributionPoints: 5,
  note: null,
  proofType: "raw_rows",
  proofArtifactUri: null,
  verifierBackend: null,
  verificationStatus: "not_required",
  submittedByUserId: "founder-user",
  submittedAt: "2026-04-30T12:00:00.000Z",
  updatedAt: "2026-04-30T12:00:00.000Z",
  rows: [],
  decision: "approved",
  reviewedAt: "2026-04-30T13:00:00.000Z",
  reviewedByUserId: "operator-user",
  reason: null,
}

describe("project attribution dataset review contract", () => {
  it("accepts approval payloads", () => {
    expect(validateProjectAttributionDatasetReviewInput({ datasetId: 21, decision: "approved" })).toEqual({
      ok: true,
      data: {
        datasetId: 21,
        decision: "approved",
        reason: undefined,
        attemptId: undefined,
      },
    })
  })

  it("requires a reason for rejection payloads", () => {
    expect(validateProjectAttributionDatasetReviewInput({ datasetId: 21, decision: "rejected" })).toEqual({
      ok: false,
      error: {
        code: "invalid_payload",
        message: "reason is required when rejecting an attribution dataset.",
      },
    })
    expect(validateProjectAttributionDatasetReviewInput({ datasetId: 21, decision: "rejected", reason: "Bad rows" })).toEqual({
      ok: true,
      data: {
        datasetId: 21,
        decision: "rejected",
        reason: "Bad rows",
        attemptId: undefined,
      },
    })
  })

  it("rejects invalid ids and decisions", () => {
    expect(validateProjectAttributionDatasetReviewInput({ datasetId: 0, decision: "approved" }).ok).toBe(false)
    expect(validateProjectAttributionDatasetReviewInput({ datasetId: 1, decision: "maybe" }).ok).toBe(false)
  })

  it("normalizes invalid Edge responses", () => {
    expect(normalizeProjectAttributionDatasetReviewResult(edgeCommandSuccess(validOutput))).toEqual({
      ok: true,
      data: validOutput,
    })
    expect(normalizeProjectAttributionDatasetReviewResult(edgeCommandSuccess({ id: 21 }))).toEqual({
      ok: false,
      error: {
        code: "invalid_edge_response",
        message: "project-attribution-dataset-review returned an invalid response envelope.",
      },
    })
  })
})
