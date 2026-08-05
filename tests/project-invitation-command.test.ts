import { describe, expect, it, vi } from "vitest"
import { executeProjectInvitationAccept, executeProjectInvitationCreate } from "@/lib/invitations/project-invitation-command"

function query(response: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), insert: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => response), single: vi.fn(async () => response),
  }
  return builder
}

describe("project invitation commands", () => {
  it("rejects a non-admin before creating an invitation", async () => {
    const projects = query({ data: { id: 7, slug: "civic", name: "Civic", organization_id: 3 }, error: null })
    const participants = query({ data: null, error: null })
    const supabase = { from: vi.fn((table: string) => table === "projects" ? projects : participants) }
    const result = await executeProjectInvitationCreate(supabase as never, {
      actorUserId: "user-1", projectSlug: "civic", email: "member@example.com", role: "member", idempotencyKey: "request-123",
    })
    expect(result).toEqual({ ok: false, error: { code: "permission_denied", message: "Only project administrators can create invitations." } })
    expect(supabase.from).not.toHaveBeenCalledWith("project_invitations")
  })

  it("returns an accepted membership from the atomic database command", async () => {
    const rpc = vi.fn(async () => ({ data: [{ invitation_id: "inv-1", project_id: 7, project_slug: "civic", project_name: "Civic",
      organization_id: 3, invited_role: "member", status: "accepted", accepted_at: "2026-08-05T12:00:00.000Z" }], error: null }))
    const result = await executeProjectInvitationAccept({ rpc } as never, {
      token: "a".repeat(43), actorUserId: "user-2", actorEmail: "member@example.com",
    })
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ invitationId: "inv-1", projectId: 7, role: "member", status: "accepted" }) })
    expect(rpc).toHaveBeenCalledWith("accept_project_invitation", expect.objectContaining({ p_actor_user_id: "user-2", p_actor_email: "member@example.com" }))
  })

  it("maps an email mismatch to a safe user-facing failure", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "invitation_email_mismatch" } }))
    const result = await executeProjectInvitationAccept({ rpc } as never, {
      token: "b".repeat(43), actorUserId: "user-3", actorEmail: "other@example.com",
    })
    expect(result).toEqual({ ok: false, error: { code: "invitation_email_mismatch", message: "Sign in with the email address that was invited." } })
  })
})
