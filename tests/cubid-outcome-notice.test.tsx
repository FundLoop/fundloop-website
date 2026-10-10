import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// What a person is told after coming back from Cubid (#275, stage 2c UI).
//
// The notice renders itself rather than dispatching a toast: the application's toast store and its
// renderer are not wired together, and an outcome nobody sees is worse than no outcome.

// vi.hoisted, because vi.mock is hoisted above the imports and a factory closing over an ordinary
// top-level const would run before that const exists.
const { replace, state } = vi.hoisted(() => ({ replace: vi.fn(), state: { search: new URLSearchParams() } }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/workspace/account",
  useSearchParams: () => state.search,
}))

import { CubidOutcomeNotice } from "@/components/auth/cubid-outcome-notice"

beforeEach(() => {
  replace.mockReset()
  state.search = new URLSearchParams()
})

describe("CubidOutcomeNotice", () => {
  it("renders nothing when there is no outcome to report", () => {
    const { container } = render(<CubidOutcomeNotice />)
    expect(container.innerHTML).toBe("")
    expect(replace).not.toHaveBeenCalled()
  })

  it("shows the outcome and then removes it from the URL", async () => {
    state.search = new URLSearchParams("cubid=linked")
    render(<CubidOutcomeNotice />)

    expect(screen.getByText("Cubid connected")).toBeTruthy()
    // Otherwise a refresh repeats it, and a shared link carries somebody else's sign-in outcome.
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/workspace/account", { scroll: false }))
  })

  it("keeps the rest of the query string", async () => {
    state.search = new URLSearchParams("tab=identity&cubid=signed-in")
    render(<CubidOutcomeNotice />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/workspace/account?tab=identity", { scroll: false }))
  })

  it("stays on screen until it is dismissed, unlike a toast", () => {
    state.search = new URLSearchParams("cubid=signed-in")
    render(<CubidOutcomeNotice />)

    expect(screen.getByTestId("cubid-outcome-notice")).toBeTruthy()
    fireEvent.click(screen.getByTestId("cubid-outcome-dismiss"))
    expect(screen.queryByTestId("cubid-outcome-notice")).toBeNull()
  })

  it("announces a failure as an alert and a success as a status", () => {
    state.search = new URLSearchParams("cubid=no-email")
    const { unmount } = render(<CubidOutcomeNotice />)
    expect(screen.getByRole("alert")).toBeTruthy()
    unmount()

    state.search = new URLSearchParams("cubid=signed-in")
    render(<CubidOutcomeNotice />)
    expect(screen.getByRole("status")).toBeTruthy()
  })

  it("tells somebody with an existing account what to do instead of merging it", () => {
    state.search = new URLSearchParams("cubid=email-taken")
    render(<CubidOutcomeNotice />)

    const notice = screen.getByTestId("cubid-outcome-notice")
    expect(notice.textContent).toContain("connect Cubid from your account settings")
    expect(notice.textContent).toContain("will not merge")
  })

  it("falls back to a generic refusal for a code it does not know", () => {
    // The callback sends short codes from a closed list precisely so nothing an issuer or an
    // attacker can influence reaches the screen. An unknown one must not be echoed.
    state.search = new URLSearchParams("cubid=<script>alert(1)</script>")
    render(<CubidOutcomeNotice />)

    const notice = screen.getByTestId("cubid-outcome-notice")
    expect(notice.textContent).toContain("Sign in with Cubid did not complete")
    expect(notice.textContent).not.toContain("alert(1)")
    expect(notice.textContent).not.toContain("<script>")
  })
})
