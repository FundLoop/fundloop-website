do $$
declare
  current_method_id integer;
  reserved_method_id constant integer := 999;
begin
  select id
  into current_method_id
  from public.ref_payment_methods
  where code = 'crypto_contract';

  if current_method_id is null then
    insert into public.ref_payment_methods (id, name, code, description, display_order)
    overriding system value
    values (
      reserved_method_id,
      'Crypto Contract',
      'crypto_contract',
      'Pay through a supported FundLoop intake contract and tag the payment with your project ID.',
      50
    );
  elsif current_method_id <> reserved_method_id then
    if exists (
      select 1
      from public.ref_payment_methods
      where id = reserved_method_id
        and code <> 'crypto_contract'
    ) then
      raise exception 'ref_payment_methods id % is already in use by a different method', reserved_method_id;
    end if;

    update public.ref_payment_methods
    set
      name = format('Crypto Contract Legacy %s', current_method_id),
      code = format('crypto_contract_legacy_%s', current_method_id)
    where id = current_method_id;

    insert into public.ref_payment_methods (id, name, code, description, display_order)
    overriding system value
    values (
      reserved_method_id,
      'Crypto Contract',
      'crypto_contract',
      'Pay through a supported FundLoop intake contract and tag the payment with your project ID.',
      50
    );

    update public.payment_methods
    set method_id = reserved_method_id
    where method_id = current_method_id;

    update public.payments
    set payment_method_id = reserved_method_id
    where payment_method_id = current_method_id;

    update public.projects
    set default_payment_method_id = reserved_method_id
    where default_payment_method_id = current_method_id;

    delete from public.ref_payment_methods
    where id = current_method_id;
  else
    update public.ref_payment_methods
    set
      name = 'Crypto Contract',
      description = 'Pay through a supported FundLoop intake contract and tag the payment with your project ID.',
      display_order = 50
    where id = reserved_method_id;
  end if;

  perform setval(
    pg_get_serial_sequence('public.ref_payment_methods', 'id'),
    greatest(
      reserved_method_id,
      coalesce((select max(id) from public.ref_payment_methods), reserved_method_id)
    ),
    true
  );
end
$$;

do $$
declare
  current_notification_id integer;
  reserved_notification_id constant integer := 999;
begin
  select id
  into current_notification_id
  from public.ref_notification_types
  where code = 'zkas_published_result';

  if current_notification_id is null then
    insert into public.ref_notification_types (id, name, code, description, display_order)
    overriding system value
    values (
      reserved_notification_id,
      'zkAS Published Result',
      'zkas_published_result',
      'Notifies a user that a verified zkActivitySum allocation has been published.',
      200
    );
  elsif current_notification_id <> reserved_notification_id then
    if exists (
      select 1
      from public.ref_notification_types
      where id = reserved_notification_id
        and code <> 'zkas_published_result'
    ) then
      raise exception 'ref_notification_types id % is already in use by a different notification type', reserved_notification_id;
    end if;

    update public.ref_notification_types
    set
      name = format('zkAS Published Result Legacy %s', current_notification_id),
      code = format('zkas_published_result_legacy_%s', current_notification_id)
    where id = current_notification_id;

    insert into public.ref_notification_types (id, name, code, description, display_order)
    overriding system value
    values (
      reserved_notification_id,
      'zkAS Published Result',
      'zkas_published_result',
      'Notifies a user that a verified zkActivitySum allocation has been published.',
      200
    );

    update public.user_notifications
    set type_id = reserved_notification_id
    where type_id = current_notification_id;

    delete from public.ref_notification_types
    where id = current_notification_id;
  else
    update public.ref_notification_types
    set
      name = 'zkAS Published Result',
      description = 'Notifies a user that a verified zkActivitySum allocation has been published.',
      display_order = 200
    where id = reserved_notification_id;
  end if;

  perform setval(
    pg_get_serial_sequence('public.ref_notification_types', 'id'),
    greatest(
      reserved_notification_id,
      coalesce((select max(id) from public.ref_notification_types), reserved_notification_id)
    ),
    true
  );
end
$$;
