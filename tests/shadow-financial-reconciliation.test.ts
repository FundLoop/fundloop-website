import { readFileSync } from "node:fs"
import { describe,expect,it } from "vitest"
const sql=readFileSync("supabase/migrations/20260809040000_shadow_external_financial_reconciliation.sql","utf8")
const integrity=readFileSync("supabase/migrations/20260809041000_shadow_financial_reconciliation_integrity.sql","utf8")
const privileges=readFileSync("supabase/migrations/20260809042000_shadow_reconciliation_service_privileges.sql","utf8")
const edge=readFileSync("supabase/functions/shadow-financial-event-ingest/index.ts","utf8")
describe("shadow financial reconciliation",()=>{
 it("is immutable, deduplicated, balanced and production disabled",()=>{
  expect(sql).toContain("external_event_dedupe_conflict")
  expect(sql).toContain("funding_application_exceeds_settled_native")
  expect(sql).toContain("native_debits=native_credits")
  expect(sql).toContain("functional_debits=functional_credits")
  expect(sql).toContain("shadow_reconciliation_disabled")
  expect(integrity).toContain("shadow_financial_append_only")
  expect(integrity).toContain("funding_application_reference_mismatch")
  expect(integrity).toContain("abs(v_variance)<=p_tolerance")
  expect(privileges).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE")
  expect(privileges).toContain("GRANT SELECT")
  expect(sql).not.toMatch(/UPDATE public\.(payments|monthly_cycles|mvp_allocation_results)/i)
  expect(edge).toContain("authenticateRequestOrInternalSecret")
  expect(edge).toContain("FUNDLOOP_DEPLOYMENT_ENV")
 })
})
