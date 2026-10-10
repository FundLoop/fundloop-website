-- Receiving Cubid Security Event Tokens (#266 stage 2b).
--
-- Stage 2 made a FundLoop access token live fifteen minutes precisely because nothing here could
-- hear about a withdrawal. This is the thing that hears: Cubid pushes an RFC 8417 Security Event
-- Token (RFC 8935 push delivery) when a person withdraws a cross-app consent or deletes their Cubid
-- account, and the receiver kills the matching grants instead of waiting for tokens to expire.
--
-- Contract: ~/src/cubid/cubid-monorepo/docs/engineering/oidc-cross-app-access.md,
-- "Security Event Tokens".
--
-- Design decisions, recorded here because the schema enforces them:
--   * The received event is the unit of idempotency. Its `jti` is the primary key, and the insert
--     happens in the same statement as the revocations it causes, so a committed row means the
--     event was applied and a redelivery is a no-op rather than a second revocation.
--   * An event is recorded even when there is nothing to act on — an unmapped subject, an unknown
--     requesting client, an event type we do not handle. Delivery is retried five times and then
--     marked failed at Cubid, so "verified but not actionable" has to be an acknowledgement, and
--     the row is how an operator can tell that apart from an event that was never delivered.
--   * The event payload is kept verbatim. It is the only evidence of why access ended.
--   * Service-role only, like every other table in this feature: these rows describe credentials.

create table public.oauth_security_events (
  -- RFC 8417 §2.2 gives every SET a unique `jti`. Making it the primary key is what makes a
  -- redelivery idempotent, rather than application code checking first and racing.
  jti text not null primary key check (length(jti) between 1 and 255),
  issuer text not null,
  -- The audience the token was addressed to: FundLoop's client id at Cubid, not the resource
  -- audience an assertion carries.
  audience text not null,
  -- FundLoop's own Cubid pairwise subject for the person, from `sub_id`. Stored as it arrived, so a
  -- row is still explicable after the subject mapping is gone.
  subject text not null,
  user_id uuid references auth.users(id) on delete set null,
  issued_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  -- One entry per event in the token: what it was and what it did here.
  outcomes jsonb not null default '[]'::jsonb
);

create index oauth_security_events_subject_idx on public.oauth_security_events (issuer, subject);
create index oauth_security_events_received_idx on public.oauth_security_events (received_at);

-- Applying a received token, in one statement: the record of receipt *and* every revocation it
-- causes. Split in two, a crash between them would leave the event recorded as applied with access
-- still live, and a redelivery would be refused as a duplicate.
--
-- `p_events` is the token's `events` object, verified upstream. A SET may carry several events
-- (RFC 8417 §2.2), so this loops rather than assuming one.
create or replace function public.oauth_apply_security_event(
  p_jti text,
  p_issuer text,
  p_audience text,
  p_subject text,
  p_issued_at timestamptz,
  p_events jsonb
)
returns table (event_type text, outcome text, affected integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_type text;
  v_claims jsonb;
  v_client_id text;
  v_affected integer;
  v_outcome text;
  v_results jsonb := '[]'::jsonb;
  -- The contract's event type URIs. The URI is the identifier; nothing shorter is.
  c_cross_app_revoked constant text := 'https://schemas.cubid.me/secevent/cross-app-consent-revoked';
  c_consent_revoked constant text := 'https://schemas.cubid.me/secevent/consent-revoked';
  c_account_purged constant text := 'https://schemas.openid.net/secevent/risc/event-type/account-purged';
begin
  select user_id into v_user_id from public.cubid_oidc_subjects
    where issuer = p_issuer and subject = p_subject;

  begin
    insert into public.oauth_security_events (jti, issuer, audience, subject, user_id, issued_at, payload)
    values (p_jti, p_issuer, p_audience, p_subject, v_user_id, p_issued_at, p_events);
  exception when unique_violation then
    -- A committed row means the revocations below already happened, because they commit with it.
    -- A redelivery is therefore an acknowledgement and nothing else.
    return query select null::text, 'duplicate'::text, 0;
    return;
  end;

  for v_type, v_claims in select key, value from pg_catalog.jsonb_each(p_events)
  loop
    v_affected := 0;

    if v_user_id is null then
      -- No mapping, so no access was ever issued for this person here: a grant exists only after a
      -- redemption, which needs a mapping. Nothing to revoke, and inventing a user from an event is
      -- exactly what the pairwise scheme forbids.
      --
      -- What this cannot do is pre-record the withdrawal the way oauth_revoke_grant does for a
      -- known person, because there is nobody to record it against. So if a subject is linked
      -- *after* a revocation arrived for it, an assertion minted before that revocation would be
      -- honoured. Linking (stage 2c) closes that by consulting this table for the subject it is
      -- about to map, which is what the (issuer, subject) index above is for.
      v_outcome := 'unknown_subject';

    elsif v_type = c_cross_app_revoked then
      -- The event names the requesting client by its id *at Cubid*, which need not be its id here.
      -- A retired or disabled client still has grants to kill, so this does not filter on
      -- disabled_at.
      select client_id into v_client_id from public.oauth_clients
        where cubid_client_id = v_claims->>'requesting_client_id';
      if v_client_id is null then
        v_outcome := 'unknown_client';
      else
        perform 1 from public.oauth_revoke_grant(v_client_id, v_user_id);
        v_affected := 1;
        v_outcome := 'revoked';
      end if;

    elsif v_type = c_account_purged then
      -- The Cubid account is gone, so every client's standing access under it ends. Only clients
      -- with a grant row are touched: oauth_revoke_grant would otherwise create a revoked grant for
      -- every registered client, recording relationships that never existed.
      for v_client_id in select client_id from public.oauth_grants where user_id = v_user_id
      loop
        perform 1 from public.oauth_revoke_grant(v_client_id, v_user_id);
        v_affected := v_affected + 1;
      end loop;
      -- The subject no longer identifies anybody at Cubid, so the mapping goes with it: left in
      -- place it would make stage 2c's linking believe this person is still linked, and it points
      -- at an account that cannot authenticate again. The FundLoop user is deliberately untouched —
      -- a Cubid deletion is not a FundLoop deletion, and this event is not authority for one.
      delete from public.cubid_oidc_subjects where issuer = p_issuer and subject = p_subject;
      v_outcome := 'purged';

    elsif v_type = c_consent_revoked then
      -- Reserved by the contract for Login with Cubid withdrawal notices. Cross-app access has its
      -- own event, which is what governs these grants, so acting on this one would be guessing at a
      -- meaning that has not been specified yet.
      v_outcome := 'ignored_reserved';

    else
      -- An event type we do not implement is still acknowledged: retrying it would never start
      -- working, and the row is what tells an operator a new type has started arriving.
      v_outcome := 'ignored_unknown_type';
    end if;

    v_results := v_results || pg_catalog.jsonb_build_object('type', v_type, 'outcome', v_outcome, 'affected', v_affected);
    return query select v_type, v_outcome, v_affected;
  end loop;

  update public.oauth_security_events set outcomes = v_results where jti = p_jti;
end;
$$;

revoke all on function public.oauth_apply_security_event(text, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.oauth_apply_security_event(text, text, text, text, timestamptz, jsonb) to service_role;

alter table public.oauth_security_events enable row level security;
revoke all on table public.oauth_security_events from anon, authenticated;
grant select, insert, update, delete on table public.oauth_security_events to service_role;

-- A received event has to be remembered for as long as a redelivery of it could still arrive, which
-- the verifier bounds at seven days; the rest of the retention is so a revocation stays explicable.
-- Replacing the function rather than adding a second one keeps the retention rule in one place.
drop function if exists public.oauth_purge_expired();

create function public.oauth_purge_expired()
returns table (assertion_jtis_deleted bigint, reserved bigint, tokens_deleted bigint, security_events_deleted bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requests bigint;
  v_codes bigint;
  v_tokens bigint;
  v_events bigint;
begin
  -- A redeemed jti only has to be remembered until the assertion it names could no longer be
  -- replayed; Cubid gives them a five-minute lifetime.
  delete from public.oauth_assertion_jtis where expires_at < now() - interval '1 day';
  get diagnostics v_requests = row_count;
  v_codes := 0;
  delete from public.oauth_tokens where expires_at < now() - interval '30 days' and coalesce(revoked_at, expires_at) < now() - interval '30 days';
  get diagnostics v_tokens = row_count;
  delete from public.oauth_security_events where received_at < now() - interval '180 days';
  get diagnostics v_events = row_count;
  return query select v_requests, v_codes, v_tokens, v_events;
end;
$$;

revoke all on function public.oauth_purge_expired() from public, anon, authenticated;
grant execute on function public.oauth_purge_expired() to service_role;
