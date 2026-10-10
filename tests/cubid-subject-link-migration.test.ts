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
// Both already exist and are replaced here, each for one added rule.
const REDEEM_START = "create function public.oauth_redeem_grant"
const replacedReceiver = migration.slice(
  migration.indexOf("create or replace function public.oauth_apply_security_event"),
  migration.indexOf("drop function if exists public.oauth_redeem_grant"),
)
const replacedRedeem = migration.slice(migration.indexOf(REDEEM_START))

const SUBJECT_LOCK = "pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cubid_subject:'"

// A mis-anchored slice comes back as an empty string, and every `toContain` on it then fails in a
// way that looks like the SQL changed. Checking the slices are non-trivial first makes the real
// cause obvious.
describe("the slices these assertions read", () => {
  it.each([
    ["link", linkFunction],
    ["unlink", unlinkFunction],
    ["replaced receiver", replacedReceiver],
    ["replaced redemption", replacedRedeem],
  ])("found the %s function", (_name, body) => {
    expect(body.length).toBeGreaterThan(200)
    expect(body).toContain("language plpgsql")
  })
})

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

describe("serializing every write about one subject", () => {
  it("takes the same lock in linking, unlinking and event receipt", () => {
    // Without it the receiver can read "no mapping" while linking reads "no events", and both then
    // write — leaving a linked subject with an unapplied withdrawal, which is the state criterion 7
    // exists to prevent.
    for (const body of [linkFunction, unlinkFunction, replacedReceiver]) {
      expect(body).toContain(SUBJECT_LOCK)
    }
  })

  it("takes it before reading anything", () => {
    for (const body of [linkFunction, replacedReceiver]) {
      const lockAt = body.indexOf(SUBJECT_LOCK)
      const firstRead = body.indexOf("from public.", body.indexOf("begin"))
      expect(lockAt).toBeGreaterThan(0)
      expect(lockAt).toBeLessThan(firstRead)
    }
  })
})

describe("making a disconnect final", () => {
  it("locks every grant the person has, not only the live ones", () => {
    // A redemption that read the mapping before the unlink could otherwise resume afterwards and
    // revive an already-revoked grant, because an assertion minted after the stale `revoked_at` is
    // normally grounds for revival.
    expect(unlinkFunction).toContain("perform 1 from public.oauth_grants g where g.user_id = p_user_id for update")
  })

  it("locks them before deleting the mapping", () => {
    expect(unlinkFunction.indexOf("for update")).toBeLessThan(unlinkFunction.indexOf("delete from public.cubid_oidc_subjects"))
  })

  it("makes redemption require the exact mapping the assertion names", () => {
    // Not merely "this person has some Cubid identity": somebody who disconnected one identity and
    // linked another would otherwise have an assertion from the old one honoured, because the grant
    // row survives an unlink.
    expect(replacedRedeem).toContain("where s.user_id = p_user_id and s.issuer = p_issuer and s.subject = p_subject")
    expect(replacedRedeem).toContain("'unlinked'::text")
  })

  it("takes the subject lock in redemption too, because a first redemption has no row to lock", () => {
    // The grant row lock cannot serialize a disconnect against a client's *first* redemption: there
    // is no grant row yet, so the mapping could be read from a pre-delete snapshot.
    expect(replacedRedeem).toContain(SUBJECT_LOCK)
    expect(replacedRedeem.indexOf(SUBJECT_LOCK)).toBeLessThan(replacedRedeem.indexOf("for update"))
  })

  it("is dropped and re-created, because the parameter list changed", () => {
    expect(migration).toContain("drop function if exists public.oauth_redeem_grant(text, uuid, public.oauth_scope[], timestamptz, text, public.oauth_scope[], timestamptz, text)")
    // A dropped function loses its grants, so they are re-stated rather than assumed.
    const signature =
      "public.oauth_redeem_grant(text, uuid, public.oauth_scope[], timestamptz, text, public.oauth_scope[], timestamptz, text, text, text)"
    expect(migration).toContain(`revoke all on function ${signature} from public, anon, authenticated`)
    expect(migration).toContain(`grant execute on function ${signature} to service_role`)
  })

  it("re-reads the mapping under the lock when unlinking, since the first read cannot be locked", () => {
    // The lock is keyed on the subject and the subject is only knowable from the mapping, so the
    // first read is necessarily unlocked. Re-reading under the lock is what makes that harmless.
    const afterLock = unlinkFunction.slice(unlinkFunction.indexOf(SUBJECT_LOCK))
    expect(afterLock).toContain("select 1 from public.cubid_oidc_subjects s")
    expect(afterLock).toContain("s.user_id = p_user_id and s.issuer = v_issuer and s.subject = v_subject")
    expect(afterLock.indexOf("select 1 from public.cubid_oidc_subjects")).toBeLessThan(afterLock.indexOf("for update"))
  })

  it("keeps the rest of the redemption rules it already had", () => {
    // Replaced for one added rule, so everything the two earlier reviews settled must still be here.
    expect(replacedRedeem).toContain("last_assertion_issued_at = greatest(")
    expect(replacedRedeem).toContain("p_assertion_issued_at <= v_grant.revoked_at + v_skew")
    expect(replacedRedeem).toContain("exception when unique_violation then")
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
