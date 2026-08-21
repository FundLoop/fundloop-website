ALTER TABLE public.payment_flow_events
  DROP CONSTRAINT IF EXISTS payment_flow_events_stage_check,
  ADD CONSTRAINT payment_flow_events_stage_check
    CHECK (
      stage IN (
        'cta_click',
        'runtime_blocked',
        'modal_open',
        'connected',
        'timeout',
        'validation',
        'submit',
        'chain_switch',
        'approval',
        'deposit',
        'submission_record',
        'deposit_intent',
        'receipt_verification'
      )
    );
