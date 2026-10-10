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
    const signature = "public.oauth_apply_security_event(text, text, text, text, timestamptz, jsonb)"
    expect(migration).toContain(`revoke all on function ${signature} from public, anon, authenticated`)
    expect(migration).toContain(`grant execute on function ${signature} to service_role`)
  })

  it("runs with an empty search_path, like every other function in this feature", () => {
    expect(applyFunction).toContain("set search_path = ''")
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
