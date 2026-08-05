import { describe, expect, it } from "vitest"
import {
  normalizeProjectInvitationAcceptResult,
  normalizeProjectInvitationListResult,
  validateProjectInvitationAcceptInput,
  validateProjectInvitationCreateInput,
} from "@/lib/edge-functions/project-invitation-contract"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"

describe("project invitation contracts", () => {
  it("normalizes the invited email and accepts explicit project roles", () => {
    expect(validateProjectInvitationCreateInput({
      projectSlug: " civic-mesh ", email: " Invitee@Example.COM ", role: "member", idempotencyKey: "request-123",
    })).toEqual({ ok: true, data: { projectSlug: "civic-mesh", email: "invitee@example.com", role: "member", idempotencyKey: "request-123" } })
  })

  it("rejects malformed email, role, idempotency key, and token inputs", () => {
    expect(validateProjectInvitationCreateInput({ projectSlug: "p", email: "bad", role: "owner", idempotencyKey: "short" }).ok).toBe(false)
    expect(validateProjectInvitationAcceptInput({ token: "raw token" }).ok).toBe(false)
  })

  it("normalizes an accepted invitation without exposing its token digest", () => {
    const result = normalizeProjectInvitationAcceptResult(edgeCommandSuccess({ invitationId: "inv-1", projectId: 7,
      projectSlug: "civic-mesh", projectName: "Civic Mesh", organizationId: 3, role: "member", status: "accepted",
      acceptedAt: "2026-08-05T12:00:00.000Z" }))
    expect(result.ok && result.data).toEqual(expect.not.objectContaining({ token: expect.anything(), tokenDigest: expect.anything() }))
  })

  it("rejects unsafe invitation list rows containing token material", () => {
    const result = normalizeProjectInvitationListResult(edgeCommandSuccess([{ invitationId: "inv-1", email: "a@example.com",
      role: "member", status: "pending", expiresAt: "2026-08-12T00:00:00Z", createdAt: "2026-08-05T00:00:00Z", tokenDigest: "secret" }]))
    expect(result.ok).toBe(false)
  })
})
