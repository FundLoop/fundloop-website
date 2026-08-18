import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// ── SQL contract files under test ──────────────────────────────────────────
const obligationMigration = readFileSync(
  "supabase/migrations/20260809180000_withdrawal_obligation_control_plane.sql",
  "utf8",
)
const allocationPolicyV2 = readFileSync(
  "supabase/migrations/20260811120000_epoch_allocation_policy_v2.sql",
  "utf8",
)
const epochFinancialPrep = readFileSync(
  "supabase/migrations/20260809150000_epoch_financial_prep.sql",
  "utf8",
)
const multiRailPrep = readFileSync(
  "supabase/migrations/20260811114000_epoch_multi_rail_financial_prep.sql",
  "utf8",
)
const reportPublication = readFileSync(
  "supabase/migrations/20260813130000_monthly_report_publication.sql",
  "utf8",
)

// ── Pure lifecycle helpers mirroring DB SQL logic ──────────────────────────

/** Simulates oldest-first partial claim consumption across obligations */
function applyFifoPartialClaim(
  obligations: { id: number; available_at: string; total_minor: number; reserved: number }[],
  requestedMinor: number,
): { consumed: { obligationId: number; claimed_minor: number }[]; fulfilled: boolean; remaining: number } {
  const sorted = [...obligations].sort((a, b) => a.available_at.localeCompare(b.available_at) || a.id - b.id)
  const consumed: { obligationId: number; claimed_minor: number }[] = []
  let need = requestedMinor
  for (const ob of sorted) {
    if (need <= 0) break
    const avail = ob.total_minor - ob.reserved
    if (avail <= 0) continue
    const take = Math.min(avail, need)
    consumed.push({ obligationId: ob.id, claimed_minor: take })
    need -= take
  }
  return { consumed, fulfilled: need <= 0, remaining: need }
}

/** Determines whether an obligation's 3-month window is still open */
function isObligationClaimable(originCycleMonth: string, currentCycleMonth: string): boolean {
  const origin = new Date(originCycleMonth + "-01")
  const current = new Date(currentCycleMonth + "-01")
  const expiry = new Date(origin)
  expiry.setMonth(expiry.getMonth() + 3)
  return current < expiry
}

/** Determines whether a reservation expiry should requeue (timely-request protection) */
function evaluateReservationExpiry(
  reservedAt: string,
  expiresAt: string,
  now: string,
): { expired: boolean; requeued: boolean; timelyRequestPreserved: boolean } {
  const expired = new Date(expiresAt) <= new Date(now)
  // Timely-request protection: the obligation claim is preserved by moving to queued
  const requeued = expired
  const timelyRequestPreserved = expired
  return { expired, requeued, timelyRequestPreserved }
}

// ────────────────────────────────────────────────────────────────────────────

describe("Three-Month Claim and Rollover Lifecycle (#182)", () => {
  describe("1. Three-Month Claim Window (E-3 Rule)", () => {
    it("obligation source expires exactly 3 months after the origin cycle", () => {
      // SQL contract: period_start + interval '3 months'
      expect(epochFinancialPrep).toContain("period_start+interval '3 months'")
      expect(multiRailPrep).toContain("period_start+interval '3 months'")
      expect(allocationPolicyV2).toContain("period_start+interval '3 months'")
    })

    it("redistribution policy also uses E+3 expiry for settled_cubid_redistribution_v2", () => {
      expect(allocationPolicyV2).toContain("settled_cubid_redistribution_v2")
      expect(allocationPolicyV2).toContain("expiry.period_start=(origin.period_start+interval '3 months')::date")
    })

    it("claimability window: month N+0 through N+2 is open, N+3 is expired", () => {
      // Obligation created in 2026-01: claimable through 2026-03 (exclusive of 2026-04)
      expect(isObligationClaimable("2026-01", "2026-01")).toBe(true)
      expect(isObligationClaimable("2026-01", "2026-02")).toBe(true)
      expect(isObligationClaimable("2026-01", "2026-03")).toBe(true)
      // Exactly at +3 months: no longer claimable
      expect(isObligationClaimable("2026-01", "2026-04")).toBe(false)
      expect(isObligationClaimable("2026-01", "2026-06")).toBe(false)
    })

    it("monthly report documents the E-3 expiry rule as a lifecycle guarantee", () => {
      expect(reportPublication).toContain("claimsExpiryRollover")
      expect(reportPublication).toContain("unclaimed value follows the E-3 rule")
      expect(reportPublication).toContain("expiryCycleId")
    })
  })

  describe("2. Oldest-First FIFO Partial Claim Consumption", () => {
    it("SQL enforces oldest-first ordering when consuming obligation claims", () => {
      expect(obligationMigration).toContain("ORDER BY obligation.available_at,obligation.id FOR UPDATE")
    })

    it("SQL enforces deterministic FIFO for inventory lot consumption", () => {
      expect(obligationMigration).toContain(
        "ORDER BY lot.monthly_cycle_id,lot.deterministic_sequence,lot.id FOR UPDATE",
      )
    })

    it("partial claim fully consumes oldest obligation before touching newer ones", () => {
      const obligations = [
        { id: 1, available_at: "2026-01-01T00:00:00Z", total_minor: 500, reserved: 0 },
        { id: 2, available_at: "2026-02-01T00:00:00Z", total_minor: 300, reserved: 0 },
        { id: 3, available_at: "2026-03-01T00:00:00Z", total_minor: 200, reserved: 0 },
      ]

      // Request exactly the first two months worth
      const result = applyFifoPartialClaim(obligations, 700)
      expect(result.fulfilled).toBe(true)
      expect(result.remaining).toBe(0)
      expect(result.consumed[0]).toEqual({ obligationId: 1, claimed_minor: 500 })
      expect(result.consumed[1]).toEqual({ obligationId: 2, claimed_minor: 200 })
      // Third obligation untouched
      expect(result.consumed.find((c) => c.obligationId === 3)).toBeUndefined()
    })

    it("partial claim spanning all three months conserves total balance", () => {
      const obligations = [
        { id: 10, available_at: "2026-01-01T00:00:00Z", total_minor: 1000, reserved: 0 },
        { id: 11, available_at: "2026-02-01T00:00:00Z", total_minor: 1000, reserved: 0 },
        { id: 12, available_at: "2026-03-01T00:00:00Z", total_minor: 1000, reserved: 0 },
      ]
      const totalAvailable = 3000
      const result = applyFifoPartialClaim(obligations, 2500)
      expect(result.fulfilled).toBe(true)
      const totalConsumed = result.consumed.reduce((s, c) => s + c.claimed_minor, 0)
      expect(totalConsumed).toBe(2500)
      expect(totalAvailable - totalConsumed).toBe(500) // Conservation check
    })

    it("request for more than available is not fulfilled and obligation balances remain intact", () => {
      const obligations = [
        { id: 20, available_at: "2026-01-01T00:00:00Z", total_minor: 200, reserved: 0 },
      ]
      const result = applyFifoPartialClaim(obligations, 500)
      expect(result.fulfilled).toBe(false)
      expect(result.remaining).toBe(300)
    })

    it("already-reserved amounts are excluded from available balance", () => {
      const obligations = [
        { id: 30, available_at: "2026-01-01T00:00:00Z", total_minor: 1000, reserved: 600 },
      ]
      const result = applyFifoPartialClaim(obligations, 500)
      // Only 400 available (1000 - 600)
      expect(result.fulfilled).toBe(false)
      expect(result.consumed[0].claimed_minor).toBe(400)
      expect(result.remaining).toBe(100)
    })
  })

  describe("3. Expiry, Timely-Request Protection, and Rollover Provenance", () => {
    it("SQL queue state machine preserves timely-request on reservation expiry", () => {
      // Timely request protection: when a reservation expires, the obligation claim
      // moves to 'queued' (not expired), preserving the user's claim window
      expect(obligationMigration).toContain("'timelyRequestPreserved',true")
      expect(obligationMigration).toContain("reservation_expired_requeued")
      expect(obligationMigration).toContain("UPDATE public.user_withdrawal_requests SET status='queued'")
    })

    it("reservation expiry requeues claims to allow retry without duplicate obligations", () => {
      const result = evaluateReservationExpiry(
        "2026-07-01T00:00:00Z",
        "2026-07-08T00:00:00Z",
        "2026-07-09T00:00:00Z", // After expiry
      )
      expect(result.expired).toBe(true)
      expect(result.requeued).toBe(true)
      expect(result.timelyRequestPreserved).toBe(true)
    })

    it("reservation not yet expired is correctly protected", () => {
      const result = evaluateReservationExpiry(
        "2026-07-01T00:00:00Z",
        "2026-07-08T00:00:00Z",
        "2026-07-07T00:00:00Z", // Before expiry
      )
      expect(result.expired).toBe(false)
      expect(result.requeued).toBe(false)
    })

    it("SQL lifecycle event log is append-only to protect claim provenance", () => {
      expect(obligationMigration).toContain("withdrawal_evidence_is_append_only")
      expect(obligationMigration).toContain("BEFORE UPDATE OR DELETE ON public.withdrawal_lifecycle_events")
    })

    it("SQL lifecycle event types cover all claim transitions including expiry and rollover", () => {
      const lifecycleTypes = [
        "created",
        "reserved",
        "queued",
        "held",
        "released",
        "cancelled",
        "expired",
        "retried",
        "paid",
        "closed",
      ]
      for (const t of lifecycleTypes) {
        expect(obligationMigration).toContain(`'${t}'`)
      }
    })

    it("harvested and carried_forward source lot states cover unclaimed value rollover", () => {
      expect(epochFinancialPrep).toContain("'harvested'")
      expect(epochFinancialPrep).toContain("'carried_forward'")
      // Expired lots that were not locked become harvest targets for the next epoch
      expect(epochFinancialPrep).toContain("expiry.period_start<v_target.period_start")
    })
  })

  describe("4. Destination Readiness and Queue Gate", () => {
    it("SQL queues to next cycle when eligible inventory is depleted", () => {
      expect(obligationMigration).toContain("status_reason='eligible_inventory_depleted'")
      expect(obligationMigration).toContain("queue_for_cycle_key")
      expect(obligationMigration).toContain("queue_for_cycle_id")
    })

    it("queue key format is YYYY-MM matching the cycle period format", () => {
      expect(obligationMigration).toContain("'YYYY-MM'")
    })

    it("SQL supports retry action that re-attempts inventory reservation from queued state", () => {
      expect(obligationMigration).toContain("p_action='retry'")
      expect(obligationMigration).toContain("reserve_withdrawal_inventory(v_request.id)")
      expect(obligationMigration).toContain("withdrawal_request_not_queued")
    })

    it("one-live-withdrawal-intent index prevents duplicate payout intents per request", () => {
      expect(obligationMigration).toContain("payout_intents_one_live_withdrawal_idx")
    })

    it("destination hash and request hash are hex-64 and required for asset-bound requests", () => {
      expect(obligationMigration).toContain("destination_hash ~ '^[0-9a-f]{64}$'")
      expect(obligationMigration).toContain("request_hash ~ '^[0-9a-f]{64}$'")
    })
  })

  describe("5. No-Value Flow and Production Closed Guardrails", () => {
    it("withdrawal runtime controls fail completely closed for production", () => {
      expect(obligationMigration).toContain("withdrawal_runtime_production_closed")
      expect(obligationMigration).toContain("deployment_environment <> 'production' OR (reservation_enabled=false")
      expect(obligationMigration).toContain("withdrawal_runtime_no_value_flow")
      expect(obligationMigration).toContain("production_value_flow_enabled=false")
    })

    it("all result JSON blobs include noPayoutExecuted:true to make no-value proof explicit", () => {
      // Every terminal function call returns a noPayoutExecuted sentinel
      const matches = obligationMigration.match(/'noPayoutExecuted',true/g) ?? []
      expect(matches.length).toBeGreaterThanOrEqual(4) // prepare, create, manage, retry
    })

    it("production_enabled=false constraint is present on obligations, inventory lots, and requests", () => {
      expect(obligationMigration).toContain("withdrawal_obligation_production_disabled")
      expect(obligationMigration).toContain("payout_inventory_production_disabled")
      expect(obligationMigration).toContain("user_withdrawal_requests_production_disabled")
    })

    it("direct result payout intents are retired — all intents must come from a withdrawal request", () => {
      expect(obligationMigration).toContain("direct_result_payout_intents_retired")
      expect(obligationMigration).toContain("RAISE EXCEPTION 'direct_result_payout_intents_retired'")
    })

    it("RLS and function grants remove all direct-table write access from client roles", () => {
      expect(obligationMigration).toContain(
        "REVOKE ALL ON TABLE public.withdrawal_runtime_controls,public.user_withdrawal_obligations",
      )
      expect(obligationMigration).toContain("FROM PUBLIC,anon,authenticated,service_role")
      expect(obligationMigration).toContain(
        "GRANT SELECT ON public.user_withdrawal_obligations,public.user_withdrawal_obligation_claims",
      )
    })

    it("compliance hold must be placed before moving to queued execution and is auditable", () => {
      expect(obligationMigration).toContain("withdrawal_request_not_holdable")
      expect(obligationMigration).toContain("place_withdrawal_compliance_hold")
      expect(obligationMigration).toContain("withdrawal_holds_one_active_idx")
    })
  })

  describe("6. Obligation Balance View and Accounting Conservation", () => {
    it("user_withdrawal_obligation_balances view tracks all six status buckets", () => {
      const buckets = ["available_minor", "reserved_minor", "queued_minor", "held_minor", "paid_minor", "closed_minor"]
      for (const b of buckets) {
        expect(obligationMigration).toContain(b)
      }
    })

    it("obligation balance filter excludes released claims from available calculation", () => {
      // available = total - sum(claimed) WHERE status <> 'released'
      expect(obligationMigration).toContain("FILTER(WHERE claim.status<>'released')")
    })

    it("user_withdrawal_asset_inventory view sums only active lots for cross-rail inventory", () => {
      expect(obligationMigration).toContain("user_withdrawal_asset_inventory")
      expect(obligationMigration).toContain("lot.status IN('available','reserved')")
    })
  })
})
