import { describe, expect, it } from "vitest"
import {
  normalizeProjectAttributionDatasetSubmitResult,
  validateProjectAttributionDatasetSubmitInput,
} from "@/lib/edge-functions/project-attribution-dataset-submit-contract"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"

describe("project attribution dataset submit contract", () => {
  it("accepts and normalizes valid attribution rows", () => {
    const result = validateProjectAttributionDatasetSubmitInput({
      projectSlug: "civic-mesh",
      cycleKey: "2026-04",
      status: "submitted",
      rows: [
        {
          scopedCubidId: "cubid-user-1",
          userId: "11111111-1111-4111-8111-111111111111",
          userEmail: " USER@EXAMPLE.COM ",
          attributionPoints: 1.1234567,
          category: "research",
          evidenceReference: " issue-12 ",
          notes: " first row ",
        },
        {
          scopedCubidId: "cubid-user-1",
          attributionPoints: 2,
          notes: "second row",
        },
      ],
      note: " April attribution ",
      attemptId: " attempt-1 ",
    })

    expect(result).toEqual({
      ok: true,
      data: {
        projectSlug: "civic-mesh",
        cycleKey: "2026-04",
        status: "submitted",
        rows: [
          {
            scopedCubidId: "cubid-user-1",
            userId: "11111111-1111-4111-8111-111111111111",
            userEmail: "user@example.com",
            attributionPoints: 3.123457,
            category: "research",
            evidenceReference: "issue-12",
            notes: "first row | second row",
          },
        ],
        note: "April attribution",
        proofType: "raw_rows",
        proofArtifactUri: undefined,
        verifierBackend: undefined,
        verificationStatus: "not_required",
        attemptId: "attempt-1",
      },
    })
  })

  it("rejects invalid cycle keys, missing scoped CUBID identity, invalid users, and negative points", () => {
    expect(validateProjectAttributionDatasetSubmitInput({ projectSlug: "civic-mesh", cycleKey: "2026-99", rows: [] }).ok).toBe(
      false,
    )
    expect(
      validateProjectAttributionDatasetSubmitInput({
        projectSlug: "civic-mesh",
        cycleKey: "2026-04",
        rows: [{ scopedCubidId: "", attributionPoints: 1 }],
      }).ok,
    ).toBe(false)
    expect(
      validateProjectAttributionDatasetSubmitInput({
        projectSlug: "civic-mesh",
        cycleKey: "2026-04",
        rows: [{ scopedCubidId: "cubid-user-1", userId: "not-a-uuid", attributionPoints: 1 }],
      }).ok,
    ).toBe(false)
    expect(
      validateProjectAttributionDatasetSubmitInput({
        projectSlug: "civic-mesh",
        cycleKey: "2026-04",
        rows: [{ scopedCubidId: "cubid-user-1", attributionPoints: -1 }],
      }).ok,
    ).toBe(false)
  })

  it("normalizes invalid Edge Function responses", () => {
    const result = normalizeProjectAttributionDatasetSubmitResult(edgeCommandSuccess({ id: 1 }))

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })
})
