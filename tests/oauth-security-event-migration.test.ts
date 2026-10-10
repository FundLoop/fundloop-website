import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  ACCOUNT_PURGED_EVENT,
  CONSENT_REVOKED_EVENT,
  CROSS_APP_CONSENT_REVOKED_EVENT,
} from "@/lib/cross-app/secevent"

// The Security Event Token receiver's schema contract (#266 stage 2b).
//
// CI applies this migration against a fresh schema, so this file is not here to prove it runs. It
// is here to hold the decisions the SQL encodes, which a later edit could quietly undo while still
// applying cleanly: the idempotency key, the one-statement application, and who may execute it.

const migration = readFileSync("supabase/migrations/20261010050000_oauth_security_event_receiver.sql", "utf8")
const applyFunction = migration.slice(
  migration.indexOf("create or replace function public.oauth_apply_security_event"),
  migration.indexOf("revoke all on function public.oauth_apply_security_event"),
)
const redeemFunction = migration.slice(
  migration.indexOf("create or replace function public.oauth_redeem_grant"),
  migration.indexOf("-- Applying a received token"),
)
const catchUpFunction = migration.slice(
  migration.indexOf("create or replace function public.oauth_apply_pending_revocations_for_client"),
  migration.indexOf("revoke all on function public.oauth_apply_pending_revocations_for_client"),
)

describe("oauth_security_events", () => {
  it("makes the token's own jti the primary key, so a redelivery collides instead of repeating", () => {
    expect(migration).toContain("jti text not null primary key")
  })

  it("keeps the payload and the per-event outcomes, because they are the only record of why access ended", () => {
    expect(migration).toContain("payload jsonb not null")
    expect(migration).toContain("outcomes jsonb not null default '[]'::jsonb")
  })

  it("keeps the subject even after the mapping is gone", () => {
    expect(migration).toContain("subject text not null")
    expect(migration).toContain("user_id uuid references auth.users(id) on delete set null")
  })

  it("is service-role only, like every other table holding credentials", () => {
    expect(migration).toContain("alter table public.oauth_security_events enable row level security")
    expect(migration).toContain("revoke all on table public.oauth_security_events from anon, authenticated")
    expect(migration).toContain("grant select, insert, update, delete on table public.oauth_security_events to service_role")
  })

  it("indexes the subject, which is how linking will find an earlier revocation for it", () => {
    expect(migration).toContain("create index oauth_security_events_subject_idx on public.oauth_security_events (issuer, subject)")
  })
})

describe("oauth_apply_security_event", () => {
  it("names the contract's event types exactly as the verifier does", () => {
    expect(applyFunction).toContain(`c_cross_app_revoked constant text := '${CROSS_APP_CONSENT_REVOKED_EVENT}'`)
    expect(applyFunction).toContain(`c_consent_revoked constant text := '${CONSENT_REVOKED_EVENT}'`)
    expect(applyFunction).toContain(`c_account_purged constant text := '${ACCOUNT_PURGED_EVENT}'`)
  })

  it("records the receipt inside the same statement as the revocations it causes", () => {
    expect(applyFunction).toContain("insert into public.oauth_security_events")
    expect(applyFunction).toContain("perform 1 from public.oauth_revoke_grant(v_client_id, v_user_id)")
  })

  it("treats a duplicate jti as already applied and stops there", () => {
    expect(applyFunction).toContain("exception when unique_violation then")
    expect(applyFunction).toMatch(/exception when unique_violation then[\s\S]*'duplicate'::text/)
  })

  it("loops, because a token may carry several events", () => {
    expect(applyFunction).toContain("for v_type, v_claims in select key, value from pg_catalog.jsonb_each(p_events)")
  })

  it("resolves the requesting client by its Cubid id and does not skip a disabled one", () => {
    const lookup = applyFunction.slice(
      applyFunction.indexOf("select client_id into v_client_id"),
      applyFunction.indexOf(";", applyFunction.indexOf("select client_id into v_client_id")),
    )
    expect(lookup).toContain("from public.oauth_clients")
    expect(lookup).toContain("where cubid_client_id = v_claims->>'requesting_client_id'")
    // A retired or suspended client still has grants to kill, so the lookup must not filter it out.
    expect(lookup).not.toContain("disabled_at")
  })

  it("purges only clients that hold a grant, so no relationship is invented", () => {
    expect(applyFunction).toContain("for v_client_id in select client_id from public.oauth_grants where user_id = v_user_id")
  })

  it("drops the subject mapping on a purge, and leaves the FundLoop user alone", () => {
    expect(applyFunction).toContain("delete from public.cubid_oidc_subjects where issuer = p_issuer and subject = p_subject")
    expect(applyFunction).not.toContain("delete from auth.users")
  })

  it("acknowledges an unmapped subject, a reserved type and an unknown type rather than failing", () => {
    for (const outcome of ["'unknown_subject'", "'unknown_client'", "'ignored_reserved'", "'ignored_unknown_type'"]) {
      expect(applyFunction).toContain(outcome)
    }
  })

  it("is executable by the service role only", () => {
    const signature = "public.oauth_apply_security_event(text, text, text, text, timestamptz, timestamptz, jsonb)"
    expect(migration).toContain(`revoke all on function ${signature} from public, anon, authenticated`)
    expect(migration).toContain(`grant execute on function ${signature} to service_role`)
  })

  it("runs with an empty search_path, like every other function in this feature", () => {
    expect(applyFunction).toContain("set search_path = ''")
  })
})

describe("ordering a late event against the current authorization", () => {
  it("records when a grant was last authorized, in the issuer's clock", () => {
    expect(migration).toContain("alter table public.oauth_grants add column last_assertion_issued_at timestamptz")
    expect(redeemFunction).toContain("last_assertion_issued_at = greatest(")
  })

  it("never lowers that time, so a late assertion cannot make a stale revocation apply again", () => {
    expect(redeemFunction).toContain("coalesce(v_grant.last_assertion_issued_at, p_assertion_issued_at)")
  })

  it("orders by the event time, not by the delivery time", () => {
    // The whole point. Cubid re-signs every delivery attempt, so the token's `iat` is always later
    // than any redemption that preceded it: ordering by it would never fire while looking as though
    // it did. Ordering is by RFC 8417 `toe`, which Cubid does not send yet.
    expect(applyFunction).toContain("if p_event_time is not null and v_authorized_at is not null and p_event_time < v_authorized_at then")
    expect(applyFunction).toContain("'superseded'")
  })

  it("stores the delivery time and the event time as separate things", () => {
    expect(migration).toContain("issued_at timestamptz not null")
    expect(migration).toContain("event_time timestamptz")
    expect(applyFunction).toContain("p_event_time")
  })

  it("never compares the delivery timestamp against anything, in either function", () => {
    // A regression guard for exactly the premise error this ordering logic was first built on.
    for (const body of [applyFunction, catchUpFunction]) {
      for (const comparison of [/p_issued_at\s*[<>]/, /[<>]\s*p_issued_at/, /\.issued_at\s*[<>]/, /[<>]\s*\w+\.issued_at/]) {
        expect(body).not.toMatch(comparison)
      }
    }
  })

  it("applies the withdrawal when there is no event time to order by", () => {
    // `p_event_time is not null` leads the condition, so a null falls through to the revocation
    // rather than skipping it. Failing open here would mean no withdrawal ever applied.
    const guard = applyFunction.slice(applyFunction.indexOf("if p_event_time is not null"))
    expect(guard.indexOf("'superseded'")).toBeLessThan(guard.indexOf("'revoked'"))
    expect(guard).toContain("else")
  })

  it("compares against a live grant only, so a tombstone is still recorded when there is none", () => {
    const lookup = applyFunction.slice(
      applyFunction.indexOf("select last_assertion_issued_at into v_authorized_at"),
      applyFunction.indexOf(";", applyFunction.indexOf("select last_assertion_issued_at into v_authorized_at")),
    )
    expect(lookup).toContain("revoked_at is null")
  })

  it("does not apply the guard to an account purge, which cannot be superseded", () => {
    const purgeBranch = applyFunction.slice(
      applyFunction.indexOf("elsif v_type = c_account_purged"),
      applyFunction.indexOf("elsif v_type = c_consent_revoked"),
    )
    expect(purgeBranch).not.toContain("v_authorized_at")
  })
})

describe("oauth_apply_pending_revocations_for_client", () => {
  it("exists, because a client can be registered after a revocation for it arrived", () => {
    expect(catchUpFunction).toContain("create or replace function public.oauth_apply_pending_revocations_for_client(p_cubid_client_id text)")
  })

  it("finds the events by the requesting client id inside the stored payload", () => {
    expect(catchUpFunction).toContain("e.payload -> c_cross_app_revoked ->> 'requesting_client_id' = p_cubid_client_id")
  })

  it("resolves the subject again rather than trusting the user recorded at receipt", () => {
    expect(catchUpFunction).toContain("from public.cubid_oidc_subjects s")
    expect(catchUpFunction).toContain("coalesce(v_user_id, v_event.recorded_user_id)")
  })

  it("applies the same ordering guard as live delivery, from the stored event time", () => {
    expect(catchUpFunction).toContain("select e.issuer, e.subject, e.user_id as recorded_user_id, e.event_time")
    expect(catchUpFunction).toContain("if v_event.event_time is not null and v_authorized_at is not null and v_event.event_time < v_authorized_at then")
    expect(catchUpFunction).toContain("'superseded'::text")
  })

  it("refuses to run for a Cubid client this deployment does not know", () => {
    expect(catchUpFunction).toContain("raise exception 'no local client is registered for Cubid client %'")
  })

  it("names its output columns apart from the columns it reads", () => {
    // Output columns of a RETURNS TABLE function are plpgsql variables, so `subject` or `user_id`
    // would make every unqualified read of those columns ambiguous at execution time.
    expect(catchUpFunction).toContain("returns table (event_subject text, applied_user_id uuid, outcome text)")
  })

  it("is executable by the service role only", () => {
    const signature = "public.oauth_apply_pending_revocations_for_client(text)"
    expect(migration).toContain(`revoke all on function ${signature} from public, anon, authenticated`)
    expect(migration).toContain(`grant execute on function ${signature} to service_role`)
  })
})

describe("oauth_purge_expired", () => {
  it("keeps received events long enough to outlast any redelivery of them", () => {
    expect(migration).toContain("delete from public.oauth_security_events where received_at < now() - interval '180 days'")
    expect(migration).toContain("security_events_deleted bigint")
  })

  it("replaces the previous definition rather than adding a second retention rule", () => {
    expect(migration).toContain("drop function if exists public.oauth_purge_expired()")
  })
})
