import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MonthlyCycleLockButton } from "@/components/admin/monthly-cycle-lock-button"

const { refresh, invokeMonthlyCycleLockBrowser, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  invokeMonthlyCycleLockBrowser: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}))

vi.mock("@/lib/edge-functions/monthly-cycle-lock", () => ({
  invokeMonthlyCycleLockBrowser,
}))

vi.mock("@/components/ui/use-toast", () => ({
  toast,
}))

describe("MonthlyCycleLockButton", () => {
  beforeEach(() => {
    refresh.mockReset()
    invokeMonthlyCycleLockBrowser.mockReset()
    toast.mockReset()
  })

  it("locks an open cycle through the Edge adapter", async () => {
    invokeMonthlyCycleLockBrowser.mockResolvedValue({
      ok: true,
      data: {
        cycleId: 1,
        cycleKey: "2026-04",
        status: "locked",
        lockedAt: "2026-05-01T00:00:00.000Z",
        lockedManifestHash: "abcdef1234567890",
        counts: {
          payments: 1,
          onchainSubmissions: 0,
          unresolvedOnchainSubmissions: 0,
          identitySnapshots: 1,
          approvedDatasets: 0,
          identityArtifacts: 0,
        },
        overrideApplied: false,
      },
    })

    render(<MonthlyCycleLockButton cycleKey="2026-04" />)
    fireEvent.click(screen.getByRole("button", { name: /lock/i }))

    await waitFor(() => {
      expect(invokeMonthlyCycleLockBrowser).toHaveBeenCalledWith({
        cycleKey: "2026-04",
        overrideReason: undefined,
        overrideUnresolvedOnchain: undefined,
      })
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Monthly cycle locked" }))
  })

  it("opens the unresolved-onchain override modal and retries with a reason", async () => {
    invokeMonthlyCycleLockBrowser
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "unresolved_onchain_submissions",
          message: "1 onchain submission is still unresolved.",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          cycleId: 1,
          cycleKey: "2026-04",
          status: "locked",
          lockedAt: "2026-05-01T00:00:00.000Z",
          lockedManifestHash: "abcdef1234567890",
          counts: {
            payments: 1,
            onchainSubmissions: 1,
            unresolvedOnchainSubmissions: 1,
            identitySnapshots: 1,
            approvedDatasets: 0,
            identityArtifacts: 0,
          },
          overrideApplied: true,
        },
      })

    render(<MonthlyCycleLockButton cycleKey="2026-04" />)
    fireEvent.click(screen.getByRole("button", { name: /lock/i }))

    await screen.findByRole("heading", { name: /override unresolved onchain submissions/i })
    const overrideButton = screen.getByRole("button", { name: /lock with override/i })
    expect((overrideButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/required override reason/i), {
      target: { value: "Operator reviewed the pending transfer externally." },
    })
    fireEvent.click(overrideButton)

    await waitFor(() => {
      expect(invokeMonthlyCycleLockBrowser).toHaveBeenLastCalledWith({
        cycleKey: "2026-04",
        overrideUnresolvedOnchain: true,
        overrideReason: "Operator reviewed the pending transfer externally.",
      })
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
