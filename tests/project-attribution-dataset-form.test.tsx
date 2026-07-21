import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProjectAttributionDatasetForm } from "@/components/founder/project-attribution-dataset-form"

const { refresh, invokeProjectAttributionDatasetSubmitBrowser, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  invokeProjectAttributionDatasetSubmitBrowser: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}))

vi.mock("@/lib/edge-functions/project-attribution-dataset-submit", () => ({
  invokeProjectAttributionDatasetSubmitBrowser,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}))

const labels = {
  title: "Submit MVP attribution rows",
  description: "Record scoped identities.",
  currentTitle: "Current MVP dataset",
  currentDescription: "{cycle}: {status}, {rows} row(s), {points} total points.",
  currentEmpty: "No MVP attribution dataset has been submitted yet.",
  blockedNoOpenCycle: "There is no open monthly cycle for attribution submission.",
  cycle: "Open monthly cycle",
  note: "Dataset note",
  rowsTitle: "Attribution rows",
  scopedCubidId: "Scoped CUBID identity",
  userId: "FundLoop user ID, optional",
  userEmail: "User email, optional",
  resolutionHelp:
    "Scoped CUBID identity is required. Add a FundLoop user ID or email when you have it; unresolved or mismatched users come back as submission errors.",
  attributionPoints: "Attribution points",
  category: "Category or role",
  evidenceReference: "Evidence reference",
  rowNotes: "Row notes",
  addRow: "Add row",
  removeRow: "Remove",
  saveDraft: "Save draft",
  submit: "Submit attribution data",
  submitting: "Submitting...",
  validationTitle: "Check attribution rows",
  validationScopedCubid: "Every row needs a scoped CUBID identity.",
  validationPoints: "Attribution points must be non-negative numbers.",
  successDraftTitle: "Attribution draft saved",
  successSubmittedTitle: "Attribution data submitted",
  successDescription: "{cycle} now has {rows} attribution row(s) ready for operator review.",
  failureTitle: "Attribution submission failed",
}

function renderForm(overrides: Partial<ComponentProps<typeof ProjectAttributionDatasetForm>> = {}) {
  return render(
    <ProjectAttributionDatasetForm
      projectSlug="solar-commons"
      openCycles={[{ cycleKey: "2026-05" }]}
      currentDataset={null}
      labels={labels}
      {...overrides}
    />,
  )
}

describe("ProjectAttributionDatasetForm", () => {
  beforeEach(() => {
    refresh.mockReset()
    invokeProjectAttributionDatasetSubmitBrowser.mockReset()
    toast.mockReset()
  })

  it("submits attribution rows through the browser Edge adapter", async () => {
    invokeProjectAttributionDatasetSubmitBrowser.mockResolvedValue({
      ok: true,
      data: {
        id: 710,
        projectId: 1,
        projectSlug: "solar-commons",
        cycleId: 501,
        cycleKey: "2026-05",
        status: "submitted",
        rowCount: 1,
        totalAttributionPoints: 7,
        note: "May attribution",
        proofType: "raw_rows",
        proofArtifactUri: null,
        verifierBackend: null,
        verificationStatus: "not_required",
        submittedByUserId: "founder-user",
        submittedAt: "2026-05-21T00:00:00Z",
        updatedAt: "2026-05-21T00:00:00Z",
        rows: [],
      },
    })

    renderForm()
    fireEvent.change(screen.getByLabelText("Dataset note"), { target: { value: "May attribution" } })
    fireEvent.change(screen.getByLabelText("Scoped CUBID identity"), { target: { value: "cubid-user-1" } })
    fireEvent.change(screen.getByLabelText("Attribution points"), { target: { value: "7" } })
    fireEvent.change(screen.getByLabelText("User email, optional"), { target: { value: "one@example.com" } })
    fireEvent.change(screen.getByLabelText("Category or role"), { target: { value: "research" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit attribution data" }))

    await waitFor(() => {
      expect(invokeProjectAttributionDatasetSubmitBrowser).toHaveBeenCalledWith({
        projectSlug: "solar-commons",
        cycleKey: "2026-05",
        status: "submitted",
        rows: [
          {
            scopedCubidId: "cubid-user-1",
            userId: undefined,
            userEmail: "one@example.com",
            attributionPoints: 7,
            category: "research",
            evidenceReference: undefined,
            notes: undefined,
          },
        ],
        note: "May attribution",
        attemptId: expect.any(String),
      })
    })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Attribution data submitted" }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("surfaces scoped CUBID validation before calling the Edge adapter", async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText("Attribution points"), { target: { value: "7" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit attribution data" }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Check attribution rows" }))
    })
    expect(invokeProjectAttributionDatasetSubmitBrowser).not.toHaveBeenCalled()
  })

  it("surfaces unresolved user feedback returned by the Edge adapter", async () => {
    invokeProjectAttributionDatasetSubmitBrowser.mockResolvedValue({
      ok: false,
      error: {
        code: "unresolved_user",
        message: "The provided email could not be resolved to a linked FundLoop user.",
      },
    })

    renderForm()
    expect(screen.getByText(/unresolved or mismatched users come back as submission errors/i)).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Scoped CUBID identity"), { target: { value: "cubid-user-1" } })
    fireEvent.change(screen.getByLabelText("Attribution points"), { target: { value: "7" } })
    fireEvent.change(screen.getByLabelText("User email, optional"), { target: { value: "missing@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit attribution data" }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Attribution submission failed",
          description: "The provided email could not be resolved to a linked FundLoop user.",
          variant: "destructive",
        }),
      )
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it("disables submission when there is no open cycle", () => {
    renderForm({ openCycles: [] })

    expect(screen.getByText("There is no open monthly cycle for attribution submission.")).toBeTruthy()
    expect((screen.getByRole("button", { name: "Submit attribution data" }) as HTMLButtonElement).disabled).toBe(true)
  })
})
