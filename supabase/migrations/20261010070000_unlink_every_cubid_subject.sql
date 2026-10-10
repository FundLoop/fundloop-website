-- Disconnecting Cubid, for every issuer the person is mapped under (#275, stage 2c UI).
--
-- `unlink_cubid_subject` read one mapping for the person, took the advisory lock for *that*
-- subject, and then deleted every mapping they had. The schema allows one mapping per
-- (issuer, user_id), so more than one issuer is representable — a staging issuer alongside
-- production, or an issuer migration — and under the old function a concurrent first redemption
-- against an unlocked second mapping could validate it and issue a token after the disconnect had
-- deleted it. The lock has to cover every subject being removed, not one of them.
--
-- Locks are taken in (issuer, subject) order, which is deterministic, so two calls removing an
-- overlapping set cannot take them in opposite orders. The grant rows are locked after the subject
-- locks, the same order every other function in this feature uses.

create or replace function public.unlink_cubid_subject(p_user_id uuid)
returns table (outcome text, revoked_clients integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mapping record;
  v_locked integer := 0;
  v_client_id text;
  v_revoked integer := 0;
begin
  -- The subjects are only knowable by reading the mappings, so this read is necessarily unlocked;
  -- each one is re-checked under its own lock below, and nothing has been written yet.
  for v_mapping in
    select s.issuer, s.subject from public.cubid_oidc_subjects s
      where s.user_id = p_user_id
      order by s.issuer, s.subject
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('cubid_subject:' || v_mapping.issuer || ':' || v_mapping.subject, 0));

    -- Still this person's mapping now that the lock is held. If it moved or went, this call is
    -- acting on a state that no longer exists.
    if not exists (
      select 1 from public.cubid_oidc_subjects s
        where s.user_id = p_user_id and s.issuer = v_mapping.issuer and s.subject = v_mapping.subject
    ) then
      return query select 'conflict'::text, 0;
      return;
    end if;

    v_locked := v_locked + 1;
  end loop;

  if v_locked = 0 then
    return query select 'not_linked'::text, 0;
    return;
  end if;

  -- A mapping created *after* the read above, under an issuer this call never locked, would be
  -- deleted below without its subject being serialized. Refusing is the honest answer: the caller
  -- re-reads and tries again, and a person disconnecting twice in the same instant is not a case
  -- worth guessing at.
  if (select count(*) from public.cubid_oidc_subjects s where s.user_id = p_user_id) <> v_locked then
    return query select 'conflict'::text, 0;
    return;
  end if;

  -- Every grant, revoked or not: the lock is the point, so a concurrent redemption of any of them
  -- waits for the mappings to be gone.
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
