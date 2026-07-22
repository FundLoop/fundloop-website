import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AuthModal } from "@/components/auth-modal"

const { refresh, signInWithOtp, verifyOtp, getSession, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getSession: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}))

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signInWithOtp,
      verifyOtp,
      getSession,
      signInWithOAuth: vi.fn(),
    },
  }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  toast,
}))

describe("AuthModal", () => {
  beforeEach(() => {
    refresh.mockReset()
    signInWithOtp.mockReset()
    verifyOtp.mockReset()
    getSession.mockReset()
    toast.mockReset()
  })

  it("keeps the modal open and reports an error when OTP verification creates no browser session", async () => {
    const onClose = vi.fn()
    signInWithOtp.mockResolvedValue({ error: null })
    verifyOtp.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: null,
    })
    getSession.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    })

    render(<AuthModal open onClose={onClose} />)

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " person@example.com " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }))

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "person@example.com",
        options: {
          emailRedirectTo: "http://localhost:3000/",
        },
      })
    })

    const digitInputs = screen.getAllByRole("textbox")
    expect(digitInputs).toHaveLength(6)

    for (const [index, digit] of ["1", "2", "3", "4", "5", "6"].entries()) {
      fireEvent.change(digitInputs[index], {
        target: { value: digit },
      })
    }

    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith({
        email: "person@example.com",
        token: "123456",
        type: "email",
      })
    })
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Failed to verify OTP",
        variant: "destructive",
      }),
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})
