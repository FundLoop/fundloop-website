import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProjectInvitationPanel } from "@/components/founder/project-invitation-panel"

const { listInvitations } = vi.hoisted(() => ({ listInvitations: vi.fn() }))
vi.mock("@/lib/edge-functions/project-invitation", () => ({
  invokeProjectInvitationCreate: vi.fn(),
  invokeProjectInvitationList: listInvitations,
}))

describe("ProjectInvitationPanel", () => {
  beforeEach(() => vi.clearAllMocks())

  it("reloads a safe persisted invitation projection", async () => {
    listInvitations.mockResolvedValue({ ok: true, data: [{ invitationId: "inv-1", email: "member@example.com",
      role: "member", status: "pending", expiresAt: "2026-08-12T00:00:00Z", createdAt: "2026-08-05T00:00:00Z" }] })
    render(<ProjectInvitationPanel projectSlug="civic" projectName="Civic" locale="en" />)
    expect(await screen.findByText("member@example.com")).toBeTruthy()
    expect(screen.getByText("pending")).toBeTruthy()
    expect(listInvitations).toHaveBeenCalledWith({ projectSlug: "civic" })
  })

  it("shows an explicit persisted-list failure instead of an empty state", async () => {
    listInvitations.mockResolvedValue({ ok: false, error: { code: "failed", message: "no" } })
    render(<ProjectInvitationPanel projectSlug="civic" projectName="Civic" locale="en" />)
    expect((await screen.findByRole("alert")).textContent).toContain("Persisted invitations could not be loaded")
    expect(screen.queryByText("No project invitations yet.")).toBeNull()
  })

  it("requires at least one deduplicated shared field before submission", async () => {
    listInvitations.mockResolvedValue({ ok: true, data: [] })
    render(<ProjectInvitationPanel projectSlug="civic" projectName="Civic" locale="en" />)
    await screen.findByText("No project invitations yet.")
    for (const checkbox of screen.getAllByRole("checkbox")) {
      if ((checkbox as HTMLInputElement).checked) fireEvent.click(checkbox)
    }
    expect(screen.getByText("Select at least one profile field.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Create invitation" }).getAttribute("disabled")).not.toBeNull()
  })
})
