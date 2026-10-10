-- Linking a Cubid pairwise subject to a FundLoop user (#275, stage 2c).
--
-- `cubid_oidc_subjects` is what makes delegated access work at all: an identity assertion carries
-- only Cubid's pairwise subject for FundLoop, so without a row here a valid assertion maps to
-- nobody. Stage 2 created the table and never wrote to it. This is the only thing that writes it.
--
-- One function, because linking is not just an insert. #279's event receiver cannot apply a
-- withdrawal for a subject nobody has linked yet — there is no user to record it against — so it
-- stores the event and nothing else. Mapping that subject afterwards is the moment those events
-- become applicable, and if the mapping were written without applying them, an identity assertion
-- minted *before* the withdrawal would create a fresh grant and be honoured. That is acceptance
-- criterion 7 on #275, and it is enforced here rather than in a route handler so a second caller
-- cannot forget it.
--
-- Design decisions, recorded here because the function enforces them:
--   * Linking and event receipt serialize on the subject. Without that they race: the receiver can
--     read "no mapping", this function can read "no events", and both then write — leaving a linked
--     subject with an unapplied withdrawal, which is precisely the state criterion 7 exists to
--     prevent. A transaction-scoped advisory lock on (issuer, subject) is taken by both, and
--     `oauth_apply_security_event` is replaced below to take it too.
--   * Linking never creates or chooses a user. The caller proves who the person is — by holding
--     their session, or by having just created the account — and passes the id.
--   * A subject that a purge event has already been received for is refused outright. The Cubid
--     account behind it is gone, and a new Cubid account would be a new pairwise subject, so the
--     subject arriving again is a contradiction rather than a returning person.
--   * The mapping and the revocations commit together. Split in two, a crash between them leaves a
--     linked subject with a withdrawal unapplied, which is exactly the hole this closes.
--   * No SECURITY DEFINER, like the rest of this feature. The caller is the service role.

create or replace function public.link_cubid_subject(
  p_issuer text,
  p_subject text,
  p_user_id uuid
)
returns table (outcome text, revoked_clients integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_user uuid;
  v_existing_subject text;
  v_event record;
  v_client_id text;
  v_authorized_at timestamptz;
  v_revoked integer := 0;
  c_cross_app_revoked constant text := 'https://schemas.cubid.me/secevent/cross-app-consent-revoked';
  c_account_purged constant text := 'https://schemas.openid.net/secevent/risc/event-type/account-purged';
begin
  -- Serialize every write about this subject, before reading anything. hashtextextended can
  -- collide, which costs an unrelated subject a short wait and never costs correctness.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cubid_subject:' || p_issuer || ':' || p_subject, 0));

  -- A purged subject is not linkable, whoever asks.
  if exists (
    select 1 from public.oauth_security_events e
      where e.issuer = p_issuer and e.subject = p_subject
        and e.payload ? c_account_purged
  ) then
    return query select 'purged_subject'::text, 0;
    return;
  end if;

  select s.user_id into v_existing_user from public.cubid_oidc_subjects s
    where s.issuer = p_issuer and s.subject = p_subject;
  if v_existing_user is not null then
    -- Idempotent for the same person; a refusal for anyone else. Moving a subject to another user
    -- would hand one person's delegated access to another.
    return query select case when v_existing_user = p_user_id then 'already_linked'::text else 'subject_claimed'::text end, 0;
    return;
  end if;

  select s.subject into v_existing_subject from public.cubid_oidc_subjects s
    where s.issuer = p_issuer and s.user_id = p_user_id;
  if v_existing_subject is not null then
    -- One Cubid identity per person per issuer, which the table's own unique constraint also says.
    return query select 'user_already_linked'::text, 0;
    return;
  end if;

  begin
    insert into public.cubid_oidc_subjects (issuer, subject, user_id, last_seen_at)
    values (p_issuer, p_subject, p_user_id, now());
  exception when unique_violation then
    -- A concurrent link won. Both unique constraints land here, and the caller should re-read
    -- rather than be told which; the checks above give the specific answer in the common case.
    return query select 'conflict'::text, 0;
    return;
  end;

  -- Criterion 7. Every withdrawal already received for this subject is applied now, in this
  -- statement, so there is no window in which the subject is linked and the withdrawal is not.
  for v_event in
    select e.jti, e.event_time, e.payload -> c_cross_app_revoked ->> 'requesting_client_id' as cubid_client_id
      from public.oauth_security_events e
      where e.issuer = p_issuer and e.subject = p_subject
        and e.payload ? c_cross_app_revoked
      order by e.received_at
  loop
    select c.client_id into v_client_id from public.oauth_clients c
      where c.cubid_client_id = v_event.cubid_client_id;
    -- An unregistered requesting client has nothing to revoke here; registering it runs
    -- oauth_apply_pending_revocations_for_client, which covers that case from the other side.
    continue when v_client_id is null;

    -- The same ordering rule as live delivery, and the same dormancy: `event_time` is RFC 8417
    -- `toe`, which Cubid does not send yet, and a null orders nothing.
    select g.last_assertion_issued_at into v_authorized_at from public.oauth_grants g
      where g.client_id = v_client_id and g.user_id = p_user_id and g.revoked_at is null;
    continue when v_event.event_time is not null and v_authorized_at is not null
      and v_event.event_time < v_authorized_at;

    perform 1 from public.oauth_revoke_grant(v_client_id, p_user_id);
    v_revoked := v_revoked + 1;
  end loop;

  -- The events are now explicable from both ends.
  update public.oauth_security_events
    set user_id = p_user_id
    where oauth_security_events.issuer = p_issuer
      and oauth_security_events.subject = p_subject
      and oauth_security_events.user_id is null;

  return query select 'linked'::text, v_revoked;
end;
$$;

revoke all on function public.link_cubid_subject(text, text, uuid) from public, anon, authenticated;
grant execute on function public.link_cubid_subject(text, text, uuid) to service_role;

-- Unlinking, for a person disconnecting Cubid from their account settings. It is deliberately not
-- the inverse of linking: the grants a requesting client holds are not FundLoop's to keep alive
-- once the identity they were issued against is detached, so they end with the link.
--
-- Every grant for the person is locked, not only the live ones. A redemption that had already read
-- the subject mapping could otherwise resume after the mapping was deleted and revive an
-- *already revoked* grant, because `oauth_redeem_grant` allows revival for an assertion minted
-- after the recorded `revoked_at` — which is the right rule for a withdrawal the person reversed
-- and the wrong one for an identity they detached. Locking them all makes that redemption wait,
-- and `oauth_redeem_grant` is replaced below to require a live mapping, so when it resumes there is
-- none and it refuses.
create or replace function public.unlink_cubid_subject(p_user_id uuid)
returns table (outcome text, revoked_clients integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_issuer text;
  v_subject text;
  v_client_id text;
  v_revoked integer := 0;
begin
  -- The lock is keyed on the subject, and the subject is only knowable by reading the mapping, so
  -- this first read is necessarily unlocked. That is made harmless by re-reading under the lock
  -- below: anything that changed in between is seen there, and nothing has been written yet.
  select s.issuer, s.subject into v_issuer, v_subject
    from public.cubid_oidc_subjects s where s.user_id = p_user_id;
  if v_subject is null then
    return query select 'not_linked'::text, 0;
    return;
  end if;

  -- The same lock linking, redemption and event receipt take, so none of them can interleave.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cubid_subject:' || v_issuer || ':' || v_subject, 0));

  -- Re-read under the lock. If the mapping moved, was replaced, or is already gone, this call is
  -- acting on a state that no longer exists and must not revoke anybody's grants for it.
  if not exists (
    select 1 from public.cubid_oidc_subjects s
      where s.user_id = p_user_id and s.issuer = v_issuer and s.subject = v_subject
  ) then
    return query select 'conflict'::text, 0;
    return;
  end if;

  -- Every grant, revoked or not: the lock is the point, so a concurrent redemption of any of them
  -- waits for the mapping to be gone.
  perform 1 from public.oauth_grants g where g.user_id = p_user_id for update;

  for v_client_id in select g.client_id from public.oauth_grants g
    where g.user_id = p_user_id and g.revoked_at is null
  loop
    perform 1 from public.oauth_revoke_grant(v_client_id, p_user_id);
    v_revoked := v_revoked + 1;
  end loop;

  delete from public.cubid_oidc_subjects where cubid_oidc_subjects.user_id = p_user_id;
  return query select 'unlinked'::text, v_revoked;
end;
$$;

revoke all on function public.unlink_cubid_subject(uuid) from public, anon, authenticated;
grant execute on function public.unlink_cubid_subject(uuid) to service_role;

-- Replaced, not re-created: both functions below already exist, and the change is one rule each.
--
-- `oauth_apply_security_event` (#279) now takes the same subject lock this migration's linking
-- takes, because the two race otherwise — see the note at the top of this file.
--
-- `oauth_redeem_grant` (#273) now refuses an assertion for a person with no Cubid mapping. Deleting
-- the mapping is what disconnecting means, and without this check a redemption that read the
-- mapping a moment earlier could still revive a grant afterwards.
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
  -- Serialize with linking and unlinking, before reading anything. Without it, this function can
  -- read "no mapping" while `link_cubid_subject` reads "no events", and both then write — leaving a
  -- linked subject with an unapplied withdrawal, exactly the state criterion 7 exists to prevent.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cubid_subject:' || p_issuer || ':' || p_subject, 0));

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

-- Dropped rather than replaced: it takes the assertion's issuer and subject now, and a new
-- parameter list is a new function. Nothing but `lib/oauth/store.ts` calls it.
drop function if exists public.oauth_redeem_grant(text, uuid, public.oauth_scope[], timestamptz, text, public.oauth_scope[], timestamptz, text);

create function public.oauth_redeem_grant(
  p_client_id text,
  p_user_id uuid,
  p_assertion_scopes public.oauth_scope[],
  p_assertion_issued_at timestamptz,
  p_token_sha256 text,
  p_token_scopes public.oauth_scope[],
  p_token_expires_at timestamptz,
  p_assertion_jti text,
  p_issuer text,
  p_subject text
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
  -- Serialize with linking, unlinking and event receipt before reading anything, including before
  -- the grant row is locked: a first redemption has no grant row to lock, so the row lock alone
  -- leaves a window in which a disconnect commits unseen.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cubid_subject:' || p_issuer || ':' || p_subject, 0));

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

  -- The exact mapping the assertion names, not merely "this person has some Cubid identity". A
  -- person who disconnected one identity and linked another would otherwise have an assertion from
  -- the old one honoured, because a grant row survives an unlink and the newer mapping would
  -- satisfy a looser check.
  --
  -- The row lock above is not enough on its own: on a client's *first* redemption there is no grant
  -- row for a concurrent unlink to have locked, so without the subject lock at the top of this
  -- function the mapping could be read from a snapshot taken before the delete committed, and a
  -- token would be issued after the disconnect. `account-purged` deletes the mapping the same way.
  if not exists (
    select 1 from public.cubid_oidc_subjects s
      where s.user_id = p_user_id and s.issuer = p_issuer and s.subject = p_subject
  ) then
    return query select v_grant.id, 'unlinked'::text;
    return;
  end if;

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

revoke all on function public.oauth_redeem_grant(text, uuid, public.oauth_scope[], timestamptz, text, public.oauth_scope[], timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.oauth_redeem_grant(text, uuid, public.oauth_scope[], timestamptz, text, public.oauth_scope[], timestamptz, text, text, text) to service_role;
