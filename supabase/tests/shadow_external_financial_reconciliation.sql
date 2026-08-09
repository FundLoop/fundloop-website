\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE custody bigint; asset bigint; ref bigint; event1 bigint; replay bigint; event2 bigint;ledger_id bigint;reversal_id bigint;period_id bigint;debit_account bigint;credit_account bigint;expected_shadow numeric;
BEGIN
 SELECT c.id,c.asset_id INTO custody,asset FROM public.financial_custody_accounts c WHERE custody_key='local_review_custody';
 SELECT id INTO ref FROM public.financial_references WHERE reference_key='local_review_reference';
 event1:=public.ingest_external_financial_event('fixture','evt-2',custody,asset,'settlement',2,1000,'2026-08-02Z',repeat('a',64),'{"legacyCreatedAt":"non_settlement_evidence"}','local');
 replay:=public.ingest_external_financial_event('fixture','evt-2',custody,asset,'settlement',2,1000,'2026-08-02Z',repeat('a',64),'{"legacyCreatedAt":"non_settlement_evidence"}','local');
 IF replay<>event1 THEN RAISE EXCEPTION 'dedupe failed'; END IF;
 BEGIN PERFORM public.ingest_external_financial_event('fixture','evt-2',custody,asset,'settlement',2,1000,'2026-08-02Z',repeat('a',64),'{"legacyCreatedAt":"changed"}','local');RAISE EXCEPTION 'legacy evidence conflict accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%dedupe_conflict%' THEN RAISE;END IF;END;
 BEGIN UPDATE public.external_financial_events SET event_type='changed' WHERE id=event1;RAISE EXCEPTION 'event update accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%append_only%' THEN RAISE;END IF;END;
 BEGIN DELETE FROM public.external_financial_events WHERE id=event1;RAISE EXCEPTION 'event delete accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%append_only%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.ingest_external_financial_event('fixture','evt-2',custody,asset,'settlement',2,999,'2026-08-02Z',repeat('a',64),'{}','local'); RAISE EXCEPTION 'conflict accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%dedupe_conflict%' THEN RAISE; END IF; END;
 event2:=public.ingest_external_financial_event('fixture','evt-1',custody,asset,'settlement',1,500,'2026-08-01Z',repeat('b',64),'{}','local');
 IF (SELECT ordering_status FROM public.external_financial_events WHERE id=event2)<>'out_of_order' THEN RAISE EXCEPTION 'out of order not classified'; END IF;
 PERFORM public.apply_external_funding(event1,ref,600,repeat('c',64),'local');
 BEGIN PERFORM public.apply_external_funding(event1,ref,500,repeat('d',64),'local'); RAISE EXCEPTION 'over application accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%exceeds_settled%' AND SQLERRM NOT LIKE '%duplicate%' THEN RAISE; END IF; END;
 SELECT id INTO period_id FROM public.accounting_periods WHERE period_key='local_review_2026_08';SELECT id INTO debit_account FROM public.ledger_accounts WHERE account_key='neutral_source_control';SELECT id INTO credit_account FROM public.ledger_accounts WHERE account_key='neutral_offset_control';
 INSERT INTO public.ledger_transactions(accounting_period_id,financial_reference_id,transaction_type,idempotency_key,command_hash,evidence_hash,actor_type,deployment_environment,effective_at)VALUES(period_id,ref,'shadow_receipt','shadow:test:linked',repeat('a',64),repeat('b',64),'service','local','2026-08-02Z')RETURNING id INTO ledger_id;
 INSERT INTO public.ledger_postings(transaction_id,sequence_no,account_id,asset_id,custody_account_id,side,native_atomic_amount,functional_usd_amount,fx_usd_per_unit)VALUES(ledger_id,1,debit_account,asset,custody,'debit',1000,1,0.001),(ledger_id,2,credit_account,asset,custody,'credit',1000,1,0.001);
 PERFORM public.post_shadow_financial_journal(event1,ledger_id,'receipt','matched','{}',repeat('e',64),'local');
 SELECT sum(CASE WHEN p.side='debit'THEN p.native_atomic_amount ELSE-p.native_atomic_amount END)INTO expected_shadow FROM public.ledger_postings p JOIN public.ledger_accounts a ON a.id=p.account_id WHERE p.custody_account_id=custody AND p.asset_id=asset AND a.normal_balance='debit';
 PERFORM public.record_custody_reconciliation(custody,asset,expected_shadow,2,now(),repeat('e',64),'local');
 IF(SELECT variance_classification FROM public.custody_reconciliation_snapshots ORDER BY id DESC LIMIT 1)<>'exact'THEN RAISE EXCEPTION 'variance not ledger derived';END IF;
 INSERT INTO public.ledger_transactions(accounting_period_id,financial_reference_id,reversal_of_transaction_id,contract_version,transaction_type,idempotency_key,command_hash,evidence_hash,actor_type,deployment_environment,effective_at)VALUES(period_id,ref,ledger_id,'ledger_reversal.v1','reversal','shadow:test:reversal',repeat('c',64),repeat('d',64),'service','local','2026-08-03Z')RETURNING id INTO reversal_id;
 INSERT INTO public.ledger_postings(transaction_id,sequence_no,account_id,asset_id,custody_account_id,side,native_atomic_amount,functional_usd_amount,fx_usd_per_unit)VALUES(reversal_id,1,credit_account,asset,custody,'debit',1000,1,0.001),(reversal_id,2,debit_account,asset,custody,'credit',1000,1,0.001);
 PERFORM public.record_custody_reconciliation(custody,asset,expected_shadow,2,now(),repeat('f',64),'local');
 IF(SELECT variance_classification FROM public.custody_reconciliation_snapshots ORDER BY id DESC LIMIT 1)<>'outside_tolerance'THEN RAISE EXCEPTION 'reversal did not affect derived balance';END IF;
 INSERT INTO public.shadow_financial_journals(event_id,journal_type,native_debits,native_credits,functional_debits,functional_credits,comparison_status,evidence_hash)
 VALUES(event1,'receipt',1000,1000,1,1,'matched',repeat('f',64));
 BEGIN INSERT INTO public.shadow_financial_journals(event_id,journal_type,native_debits,native_credits,functional_debits,functional_credits,comparison_status,evidence_hash) VALUES(event1,'fee',2,1,1,1,'unmatched',repeat('f',64)); RAISE EXCEPTION 'unbalanced journal accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.ingest_external_financial_event('fixture','prod',custody,asset,'settlement',3,1,now(),repeat('a',64),'{}','production'); RAISE EXCEPTION 'production accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%disabled%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.apply_external_funding(event1,ref,1,repeat('a',64),'preview');RAISE EXCEPTION 'preview apply accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%disabled%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.apply_external_funding(event1,ref,1,repeat('a',64),NULL);RAISE EXCEPTION 'unset apply accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%disabled%' THEN RAISE;END IF;END;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM * FROM public.shadow_financial_reconciliation_observability; RAISE EXCEPTION 'browser read accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
DECLARE table_name text; v_event_id bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['external_financial_events','external_funding_applications','custody_reconciliation_snapshots','shadow_financial_journals','shadow_close_packages'] LOOP
    BEGIN EXECUTE format('INSERT INTO public.%I DEFAULT VALUES',table_name);RAISE EXCEPTION 'service insert accepted for %',table_name;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN EXECUTE format('UPDATE public.%I SET production_enabled=false WHERE false',table_name);RAISE EXCEPTION 'service update accepted for %',table_name;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN EXECUTE format('DELETE FROM public.%I WHERE false',table_name);RAISE EXCEPTION 'service delete accepted for %',table_name;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN EXECUTE format('TRUNCATE public.%I',table_name);RAISE EXCEPTION 'service truncate accepted for %',table_name;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  END LOOP;
  SELECT id INTO v_event_id FROM public.external_financial_events WHERE provider_key='local_fixture' LIMIT 1;
  PERFORM public.record_custody_reconciliation((SELECT custody_account_id FROM public.external_financial_events WHERE id=v_event_id),(SELECT asset_id FROM public.external_financial_events WHERE id=v_event_id),(SELECT shadow_native_balance FROM public.custody_reconciliation_snapshots ORDER BY id DESC LIMIT 1),2,now(),repeat('a',64),'local');
  IF NOT EXISTS(SELECT 1 FROM public.custody_reconciliation_snapshots WHERE variance_classification='exact')THEN RAISE EXCEPTION 'typed service RPC failed';END IF;
END $$;
RESET ROLE;
ROLLBACK;
