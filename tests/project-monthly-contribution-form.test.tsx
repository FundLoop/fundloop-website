import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProjectMonthlyContributionForm } from "@/components/founder/project-monthly-contribution-form"

const { refresh, invokeProjectMonthlyContributionSubmitBrowser, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  invokeProjectMonthlyContributionSubmitBrowser: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}))

vi.mock("@/lib/edge-functions/project-monthly-contribution-submit", () => ({
  invokeProjectMonthlyContributionSubmitBrowser,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}))

const labels = {
  title: "Submit monthly contribution data",
  description: "Record bookkeeping input.",
  currentTitle: "Current submitted record",
  currentDescription: "{cycle}: {amount}, normalized to {usd}.",
  currentEmpty: "No monthly contribution record has been submitted yet.",
  cycle: "Open monthly cycle",
  period: "Cycle period",
  sourceCurrency: "Source currency or token",
  sourceAmount: "Source amount",
  usdEquivalentAmount: "USD equivalent",
  commitmentPercentage: "Commitment percentage",
  calculatedContributionAmount: "Calculated contribution",
  sourceReference: "Source reference",
  notes: "Notes",
  submit: "Submit contribution data",
  submitting: "Submitting...",
  blockedMissingCommitment: "Add a project contribution commitment first.",
  blockedNoOpenCycle: "There is no open monthly cycle.",
  validationTitle: "Check contribution data",
  validationAmount: "Amounts must be non-negative numbers.",
  successTitle: "Contribution data submitted",
  successDescription: "{cycle} is ready for operator cycle review.",
  failureTitle: "Contribution submission failed",
}

function renderForm(overrides: Partial<ComponentProps<typeof ProjectMonthlyContributionForm>> = {}) {
  return render(
    <ProjectMonthlyContributionForm
      projectSlug="solar-commons"
      contributionPercentage={3}
      defaultReportingCurrencyCode="CAD"
      canSubmit
      blockedReason={null}
      openCycles={[
        {
          cycleKey: "2026-05",
          periodStart: "2026-05-01",
          periodEnd: "2026-05-31",
        },
      ]}
      currentSubmission={null}
      labels={labels}
      {...overrides}
    />,
  )
}

describe("ProjectMonthlyContributionForm", () => {
  beforeEach(() => {
    refresh.mockReset()
    invokeProjectMonthlyContributionSubmitBrowser.mockReset()
    toast.mockReset()
  })

  it("submits monthly contribution data through the browser Edge adapter", async () => {
    invokeProjectMonthlyContributionSubmitBrowser.mockResolvedValue({
      ok: true,
      data: {
        id: 1,
        projectId: 10,
        projectSlug: "solar-commons",
        cycleId: 501,
        cycleKey: "2026-05",
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
        sourceCurrency: "CAD",
        sourceAmount: 1000,
        usdEquivalentAmount: 740,
        commitmentPercentage: 3,
        calculatedContributionAmount: 22.2,
        sourceReference: "may-ledger",
        notes: "Confirmed available amount",
        status: "submitted",
        submittedByUserId: "user-1",
        submittedAt: "2026-05-20T00:00:00Z",
        updatedAt: "2026-05-20T00:00:00Z",
      },
    })

    renderForm()
    fireEvent.change(screen.getByLabelText("Source amount"), { target: { value: "1000" } })
    fireEvent.change(screen.getByLabelText("USD equivalent"), { target: { value: "740" } })
    fireEvent.change(screen.getByLabelText("Source reference"), { target: { value: "may-ledger" } })
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Confirmed available amount" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit contribution data" }))

    await waitFor(() => {
      expect(invokeProjectMonthlyContributionSubmitBrowser).toHaveBeenCalledWith({
        projectSlug: "solar-commons",
        cycleKey: "2026-05",
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
        sourceCurrency: "CAD",
        sourceAmount: 1000,
        usdEquivalentAmount: 740,
        commitmentPercentage: 3,
        calculatedContributionAmount: 22.2,
        sourceReference: "may-ledger",
        notes: "Confirmed available amount",
        attemptId: expect.any(String),
      })
    })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Contribution data submitted" }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("surfaces client-side validation before calling the Edge adapter", async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText("Source amount"), { target: { value: "-1" } })
    fireEvent.change(screen.getByLabelText("USD equivalent"), { target: { value: "740" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit contribution data" }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Check contribution data" }))
    })
    expect(invokeProjectMonthlyContributionSubmitBrowser).not.toHaveBeenCalled()
  })

  it("disables submission when there is no open cycle", () => {
    renderForm({
      canSubmit: false,
      blockedReason: "no_open_cycle",
      openCycles: [],
    })

    expect(screen.getByText("There is no open monthly cycle.")).toBeTruthy()
    expect((screen.getByRole("button", { name: "Submit contribution data" }) as HTMLButtonElement).disabled).toBe(true)
  })
})
