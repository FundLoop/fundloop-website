import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20260805143000_project_invitations.sql", "utf8")

describe("project invitation database boundary", () => {
  it("keeps the security-definer RPC and digest table behind the service role", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.accept_project_invitation(text, uuid, text) FROM PUBLIC, anon, authenticated")
    expect(migration).toContain("REVOKE ALL ON TABLE public.project_invitations FROM PUBLIC, anon, authenticated")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.accept_project_invitation(text, uuid, text) TO service_role")
  })

  it("preserves organization roles while keeping project admin project-scoped", () => {
    expect(migration).toContain("WHERE name = 'Contributor'")
    expect(migration).toContain("ON CONFLICT ON CONSTRAINT organization_members_pkey DO UPDATE\n  SET status = 'active'")
    expect(migration).toContain("invitation.invited_role = 'admin'")
    expect(migration).not.toContain("SET role_id = EXCLUDED.role_id")
  })
})
