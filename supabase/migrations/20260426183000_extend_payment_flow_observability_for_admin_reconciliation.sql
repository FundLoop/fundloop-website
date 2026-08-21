alter table public.payment_flow_events
  drop constraint if exists payment_flow_events_flow_check,
  add constraint payment_flow_events_flow_check
    check (flow in ('wallet_connect', 'payment_save', 'receipt_recording', 'admin_confirmation', 'admin_reconciliation'));

alter table public.payment_flow_events
  drop constraint if exists payment_flow_events_actor_role_check,
  add constraint payment_flow_events_actor_role_check
    check (actor_role in ('unauthenticated', 'authenticated_user', 'project_admin', 'internal_admin', 'system'));
