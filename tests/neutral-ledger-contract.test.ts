import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  validateLedgerPostRequest,
  validateLedgerReversalRequest,
} from "@/supabase/functions/_shared/ledger-posting-contract"

const actorUserId = "00000000-0000-4000-8000-000000000101"
const validPost = {
  contractVersion: "ledger_post.v1",
  idempotencyKey: "neutral-post-001",
  transactionType: "neutral_review",
  periodKey: "local_review_2026_08",
  effectiveAt: "2026-08-15T12:00:00Z",
  evidenceHash: "a".repeat(64),
  financialReferenceKey: "local_review_reference",
  postings: [
    { accountKey: "neutral_source_control", side: "debit", assetKey: "local_review_usd", custodyKey: "local_review_custody", nativeAtomicAmount: "1000000", functionalUsdAmount: "1.000000000000000001", fxUsdPerUnit: "1", projectId: 101, userId: actorUserId },
    { accountKey: "neutral_offset_control", side: "credit", assetKey: "local_review_usd", custodyKey: "local_review_custody", nativeAtomicAmount: "1000000", functionalUsdAmount: "1.000000000000000001", fxUsdPerUnit: "1", projectId: 101, userId: actorUserId },
  ],
}

describe("neutral ledger Edge contract", () => {
  it("binds actor identity, actor type, and deployment environment to trusted local runtime context", () => {
    const result = validateLedgerPostRequest(
      { ...validPost, actorType: "system", actorUserId: "99999999-9999-4999-8999-999999999999", deploymentEnvironment: "production" },
      { FUNDLOOP_DEPLOYMENT_ENV: "local" },
      { actorType: "operator", actorUserId },
    )
    expect(result).toEqual({ ok: true, data: expect.objectContaining({
      actorUserId,
      actorType: "operator",
      deploymentEnvironment: "local",
      postings: validPost.postings,
    }) })
  })

  it("fails closed in production even when a request claims a non-production environment", () => {
    expect(validateLedgerPostRequest(
      { ...validPost, deploymentEnvironment: "local" },
      { FUNDLOOP_DEPLOYMENT_ENV: "production" },
      { actorType: "operator", actorUserId },
    )).toEqual({ ok: false, error: {
      code: "neutral_ledger_runtime_disabled",
      message: "Neutral ledger review posting is unavailable in this environment.",
    } })
    expect(validateLedgerPostRequest(validPost, {}, { actorType: "operator", actorUserId }).ok).toBe(false)
  })

  it("rejects partial native dimensions, invalid exact amounts, and oversized batches", () => {
    expect(validateLedgerPostRequest({
      ...validPost,
      postings: [{ ...validPost.postings[0], custodyKey: undefined }, validPost.postings[1]],
    }, { FUNDLOOP_DEPLOYMENT_ENV: "dev" }, { actorType: "operator", actorUserId }).ok).toBe(false)
    expect(validateLedgerPostRequest({
      ...validPost,
      postings: [{ ...validPost.postings[0], nativeAtomicAmount: "1.5" }, validPost.postings[1]],
    }, { FUNDLOOP_DEPLOYMENT_ENV: "dev" }, { actorType: "operator", actorUserId }).ok).toBe(false)
    expect(validateLedgerPostRequest({ ...validPost, postings: Array(101).fill(validPost.postings[0]) },
      { FUNDLOOP_DEPLOYMENT_ENV: "dev" }, { actorType: "operator", actorUserId }).ok).toBe(false)
  })

  it("validates typed reversals without accepting caller-owned runtime, actor identity, or actor type", () => {
    const result = validateLedgerReversalRequest({
      contractVersion: "ledger_reversal.v1",
      idempotencyKey: "neutral-reversal-001",
      originalTransactionId: 42,
      periodKey: "local_review_2026_08",
      effectiveAt: "2026-08-16T12:00:00Z",
      evidenceHash: "b".repeat(64),
      actorType: "system",
      actorUserId: "99999999-9999-4999-8999-999999999999",
      deploymentEnvironment: "production",
    }, { FUNDLOOP_DEPLOYMENT_ENV: "preview" }, { actorType: "operator", actorUserId })
    expect(result).toEqual({ ok: true, data: expect.objectContaining({
      actorUserId,
      actorType: "operator",
      deploymentEnvironment: "preview",
      originalTransactionId: 42,
    }) })
  })
})

describe("neutral ledger migration boundary", () => {
  const migration = readFileSync("supabase/migrations/20260809020000_neutral_ledger_foundations.sql", "utf8")
  const integrityMigration = readFileSync("supabase/migrations/20260809023000_neutral_ledger_integrity_fixes.sql", "utf8")
  const seed = readFileSync("supabase/seed.sql", "utf8")
  const documentation = readFileSync("docs/engineering/neutral-ledger-foundations.md", "utf8")

  it("uses exact types, retained references, indexed foreign keys, and provisional checks", () => {
    expect(migration).toContain("numeric(78, 0)")
    expect(migration).toContain("numeric(38, 18)")
    expect(migration).toContain("ON DELETE RESTRICT")
    expect(migration).toContain("financial_references_custody_idx")
    expect(migration).toContain("ledger_postings_user_idx")
    expect(migration).toContain("classification_status = 'provisional'")
    expect(migration).toContain("production_enabled = false")
    expect(integrityMigration).toContain("FOREIGN KEY (asset_id, custody_account_id)")
    expect(integrityMigration).toContain("REFERENCES public.financial_custody_accounts (asset_id, id)")
  })

  it("keeps posting service-owned, append-only, balanced, idempotent, and production-disabled", () => {
    expect(migration).toContain("SECURITY DEFINER SET search_path = ''")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("ledger_transaction_unbalanced")
    expect(migration).toContain("ledger_native_amount_unbalanced")
    expect(migration).toContain("ledger_idempotency_conflict")
    expect(migration).toContain("financial_reference_over_applied")
    expect(migration).toContain("financial_records_are_append_only")
    expect(migration).toContain("v_environment = 'production'")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.post_neutral_ledger_transaction(jsonb)")
    expect(migration).not.toContain("TO anon, authenticated")
    expect(integrityMigration).toContain("NEW.effective_at >= period.starts_at")
    expect(integrityMigration).toContain("NEW.effective_at < period.ends_at")
    expect(integrityMigration).toContain("ledger_effective_at_outside_period")
  })

  it("labels local fixtures and documentation as provisional without value-flow claims", () => {
    expect(seed).toContain("Local-only neutral ledger fixtures")
    expect(seed).toContain('"custody_claim":false')
    expect(documentation).toContain("not approved bookkeeping policy")
    expect(documentation).toContain("creates no external event adapter")
  })
})
