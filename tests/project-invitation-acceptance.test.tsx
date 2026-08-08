import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProjectInvitationAcceptance } from "@/components/project-invitation-acceptance"

const { inspect, accept, decline } = vi.hoisted(() => ({ inspect: vi.fn(), accept: vi.fn(), decline: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/supabase", () => ({ getSupabaseBrowserClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
}) }))
vi.mock("@/lib/edge-functions/project-invitation", () => ({
  invokeProjectInvitationInspect: inspect, invokeProjectInvitationAccept: accept, invokeProjectInvitationDecline: decline,
}))

const invitation = {
  invitationId: "inv-1", projectId: 7, projectSlug: "civic", projectName: "Civic", role: "member", status: "pending",
  expiresAt: "2026-08-12T00:00:00Z", sharedProfileFields: ["display_name", "avatar"],
  policyDocumentId: "privacy-review", policyContentHash: "9".repeat(64), policyLocale: "en-CA", policyStatus: "review",
}

describe("ProjectInvitationAcceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inspect.mockResolvedValue({ ok: true, data: invitation })
    accept.mockResolvedValue({ ok: true, data: { projectName: "Civic", projectSlug: "civic" } })
  })

  it("keeps acceptance disabled until the exact draft disclosure is acknowledged", async () => {
    render(<ProjectInvitationAcceptance token={"a".repeat(43)} locale="en" />)
    expect(await screen.findByText("DRAFT - NOT APPROVED - NOT EFFECTIVE")).toBeTruthy()
    expect(screen.getByText("display name")).toBeTruthy()
    expect(screen.getByText("avatar")).toBeTruthy()
    const button = screen.getByRole("button", { name: "Acknowledge and accept" }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(accept).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("checkbox"))
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    await waitFor(() => expect(accept).toHaveBeenCalledWith(expect.objectContaining({
      acknowledged: true, policyDocumentId: "privacy-review", sharedProfileFields: ["display_name", "avatar"],
    })))
    expect(await screen.findByTestId("project-invitation-accepted")).toBeTruthy()
  })
})
