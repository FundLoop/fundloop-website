import { describe, expect, it } from "vitest"
import { expectSqlBeforeEvery, expectSqlOrder, readMigration, sqlFunctionBody, statementsOnly } from "./support/sql-text"

// Disconnecting Cubid under every issuer the person is mapped to (#275, stage 2c UI).
//
// The schema allows one mapping per (issuer, user_id), so more than one issuer is representable.
// The previous function locked one of them and deleted all of them.

const migration = readMigration("supabase/migrations/20261010070000_unlink_every_cubid_subject.sql")
const unlink = sqlFunctionBody(migration, "public.unlink_cubid_subject")
// Short on purpose: the call wraps across lines here, and an anchor that depends on the
// formatting would fail for a reason that has nothing to do with the SQL's meaning. The key's
// shape is asserted separately.
const SUBJECT_LOCK = "pg_catalog.pg_advisory_xact_lock("

describe("unlink_cubid_subject, across issuers", () => {
  it("walks every mapping the person has", () => {
    expect(unlink).toContain("for v_mapping in")
    expect(unlink).toContain("where s.user_id = p_user_id")
  })

  it("locks each subject it is about to remove", () => {
    expect(unlink).toContain(SUBJECT_LOCK)
    // The same key space as linking, redemption and event receipt, or it serializes nothing.
    expect(unlink).toContain("'cubid_subject:' || v_mapping.issuer || ':' || v_mapping.subject")
    // Inside the loop, so one lock per mapping rather than one for the first one found.
    expectSqlOrder(unlink, "for v_mapping in", SUBJECT_LOCK)
    expectSqlOrder(unlink, SUBJECT_LOCK, "end loop")
  })

  it("takes the locks in a deterministic order, so two calls cannot deadlock", () => {
    expect(unlink).toContain("order by s.issuer, s.subject")
    expectSqlBeforeEvery(unlink, "order by s.issuer, s.subject", SUBJECT_LOCK)
  })

  it("re-reads each mapping under its own lock", () => {
    expectSqlOrder(unlink, SUBJECT_LOCK, "select 1 from public.cubid_oidc_subjects s")
    expectSqlOrder(unlink, "select 1 from public.cubid_oidc_subjects s", "'conflict'::text")
  })

  it("refuses rather than deleting a mapping it never locked", () => {
    // A mapping created under a new issuer after the first read would otherwise be deleted without
    // its subject being serialized against a concurrent redemption.
    expect(unlink).toContain("<> v_locked")
    expectSqlOrder(unlink, "<> v_locked", "'conflict'::text")
  })

  it("locks every grant before deleting anything", () => {
    expectSqlOrder(
      unlink,
      "perform 1 from public.oauth_grants g where g.user_id = p_user_id for update",
      "delete from public.cubid_oidc_subjects",
    )
  })

  it("says so plainly when there was nothing linked", () => {
    expect(unlink).toContain("'not_linked'::text")
  })

  it("keeps revoking the delegated access that was issued against the identity", () => {
    expect(unlink).toContain("perform 1 from public.oauth_revoke_grant(v_client_id, p_user_id)")
  })

  it("uses no SECURITY DEFINER, like the rest of this feature", () => {
    expect(statementsOnly(migration)).not.toMatch(/security\s+definer/i)
    expect(unlink).toContain("security invoker")
    expect(unlink).toContain("set search_path = ''")
  })
})
