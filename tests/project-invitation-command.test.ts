import { describe, expect, it, vi } from "vitest"
import { executeProjectInvitationAccept, executeProjectInvitationCreate, executeProjectInvitationList } from "@/lib/invitations/project-invitation-command"

function query(response: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), insert: vi.fn(() => builder), update: vi.fn(() => builder),
    in: vi.fn(() => builder), lte: vi.fn(() => builder), order: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response), single: vi.fn(async () => response),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve),
  }
  return builder
}

function tableQueue(responses: Record<string, ReturnType<typeof query>[]>) {
  return { from: vi.fn((table: string) => {
    const next = responses[table]?.shift()
    if (!next) throw new Error(`Unexpected query for ${table}`)
    return next
  }) }
}

describe("project invitation commands", () => {
  it("rejects a non-admin before creating an invitation", async () => {
    const projects = query({ data: { id: 7, slug: "civic", name: "Civic", organization_id: 3 }, error: null })
    const participants = query({ data: null, error: null })
    const supabase = { from: vi.fn((table: string) => table === "projects" ? projects : participants) }
    const result = await executeProjectInvitationCreate(supabase as never, {
      actorUserId: "user-1", projectSlug: "civic", email: "member@example.com", role: "member", idempotencyKey: "request-123",
    })
    expect(result).toEqual({ ok: false, error: { code: "permission_denied", message: "Only project administrators can manage invitations." } })
    expect(supabase.from).not.toHaveBeenCalledWith("project_invitations")
  })

  it("allows an active organization Founder to create an invitation and expires stale matches first", async () => {
    const projects = query({ data: { id: 7, slug: "civic", name: "Civic", organization_id: 3 }, error: null })
    const participants = query({ data: null, error: null })
    const roles = query({ data: [{ id: 4 }], error: null })
    const membership = query({ data: { id: 9 }, error: null })
    const expiration = query({ data: null, error: null })
    const existing = query({ data: null, error: null })
    const insertion = query({ data: { id: "inv-1", expires_at: "2026-08-12T00:00:00.000Z" }, error: null })
    const supabase = tableQueue({ projects: [projects], participants: [participants], ref_roles: [roles],
      organization_members: [membership], project_invitations: [expiration, existing, insertion] })

    const result = await executeProjectInvitationCreate(supabase as never, {
      actorUserId: "founder-1", projectSlug: "civic", email: "member@example.com", role: "member", idempotencyKey: "request-123",
    })

    expect(result).toEqual({ ok: true, data: expect.objectContaining({ invitationId: "inv-1", email: "member@example.com" }) })
    expect(expiration.update).toHaveBeenCalledWith({ status: "expired" })
    expect(expiration.eq).toHaveBeenCalledWith("invitee_email", "member@example.com")
    expect(existing.select).toHaveBeenCalledWith("id, expires_at")
  })

  it.each([
    ["project_invitations_creator_idempotency_unique", "idempotency_replay_requires_original_token"],
    ["project_invitations_one_pending_email", "invitation_already_pending"],
    ["project_invitations_token_digest_key", "invitation_create_failed"],
  ])("maps the %s constraint without conflating duplicate causes", async (constraint, expectedCode) => {
    const error = { code: "23505", message: `duplicate key value violates unique constraint \"${constraint}\"` }
    const supabase = tableQueue({
      projects: [query({ data: { id: 7, slug: "civic", name: "Civic", organization_id: 3 }, error: null })],
      participants: [query({ data: { id: 1 }, error: null })],
      project_invitations: [query({ data: null, error: null }), query({ data: null, error: null }), query({ data: null, error })],
    })
    const result = await executeProjectInvitationCreate(supabase as never, {
      actorUserId: "admin-1", projectSlug: "civic", email: "member@example.com", role: "member", idempotencyKey: "request-123",
    })
    expect(result).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: expectedCode }) }))
  })

  it("expires stale invitations before listing them", async () => {
    const expiration = query({ data: null, error: null })
    const invitations = query({ data: [{ id: "inv-1", invitee_email: "member@example.com", invited_role: "member",
      status: "expired", expires_at: "2026-08-01T00:00:00Z", created_at: "2026-07-25T00:00:00Z" }], error: null })
    const supabase = tableQueue({
      projects: [query({ data: { id: 7, organization_id: 3 }, error: null })],
      participants: [query({ data: { id: 1 }, error: null })],
      project_invitations: [expiration, invitations],
    })
    const result = await executeProjectInvitationList(supabase as never, { actorUserId: "admin-1", projectSlug: "civic" })
    expect(result).toEqual({ ok: true, data: [expect.objectContaining({ invitationId: "inv-1", status: "expired" })] })
    expect(expiration.update).toHaveBeenCalledWith({ status: "expired" })
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

  it.each([
    ["invitation_not_found", "This invitation link is invalid."],
    ["invitation_expired", "This invitation has expired. Ask a project administrator for a new link."],
    ["invitation_not_pending", "This invitation is no longer pending and cannot be accepted."],
  ])("maps %s to an explicit acceptance state", async (code, message) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: code } }))
    const result = await executeProjectInvitationAccept({ rpc } as never, {
      token: "c".repeat(43), actorUserId: "user-4", actorEmail: "member@example.com",
    })
    expect(result).toEqual({ ok: false, error: { code, message } })
  })
})
