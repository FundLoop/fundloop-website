\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE custody bigint; asset bigint; ref bigint; event1 bigint; replay bigint; event2 bigint;
BEGIN
 SELECT c.id,c.asset_id INTO custody,asset FROM public.financial_custody_accounts c WHERE custody_key='local_review_custody';
 SELECT id INTO ref FROM public.financial_references WHERE reference_key='local_review_reference';
 event1:=public.ingest_external_financial_event('fixture','evt-2',custody,asset,'settlement',2,1000,'2026-08-02Z',repeat('a',64),'{"legacyCreatedAt":"non_settlement_evidence"}','local');
 replay:=public.ingest_external_financial_event('fixture','evt-2',custody,asset,'settlement',2,1000,'2026-08-02Z',repeat('a',64),'{"legacyCreatedAt":"non_settlement_evidence"}','local');
 IF replay<>event1 THEN RAISE EXCEPTION 'dedupe failed'; END IF;
 BEGIN PERFORM public.ingest_external_financial_event('fixture','evt-2',custody,asset,'settlement',2,999,'2026-08-02Z',repeat('a',64),'{}','local'); RAISE EXCEPTION 'conflict accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%dedupe_conflict%' THEN RAISE; END IF; END;
 event2:=public.ingest_external_financial_event('fixture','evt-1',custody,asset,'settlement',1,500,'2026-08-01Z',repeat('b',64),'{}','local');
 IF (SELECT ordering_status FROM public.external_financial_events WHERE id=event2)<>'out_of_order' THEN RAISE EXCEPTION 'out of order not classified'; END IF;
 PERFORM public.apply_external_funding(event1,ref,600,repeat('c',64),'local');
 BEGIN PERFORM public.apply_external_funding(event1,ref,500,repeat('d',64),'local'); RAISE EXCEPTION 'over application accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%exceeds_settled%' AND SQLERRM NOT LIKE '%duplicate%' THEN RAISE; END IF; END;
 INSERT INTO public.custody_reconciliation_snapshots(custody_account_id,asset_id,provider_native_balance,shadow_native_balance,tolerance_native_amount,variance_native_amount,variance_classification,observed_at,evidence_hash)
 VALUES(custody,asset,1000,998,2,2,'within_tolerance',now(),repeat('e',64));
 INSERT INTO public.shadow_financial_journals(event_id,journal_type,native_debits,native_credits,functional_debits,functional_credits,comparison_status,evidence_hash)
 VALUES(event1,'receipt',1000,1000,1,1,'matched',repeat('f',64));
 BEGIN INSERT INTO public.shadow_financial_journals(event_id,journal_type,native_debits,native_credits,functional_debits,functional_credits,comparison_status,evidence_hash) VALUES(event1,'fee',2,1,1,1,'unmatched',repeat('f',64)); RAISE EXCEPTION 'unbalanced journal accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.ingest_external_financial_event('fixture','prod',custody,asset,'settlement',3,1,now(),repeat('a',64),'{}','production'); RAISE EXCEPTION 'production accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%disabled%' THEN RAISE; END IF; END;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM * FROM public.shadow_financial_reconciliation_observability; RAISE EXCEPTION 'browser read accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
ROLLBACK;
