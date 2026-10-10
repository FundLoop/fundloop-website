import React from "react"
import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
// vi.mock is hoisted above this import, so the static form still sees the mock.
import { CubidOutcomeNotice } from "@/components/auth/cubid-outcome-notice"

// What a person is told after coming back from Cubid (#275, stage 2c UI).

// vi.hoisted, because vi.mock is hoisted above the imports and a factory closing over an ordinary
// top-level const would run before that const exists.
const { toast, replace, state } = vi.hoisted(() => ({
  toast: vi.fn(),
  replace: vi.fn(),
  state: { search: new URLSearchParams() },
}))

vi.mock("@/components/ui/use-toast", () => ({ toast }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/workspace/account",
  useSearchParams: () => state.search,
}))


beforeEach(() => {
  toast.mockReset()
  replace.mockReset()
  state.search = new URLSearchParams()
})

describe("CubidOutcomeNotice", () => {
  it("says nothing when there is no outcome to report", () => {
    render(<CubidOutcomeNotice />)
    expect(toast).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("explains an outcome and then removes it from the URL", async () => {
    state.search = new URLSearchParams("cubid=linked")
    render(<CubidOutcomeNotice />)

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1))
    expect(toast.mock.calls[0][0].title).toBe("Cubid connected")
    // Otherwise a refresh repeats it, and a shared link carries somebody else's sign-in outcome.
    expect(replace).toHaveBeenCalledWith("/workspace/account", { scroll: false })
  })

  it("keeps the rest of the query string", async () => {
    state.search = new URLSearchParams("tab=identity&cubid=signed-in")
    render(<CubidOutcomeNotice />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/workspace/account?tab=identity", { scroll: false }))
  })

  it("tells somebody with an existing account what to do instead of merging it", async () => {
    state.search = new URLSearchParams("cubid=email-taken")
    render(<CubidOutcomeNotice />)

    await waitFor(() => expect(toast).toHaveBeenCalled())
    const message = toast.mock.calls[0][0]
    expect(message.variant).toBe("destructive")
    expect(message.description).toContain("connect Cubid from your account settings")
    expect(message.description).toContain("will not merge")
  })

  it("falls back to a generic refusal for a code it does not know", async () => {
    // The callback sends short codes from a closed list precisely so nothing an issuer or an
    // attacker can influence reaches the screen. An unknown one must not be echoed.
    state.search = new URLSearchParams("cubid=<script>alert(1)</script>")
    render(<CubidOutcomeNotice />)

    await waitFor(() => expect(toast).toHaveBeenCalled())
    const message = toast.mock.calls[0][0]
    expect(message.title).toBe("Sign in with Cubid did not complete")
    // The unknown code itself must not be echoed. (Checked against the values, not the serialized
    // object: "description" contains "script".)
    expect(Object.values(message).join(" ")).not.toContain("alert(1)")
    expect(Object.values(message).join(" ")).not.toContain("<script>")
  })
})
