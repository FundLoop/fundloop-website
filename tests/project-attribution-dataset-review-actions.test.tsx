import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProjectAttributionDatasetReviewActions } from "@/components/admin/project-attribution-dataset-review-actions"

const { refresh, invokeProjectAttributionDatasetReviewBrowser, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  invokeProjectAttributionDatasetReviewBrowser: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}))

vi.mock("@/lib/edge-functions/project-attribution-dataset-review", () => ({
  invokeProjectAttributionDatasetReviewBrowser,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}))

function renderActions() {
  return render(<ProjectAttributionDatasetReviewActions datasetId={21} projectName="Civic Mesh" />)
}

describe("ProjectAttributionDatasetReviewActions", () => {
  beforeEach(() => {
    refresh.mockReset()
    invokeProjectAttributionDatasetReviewBrowser.mockReset()
    toast.mockReset()
  })

  it("approves submitted datasets through the browser Edge adapter", async () => {
    invokeProjectAttributionDatasetReviewBrowser.mockResolvedValue({
      ok: true,
      data: {
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
      },
    })

    renderActions()
    fireEvent.click(screen.getByRole("button", { name: "Approve" }))

    await waitFor(() => {
      expect(invokeProjectAttributionDatasetReviewBrowser).toHaveBeenCalledWith({
        datasetId: 21,
        decision: "approved",
        reason: undefined,
        attemptId: expect.any(String),
      })
    })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Attribution dataset approved" }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("requires a rejection reason before calling the Edge adapter", async () => {
    invokeProjectAttributionDatasetReviewBrowser.mockResolvedValue({
      ok: true,
      data: {
        id: 21,
        projectId: 7,
        projectSlug: "civic-mesh",
        cycleId: 44,
        cycleKey: "2026-04",
        status: "rejected",
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
        decision: "rejected",
        reviewedAt: "2026-04-30T13:00:00.000Z",
        reviewedByUserId: "operator-user",
        reason: "Rows could not be resolved.",
      },
    })
    renderActions()

    const rejectButton = screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement
    expect(rejectButton.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText("Optional approval note, or required rejection reason"), {
      target: { value: "Rows could not be resolved." },
    })
    fireEvent.click(rejectButton)

    await waitFor(() => {
      expect(invokeProjectAttributionDatasetReviewBrowser).toHaveBeenCalledWith({
        datasetId: 21,
        decision: "rejected",
        reason: "Rows could not be resolved.",
        attemptId: expect.any(String),
      })
    })
  })

  it("surfaces Edge adapter failures without refreshing", async () => {
    invokeProjectAttributionDatasetReviewBrowser.mockResolvedValue({
      ok: false,
      error: {
        code: "dataset_not_submitted",
        message: "Only submitted attribution datasets can be reviewed.",
      },
    })

    renderActions()
    fireEvent.click(screen.getByRole("button", { name: "Approve" }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Attribution review failed",
          description: "Only submitted attribution datasets can be reviewed.",
          variant: "destructive",
        }),
      )
    })
    expect(refresh).not.toHaveBeenCalled()
  })
})
