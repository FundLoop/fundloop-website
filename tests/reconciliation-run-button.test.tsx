import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ReconciliationRunButton } from "@/components/admin/reconciliation-run-button"

const { refresh, invokeAdminOnchainPaymentReconciliationRunBrowser, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  invokeAdminOnchainPaymentReconciliationRunBrowser: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}))

vi.mock("@/lib/edge-functions/admin-payment-operations", () => ({
  invokeAdminOnchainPaymentReconciliationRunBrowser,
}))

vi.mock("@/components/ui/use-toast", () => ({
  toast,
}))

describe("ReconciliationRunButton", () => {
  beforeEach(() => {
    refresh.mockReset()
    invokeAdminOnchainPaymentReconciliationRunBrowser.mockReset()
    toast.mockReset()
  })

  it("runs reconciliation through the admin Edge adapter", async () => {
    invokeAdminOnchainPaymentReconciliationRunBrowser.mockResolvedValue({
      ok: true,
      data: {
        source: "admin_manual",
        processedCount: 2,
        confirmedCount: 1,
        failedCount: 1,
        confirmingCount: 0,
        unresolvedCount: 0,
        results: [],
        touchedProjectSlugs: ["fundloop-studio"],
      },
    })

    render(<ReconciliationRunButton label="Run reconciliation" paymentId={22} />)
    fireEvent.click(screen.getByRole("button", { name: /run reconciliation/i }))

    await waitFor(() => {
      expect(invokeAdminOnchainPaymentReconciliationRunBrowser).toHaveBeenCalledWith({ paymentId: 22 })
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Reconciliation complete",
      }),
    )
  })

  it("surfaces adapter failures", async () => {
    invokeAdminOnchainPaymentReconciliationRunBrowser.mockResolvedValue({
      ok: false,
      error: {
        code: "forbidden",
        message: "You do not have internal admin access.",
      },
    })

    render(<ReconciliationRunButton label="Run reconciliation" />)
    fireEvent.click(screen.getByRole("button", { name: /run reconciliation/i }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Reconciliation failed",
          description: "You do not have internal admin access.",
        }),
      )
    })
    expect(refresh).not.toHaveBeenCalled()
  })
})
