import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import { runEpochShadowScheduler } from "@/lib/monthly-cycles/epoch-shadow-scheduler"
import type { Database } from "@/types/supabase"

describe("epoch shadow scheduler orchestration", () => {
  it("derives cutoff, ready, holiday opt-out, expiry, and carryover transitions", async () => {
    const states = [
      { id: 1, current_stage: "collecting", state_version: 1, accounting_periods: { ends_at: "2026-09-01T07:00:00Z" } },
      { id: 2, current_stage: "reconciling", state_version: 2, stage_ready_at: "2026-09-02T00:00:00Z", accounting_periods: { ends_at: "2026-09-01T07:00:00Z" } },
      { id: 3, current_stage: "reviewing", state_version: 8, opt_out_email_delivered_at: "2026-08-07T18:00:00Z", business_calendar_region: "US-CA", accounting_periods: { ends_at: "2026-09-01T07:00:00Z" } },
      { id: 4, current_stage: "payout_open", state_version: 10, payout_opened_at: "2026-08-15T18:00:00Z", accounting_periods: { ends_at: "2026-09-01T07:00:00Z" } },
      { id: 5, current_stage: "expired", state_version: 11, carryover_complete: true, accounting_periods: { ends_at: "2026-09-01T07:00:00Z" } },
    ]
    const rpc = vi.fn().mockResolvedValue({ data: 42, error: null })
    const client = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue(table === "epoch_shadow_states"
            ? { data: states, error: null }
            : { data: [{ calendar_date: "2026-08-10", is_business_day: false, calendar_region: "US-CA" }], error: null }),
        })),
      })),
      rpc,
    } as unknown as SupabaseClient<Database>

    const result = await runEpochShadowScheduler(client, {
      now: new Date("2026-11-01T08:00:00Z"), environment: "local", workerId: "fake-clock-worker",
    })

    expect(result).toMatchObject({ ok: true, enqueued: [42, 42, 42, 42, 42] })
    expect(rpc.mock.calls.map(([, args]) => [args.p_target_stage, args.p_idempotency_key.split(":").at(-1)])).toEqual([
      ["reconciling", "collection_cutoff_reached"], ["valuing", "reconciliation_complete"],
      ["payout_readying", "opt_out_window_closed"], ["expired", "payout_window_expired"], ["closed", "carryover_complete"],
    ])
  })

  it("never reads or enqueues in production", async () => {
    const client = { from: vi.fn(), rpc: vi.fn() } as unknown as SupabaseClient<Database>
    expect(await runEpochShadowScheduler(client, { now: new Date(), environment: "production", workerId: "prod" }))
      .toEqual({ ok: false, error: "epoch_shadow_runtime_disabled" })
    expect(client.from).not.toHaveBeenCalled()
  })
})
