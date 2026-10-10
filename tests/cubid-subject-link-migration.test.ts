import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  ACCOUNT_PURGED_EVENT,
  CROSS_APP_CONSENT_REVOKED_EVENT,
} from "@/lib/cross-app/secevent"

// The linking contract (#275 acceptance criterion 7, stage 2c).
//
// CI applies this migration against a fresh schema, so this file is not here to prove it runs. It
// holds the decisions the SQL encodes, and above all the one the whole criterion is about: mapping a
// subject applies the withdrawals that arrived before anyone could.

const migration = readFileSync("supabase/migrations/20261010060000_link_cubid_subject.sql", "utf8")

/**
 * The statements with the commentary removed. An assertion about what the SQL does must not be
 * satisfiable by a comment saying it — that is how a guard gets written that only tests its own
 * prose.
 */
function statementsOnly(text: string) {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
}
const linkFunction = migration.slice(
  migration.indexOf("create or replace function public.link_cubid_subject"),
  migration.indexOf("revoke all on function public.link_cubid_subject"),
)
const unlinkFunction = migration.slice(
  migration.indexOf("create or replace function public.unlink_cubid_subject"),
  migration.indexOf("revoke all on function public.unlink_cubid_subject"),
)

describe("link_cubid_subject", () => {
  it("names the event types exactly as the verifier does", () => {
    expect(linkFunction).toContain(`c_cross_app_revoked constant text := '${CROSS_APP_CONSENT_REVOKED_EVENT}'`)
    expect(linkFunction).toContain(`c_account_purged constant text := '${ACCOUNT_PURGED_EVENT}'`)
  })

  it("applies every withdrawal already received for the subject — criterion 7", () => {
    expect(linkFunction).toContain("where e.issuer = p_issuer and e.subject = p_subject")
    expect(linkFunction).toContain("e.payload ? c_cross_app_revoked")
    expect(linkFunction).toContain("perform 1 from public.oauth_revoke_grant(v_client_id, p_user_id)")
  })

  it("does it in the same statement as the mapping, with no window between them", () => {
    const insertAt = linkFunction.indexOf("insert into public.cubid_oidc_subjects")
    const revokeAt = linkFunction.indexOf("perform 1 from public.oauth_revoke_grant")
    expect(insertAt).toBeGreaterThan(0)
    expect(revokeAt).toBeGreaterThan(insertAt)
    // One function body, so one transaction: a crash between the two cannot leave a linked subject
    // with an unapplied withdrawal.
    expect(linkFunction.slice(insertAt, revokeAt)).not.toContain("commit")
  })

  it("refuses a subject a purge event was already received for", () => {
    expect(linkFunction).toContain("e.payload ? c_account_purged")
    expect(linkFunction).toContain("'purged_subject'::text")
    // Before anything is written.
    expect(linkFunction.indexOf("'purged_subject'")).toBeLessThan(linkFunction.indexOf("insert into public.cubid_oidc_subjects"))
  })

  it("never moves a subject to another person, and never picks the person itself", () => {
    expect(linkFunction).toContain("'subject_claimed'::text")
    expect(linkFunction).toContain("'user_already_linked'::text")
    // No lookup by email, anywhere: the caller proves who the person is.
    expect(statementsOnly(linkFunction)).not.toContain("email")
    expect(statementsOnly(linkFunction)).not.toContain("auth.users")
  })

  it("is idempotent for the same person", () => {
    expect(linkFunction).toContain("'already_linked'::text")
  })

  it("orders a late withdrawal by the event time, not the delivery time", () => {
    expect(linkFunction).toContain("v_event.event_time is not null and v_authorized_at is not null")
    expect(statementsOnly(linkFunction)).not.toMatch(/issued_at\s*[<>]/)
  })

  it("leaves an unregistered requesting client to the other catch-up path", () => {
    expect(linkFunction).toContain("continue when v_client_id is null")
  })

  it("backfills the events it acted on, so they are explicable from both ends", () => {
    expect(linkFunction).toContain("update public.oauth_security_events")
    expect(linkFunction).toContain("set user_id = p_user_id")
  })

  it("is service-role only and runs with an empty search_path", () => {
    expect(linkFunction).toContain("security invoker")
    expect(linkFunction).toContain("set search_path = ''")
    expect(migration).toContain("revoke all on function public.link_cubid_subject(text, text, uuid) from public, anon, authenticated")
    expect(migration).toContain("grant execute on function public.link_cubid_subject(text, text, uuid) to service_role")
  })

  it("uses no SECURITY DEFINER anywhere, like the rest of this feature", () => {
    expect(statementsOnly(migration)).not.toMatch(/security\s+definer/i)
  })
})

describe("unlink_cubid_subject", () => {
  it("ends the delegated access that was issued against the identity being detached", () => {
    expect(unlinkFunction).toContain("perform 1 from public.oauth_revoke_grant(v_client_id, p_user_id)")
    expect(unlinkFunction).toContain("delete from public.cubid_oidc_subjects")
  })

  it("says so plainly when there was nothing linked", () => {
    expect(unlinkFunction).toContain("'not_linked'::text")
  })

  it("is service-role only", () => {
    expect(migration).toContain("revoke all on function public.unlink_cubid_subject(uuid) from public, anon, authenticated")
    expect(migration).toContain("grant execute on function public.unlink_cubid_subject(uuid) to service_role")
  })
})
