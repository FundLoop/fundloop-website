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
create or replace function public.unlink_cubid_subject(p_user_id uuid)
returns table (outcome text, revoked_clients integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subject text;
  v_client_id text;
  v_revoked integer := 0;
begin
  select s.subject into v_subject from public.cubid_oidc_subjects s where s.user_id = p_user_id;
  if v_subject is null then
    return query select 'not_linked'::text, 0;
    return;
  end if;

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
