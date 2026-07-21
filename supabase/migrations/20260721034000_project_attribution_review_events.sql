ALTER TABLE public.monthly_cycle_events
DROP CONSTRAINT IF EXISTS monthly_cycle_events_event_type_check;

ALTER TABLE public.monthly_cycle_events
ADD CONSTRAINT monthly_cycle_events_event_type_check CHECK (
  event_type IN (
    'lock_attempt',
    'lock_success',
    'lock_failure',
    'prep_review',
    'prep_exception',
    'calculation_package_attempt',
    'calculation_package_success',
    'calculation_package_failure',
    'verification_review',
    'approval_review',
    'attribution_dataset_review',
    'payout_intents_create_attempt',
    'payout_intents_create_success',
    'payout_intents_create_failure',
    'payout_execution_attempt',
    'payout_execution_success',
    'payout_execution_failure',
    'reporting_publication_attempt',
    'reporting_publication_success',
    'reporting_publication_failure'
  )
);
