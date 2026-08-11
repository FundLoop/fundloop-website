import { readFileSync } from "node:fs"
import { describe,expect,it } from "vitest"

const sql=readFileSync("supabase/migrations/20260809150000_epoch_financial_prep.sql","utf8")
const multiRail=readFileSync("supabase/migrations/20260811114000_epoch_multi_rail_financial_prep.sql","utf8")
const edge=readFileSync("supabase/functions/epoch-financial-prep/index.ts","utf8")
const scheduler=readFileSync("supabase/functions/epoch-financial-prep-scheduler/index.ts","utf8")

describe("epoch financial prep migration",()=>{
  it("preserves exact source provenance and neutral classifications",()=>{
    expect(sql).toContain("native_atomic_amount numeric(78,0)")
    expect(sql).toContain("distributable_exact_usd numeric(38,18)")
    expect(sql).toContain("deterministic_source_order")
    expect(sql).toContain("provisional_funded_epoch_principal")
    expect(sql).toContain("fee_ledger_transaction_id")
    expect(sql).toContain("post_neutral_ledger_transaction")
    expect(sql).toContain("fx_difference_exact_usd")
    expect(sql).toContain("clamp_epoch_fee_bps")
    expect(sql).not.toMatch(/payable|recognized_revenue/)
  })
  it("separates fees, prevents double project fees, and carries linked sources",()=>{
    expect(sql).toContain("gross_exact_usd=project_fee_exact_usd+base_fee_exact_usd+distributable_exact_usd")
    expect(sql).toContain("CASE WHEN v_source.project_fee_assessed_once THEN 0")
    expect(sql).toContain("origin_source_lot_id")
    expect(sql).toContain("epoch_source_harvest_reserved")
  })
  it("requires every higher-priority FX source to be exhausted before fallback",()=>{
    expect(sql).toContain("epoch_fx_higher_priority_source_available")
    expect(sql).toContain("better.source_rank<v_obs.source_rank")
    expect(sql).toContain("better.freshness_expires_at>=v_now")
  })
  it("exposes score-versioned funded lock candidates without calculating allocation",()=>{
    expect(sql).toContain("locked_cubid_score")
    expect(sql).toContain("locked_max_cubid_score")
    expect(sql).toContain("eligible_user_count")
    expect(sql).not.toContain("initial_claim")
    expect(sql).not.toContain("redistribution_award")
  })
  it("keeps Edge environment and actor server-owned",()=>{
    expect(edge).toContain('getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production"')
    expect(edge).toContain("actorUserId: auth.user.id")
    expect(edge).toContain("if (!allowed.has(runtime))")
    expect(scheduler).toContain("harvest_expired_epoch_source_lots")
    expect(scheduler).toContain("internal_secret")
    expect(scheduler).toContain("!allowed.has(environment)")
  })
  it("maps every supported settled intake rail into an exact custody-backed source lot",()=>{
    for(const kind of ["stripe_bank_transfer","base_stablecoin","stripe_acss_debit","stripe_pay_by_bank"]){
      expect(multiRail).toContain(`v_source.source_kind='${kind}'`)
    }
    expect(multiRail).toContain("stripe_acss_debit_custody_routes")
    expect(multiRail).toContain("stripe_pay_by_bank_custody_routes")
    expect(multiRail).toContain("'base_'||lower(asset.symbol)||'_epoch_treasury'")
    expect(multiRail).toContain("s.available_for_package")
    expect(multiRail).toContain("(newer.observed_at,newer.id)>(e.observed_at,e.id)")
    expect(multiRail).toContain("epoch_financial_prep_source_evidence_mismatch")
  })
})
