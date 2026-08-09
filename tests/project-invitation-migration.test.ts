import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20260805143000_project_invitations.sql", "utf8")
const reviewMigration = readFileSync("supabase/migrations/20260808234500_project_invitation_review_sharing.sql", "utf8")
const lifecycleMigration = readFileSync("supabase/migrations/20260808235500_project_invitation_lifecycle_residue.sql", "utf8")
const aggregateMigration = readFileSync("supabase/migrations/20260809000500_project_invitation_aggregate_provenance.sql", "utf8")
const readBoundaryMigration = readFileSync("supabase/migrations/20260809003000_project_member_shared_profiles_edge_boundary.sql", "utf8")

describe("project invitation database boundary", () => {
  it("allows active organization Founder and Admin members to read invitation state", () => {
    expect(migration).toContain("JOIN public.ref_roles AS role ON role.id = membership.role_id")
    expect(migration).toContain("membership.status = 'active'")
    expect(migration).toContain("role.name IN ('Founder', 'Admin')")
  })

  it("records exact versioned disclosure evidence before granting membership", () => {
    expect(reviewMigration.indexOf("INSERT INTO public.project_invitation_acceptance_evidence")).toBeLessThan(reviewMigration.indexOf("INSERT INTO public.organization_members"))
    expect(reviewMigration).toContain("current_invitation_disclosure_required")
    expect(reviewMigration).toContain("shared_profile_fields <> p_shared_profile_fields")
  })

  it("keeps pending profile data private and removes project access on revocation", () => {
    expect(reviewMigration).toContain("invitation.status = 'accepted'")
    expect(reviewMigration).toContain("EXISTS (SELECT 1 FROM public.participants viewer")
    expect(reviewMigration).toContain("DELETE FROM public.participants")
    expect(reviewMigration).toContain("action IN ('acknowledge_accept', 'decline', 'revoke', 'expire')")
  })

  it("revokes the legacy acceptance function and gates new commands behind service role", () => {
    expect(reviewMigration).toContain("REVOKE ALL ON FUNCTION public.accept_project_invitation(text, uuid, text) FROM service_role")
    expect(reviewMigration).toContain("GRANT EXECUTE ON FUNCTION public.accept_project_invitation_review")
  })

  it("records batch expiry evidence and removes only invitation-owned organization membership", () => {
    expect(lifecycleMigration).toContain("expire_project_invitations_review")
    expect(lifecycleMigration).toContain("'expire'")
    expect(lifecycleMigration).toContain("organization_membership_change")
    expect(lifecycleMigration).toContain("membership_change = 'created'")
    expect(lifecycleMigration).toContain("membership_change = 'reactivated'")
    expect(lifecycleMigration).toContain("organization_membership_previous_status")
  })

  it("tracks aggregate membership and participant ownership across revoke order", () => {
    expect(aggregateMigration).toContain("project_invitation_membership_provenance")
    expect(aggregateMigration).toContain("project_invitation_participant_provenance")
    expect(aggregateMigration).toContain("has_other_organization_invitation")
    expect(aggregateMigration).toContain("has_other_project_invitation")
    expect(aggregateMigration).toContain("remaining_project_admin")
    expect(aggregateMigration).toContain("previous_is_favorite")
  })

  it("denies browser RPC execution and requires a service-role actor-scoped read", () => {
    expect(readBoundaryMigration).toContain("DROP FUNCTION public.list_project_member_shared_profiles(bigint)")
    expect(readBoundaryMigration).toContain("p_actor_user_id uuid")
    expect(readBoundaryMigration).toContain("viewer.user_id = p_actor_user_id")
    expect(readBoundaryMigration).toContain("REVOKE ALL ON FUNCTION public.list_project_member_shared_profiles(bigint, uuid) FROM PUBLIC, anon, authenticated")
    expect(readBoundaryMigration).toContain("GRANT EXECUTE ON FUNCTION public.list_project_member_shared_profiles(bigint, uuid) TO service_role")
    expect(readBoundaryMigration).toContain("JOIN LATERAL")
    expect(readBoundaryMigration).toContain("LIMIT 1")
  })

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
