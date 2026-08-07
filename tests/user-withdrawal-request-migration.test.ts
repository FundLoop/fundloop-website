import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20260805144500_user_withdrawal_requests.sql", "utf8")

describe("withdrawal request database boundary", () => {
  it("reserves each credit once and never changes paid state", () => {
    expect(migration).toContain("CONSTRAINT user_withdrawal_request_credits_one_reservation UNIQUE (bookkeeping_credit_id)")
    expect(migration).toContain("credit.payment_status = 'not_paid'")
    expect(migration).not.toMatch(/UPDATE public\.monthly_cycle_bookkeeping_credits/)
    expect(migration).not.toMatch(/INSERT INTO public\.payout_/)
  })

  it("keeps the security-definer command behind the service role", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.create_user_withdrawal_request(uuid, bigint, text) FROM PUBLIC, anon, authenticated")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.create_user_withdrawal_request(uuid, bigint, text) TO service_role")
  })

  it("serializes concurrent retries before reading the idempotent result", () => {
    const lock = migration.indexOf("pg_advisory_xact_lock")
    const lookup = migration.indexOf("SELECT * INTO existing")
    expect(lock).toBeGreaterThan(-1)
    expect(lookup).toBeGreaterThan(lock)
    expect(migration).toContain("p_actor_user_id::text || ':' || btrim(p_idempotency_key)")
  })
})
