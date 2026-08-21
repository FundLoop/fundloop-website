import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20260809180000_withdrawal_obligation_control_plane.sql", "utf8")

describe("withdrawal obligation control plane", () => {
  it("uses one partial obligation path and oldest-first exact inventory", () => {
    expect(migration).toContain("user_withdrawal_obligation_claims")
    expect(migration).toContain("ORDER BY obligation.available_at,obligation.id FOR UPDATE")
    expect(migration).toContain("payout_inventory_reservations")
    expect(migration).toContain("originating_fx_snapshot_id")
    expect(migration).toContain("ORDER BY lot.monthly_cycle_id,lot.deterministic_sequence,lot.id FOR UPDATE")
  })

  it("queues depleted inventory and preserves timely requests after expiry", () => {
    expect(migration).toContain("status_reason='eligible_inventory_depleted'")
    expect(migration).toContain("reservation_expired_requeued")
    expect(migration).toContain("'timelyRequestPreserved',true")
  })

  it("retires direct-result intents and permits only one live withdrawal intent", () => {
    expect(migration).toContain("direct_result_payout_intents_retired")
    expect(migration).toContain("payout_intents_one_live_withdrawal_idx")
    expect(migration).toContain("withdrawal_request_id")
  })

  it("fails production closed and removes direct service-role DML", () => {
    expect(migration).toContain("withdrawal_runtime_production_closed")
    expect(migration).toContain("withdrawal_runtime_no_value_flow")
    expect(migration).toContain("FROM PUBLIC,anon,authenticated,service_role")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.prepare_epoch_withdrawal_obligations")
  })
})
