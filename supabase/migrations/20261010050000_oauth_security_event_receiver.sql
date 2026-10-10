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
  -- The token's `iat`: when the issuer signed *this delivery attempt*, not when the event happened.
  issued_at timestamptz not null,
  -- RFC 8417 `toe`, when the event happened, when the issuer provides it. Null today.
  event_time timestamptz,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  -- One entry per event in the token: what it was and what it did here.
  outcomes jsonb not null default '[]'::jsonb
);

create index oauth_security_events_subject_idx on public.oauth_security_events (issuer, subject);
create index oauth_security_events_received_idx on public.oauth_security_events (received_at);

-- When a grant was last authorized, in the issuer's own clock: the `iat` of the newest assertion
-- redeemed for it. `revoked_at` cannot answer that question — it is our clock, and it records when
-- we acted, not when the authorization happened.
--
-- It exists so a late revocation can be ordered against the authorization it would undo: delivery
-- retries run 1, 5, 30, 120 and 720 minutes, so a withdrawal can arrive long after the person
-- reversed it by consenting again, and applying the stale one revokes live, legitimate access.
--
-- Ordering needs the time the *event* happened, which is RFC 8417's optional `toe` claim. Cubid
-- re-signs every delivery attempt, so the token's `iat` is when that attempt was sent and is later
-- than anything it could usefully be compared with; it does not send `toe` yet. So the comparison
-- below is dormant, and until the contract carries an event time a late retry does revoke
-- re-consented access. See `docs/engineering/cubid-cross-app-access.md`, "Ordering a late
-- revocation", for the residual risk and why it is self-correcting.
alter table public.oauth_grants add column last_assertion_issued_at timestamptz;

-- Replaced to record it. Everything else is the definition from 20261010040000.
create or replace function public.oauth_redeem_grant(
  p_client_id text,
  p_user_id uuid,
  p_assertion_scopes public.oauth_scope[],
  p_assertion_issued_at timestamptz,
  p_token_sha256 text,
  p_token_scopes public.oauth_scope[],
  p_token_expires_at timestamptz,
  p_assertion_jti text
)
returns table (grant_id bigint, outcome text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_grant public.oauth_grants;
  v_skew constant interval := interval '30 seconds';
begin
  loop
    -- FOR UPDATE serialises every redemption for this client and person.
    select * into v_grant from public.oauth_grants
      where client_id = p_client_id and user_id = p_user_id
      for update;
    exit when found;

    begin
      insert into public.oauth_grants (client_id, user_id, scopes)
      values (p_client_id, p_user_id, p_assertion_scopes)
      returning * into v_grant;
      exit;
    exception when unique_violation then
      -- Another redemption inserted it first; go back and lock that row instead of failing.
    end;
  end loop;

  if v_grant.revoked_at is not null and p_assertion_issued_at <= v_grant.revoked_at + v_skew then
    -- Predates the withdrawal, so it is not evidence that consent is live now. The skew margin
    -- errs towards refusing, because the two timestamps come from different clocks.
    return query select v_grant.id, 'withdrawn'::text;
    return;
  end if;

  -- Reviving a revoked grant starts a fresh set of tokens: a credential issued under the previous
  -- authorization must not keep acting under this one.
  --
  -- Narrowing is deliberately *not* a trigger here. Under the contract an assertion's `scope` is
  -- what the client requested for that exchange, not the person's standing consent, so a client
  -- asking for less in one call would otherwise revoke the tokens of its own parallel calls.
  -- Consent narrowing at Cubid is not observable by a resource app; the short token lifetime is
  -- what bounds it.
  if v_grant.revoked_at is not null then
    update public.oauth_tokens set revoked_at = now()
      where oauth_tokens.grant_id = v_grant.id and oauth_tokens.revoked_at is null;
  end if;

  update public.oauth_grants
    set scopes = p_assertion_scopes,
        revoked_at = null,
        updated_at = now(),
        -- Monotonic: an assertion that arrives late and out of order must not lower the recorded
        -- authorization time, or a stale revocation would start applying again.
        last_assertion_issued_at = greatest(
          coalesce(v_grant.last_assertion_issued_at, p_assertion_issued_at),
          p_assertion_issued_at
        )
    where id = v_grant.id;

  insert into public.oauth_tokens (token_sha256, token_type, client_id, user_id, grant_id, scopes, issued_from_assertion_jti, expires_at)
  values (p_token_sha256, 'access', p_client_id, p_user_id, v_grant.id, p_token_scopes, p_assertion_jti, p_token_expires_at);

  return query select v_grant.id, 'issued'::text;
end;
$$;

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
  p_event_time timestamptz,
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
  v_authorized_at timestamptz;
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
    insert into public.oauth_security_events (jti, issuer, audience, subject, user_id, issued_at, event_time, payload)
    values (p_jti, p_issuer, p_audience, p_subject, v_user_id, p_issued_at, p_event_time, p_events);
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
        -- An event that happened before the assertion currently authorizing this grant describes a
        -- withdrawal the person has since reversed by consenting again, and applying it would
        -- revoke live, legitimate access. Both times are the issuer's clock — `toe` and the
        -- assertion's `iat` — so they compare directly with no skew margin, and equal times revoke
        -- because ending access is the safe direction when the order is genuinely ambiguous.
        --
        -- `p_event_time` is null whenever the issuer sends no `toe`, which is every delivery today,
        -- and then there is nothing to order by and the withdrawal is applied. The token's `iat` is
        -- deliberately *not* used as a stand-in: it is re-minted on every delivery attempt, so it
        -- is always later than any redemption that preceded it and the comparison would never fire
        -- while looking as though it did.
        select last_assertion_issued_at into v_authorized_at from public.oauth_grants
          where client_id = v_client_id and user_id = v_user_id and revoked_at is null;
        if p_event_time is not null and v_authorized_at is not null and p_event_time < v_authorized_at then
          v_outcome := 'superseded';
        else
          perform 1 from public.oauth_revoke_grant(v_client_id, v_user_id);
          v_affected := 1;
          v_outcome := 'revoked';
        end if;
      end if;

    elsif v_type = c_account_purged then
      -- The Cubid account is gone, so every client's standing access under it ends. No ordering
      -- guard here, unlike a consent withdrawal: a deleted account cannot consent again, so a
      -- purge is never superseded, and erring towards keeping access alive for an account that no
      -- longer exists is the wrong direction. Only clients
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

revoke all on function public.oauth_apply_security_event(text, text, text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.oauth_apply_security_event(text, text, text, text, timestamptz, timestamptz, jsonb) to service_role;

-- Catching up a client that was registered *after* a revocation for it arrived.
--
-- A revocation names its requesting client by the client's id at Cubid, and this deployment learns
-- that id only when an operator inserts the `oauth_clients` row — the contract has no dynamic
-- registration. A withdrawal that arrives before that insert is recorded as `unknown_client` and
-- revokes nothing, because there is no local client to revoke anything for. Once the row exists,
-- an assertion minted before that withdrawal would create a fresh grant and be honoured, exactly
-- the hole `oauth_revoke_grant`'s tombstone normally closes.
--
-- So registering a client is two steps, and this is the second: run it right after the insert.
-- `docs/engineering/cubid-cross-app-access.md` says so where registration is documented.
--
-- Safe to run more than once: it ends in `oauth_revoke_grant`, which is idempotent, and it applies
-- the same ordering guard as live delivery so a withdrawal the person has since reversed is left
-- alone.
create or replace function public.oauth_apply_pending_revocations_for_client(p_cubid_client_id text)
returns table (event_subject text, applied_user_id uuid, outcome text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client_id text;
  v_event record;
  v_user_id uuid;
  v_authorized_at timestamptz;
  c_cross_app_revoked constant text := 'https://schemas.cubid.me/secevent/cross-app-consent-revoked';
begin
  select oauth_clients.client_id into v_client_id from public.oauth_clients
    where oauth_clients.cubid_client_id = p_cubid_client_id;
  if v_client_id is null then
    raise exception 'no local client is registered for Cubid client %', p_cubid_client_id;
  end if;

  for v_event in
    select e.issuer, e.subject, e.user_id as recorded_user_id, e.event_time
      from public.oauth_security_events e
      where e.payload -> c_cross_app_revoked ->> 'requesting_client_id' = p_cubid_client_id
      order by e.received_at
  loop
    -- The subject may have been linked since the event was received, so resolve it again rather
    -- than trusting the user recorded at receipt.
    select s.user_id into v_user_id from public.cubid_oidc_subjects s
      where s.issuer = v_event.issuer and s.subject = v_event.subject;
    v_user_id := coalesce(v_user_id, v_event.recorded_user_id);

    if v_user_id is null then
      -- Still nobody. Linking is where this one gets applied; see criterion 7 on #275.
      return query select v_event.subject, null::uuid, 'unknown_subject'::text;
      continue;
    end if;

    -- The same ordering rule as live delivery, and the same dormancy: `event_time` is null until
    -- the issuer sends `toe`, and a null orders nothing.
    select g.last_assertion_issued_at into v_authorized_at from public.oauth_grants g
      where g.client_id = v_client_id and g.user_id = v_user_id and g.revoked_at is null;
    if v_event.event_time is not null and v_authorized_at is not null and v_event.event_time < v_authorized_at then
      return query select v_event.subject, v_user_id, 'superseded'::text;
      continue;
    end if;

    perform 1 from public.oauth_revoke_grant(v_client_id, v_user_id);
    update public.oauth_security_events
      set user_id = v_user_id
      where oauth_security_events.issuer = v_event.issuer
        and oauth_security_events.subject = v_event.subject
        and oauth_security_events.user_id is null;
    return query select v_event.subject, v_user_id, 'revoked'::text;
  end loop;
end;
$$;

revoke all on function public.oauth_apply_pending_revocations_for_client(text) from public, anon, authenticated;
grant execute on function public.oauth_apply_pending_revocations_for_client(text) to service_role;

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
