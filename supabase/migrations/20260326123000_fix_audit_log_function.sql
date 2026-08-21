create or replace function public.log_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_data jsonb;
  new_data jsonb;
  record_id bigint;
  candidate_record_id text;
  actor_id uuid;
  candidate_actor_id text;
begin
  old_data := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_data := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  candidate_record_id := coalesce(new_data ->> 'id', old_data ->> 'id');
  if candidate_record_id is not null and candidate_record_id ~ '^[0-9]+$' then
    record_id := candidate_record_id::bigint;
  end if;

  actor_id := auth.uid();
  if actor_id is null then
    candidate_actor_id := coalesce(new_data ->> 'updated_by', old_data ->> 'updated_by');
    if candidate_actor_id is not null
      and candidate_actor_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      actor_id := candidate_actor_id::uuid;
    end if;
  end if;

  insert into public.audit_log (
    table_name,
    action,
    record_id,
    user_id,
    old_data,
    new_data
  ) values (
    tg_table_name,
    tg_op,
    record_id,
    actor_id,
    old_data,
    new_data
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;
