do $$
declare
  current_role_id integer;
  reserved_role_id constant integer := 999;
begin
  select id
  into current_role_id
  from public.ref_roles
  where name = 'zkas_access';

  if current_role_id is null then
    insert into public.ref_roles (id, name, display_order)
    overriding system value
    values (reserved_role_id, 'zkas_access', 999);
  elsif current_role_id <> reserved_role_id then
    if exists (
      select 1
      from public.ref_roles
      where id = reserved_role_id
        and name <> 'zkas_access'
    ) then
      raise exception 'ref_roles id % is already in use by a different role', reserved_role_id;
    end if;

    update public.ref_roles
    set name = format('zkas_access_legacy_%s', current_role_id)
    where id = current_role_id;

    insert into public.ref_roles (id, name, display_order)
    overriding system value
    values (reserved_role_id, 'zkas_access', 999);

    update public.participant_roles
    set role_id = reserved_role_id
    where role_id = current_role_id;

    update public.organization_members
    set role_id = reserved_role_id
    where role_id = current_role_id;

    update public.organization_invitations
    set role_id = reserved_role_id
    where role_id = current_role_id;

    delete from public.ref_roles
    where id = current_role_id;
  else
    update public.ref_roles
    set display_order = 999
    where id = reserved_role_id;
  end if;

  perform setval(
    pg_get_serial_sequence('public.ref_roles', 'id'),
    greatest(
      reserved_role_id,
      coalesce((select max(id) from public.ref_roles), reserved_role_id)
    ),
    true
  );
end
$$;
