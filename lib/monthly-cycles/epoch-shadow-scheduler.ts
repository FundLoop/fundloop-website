import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import { emailRelativeOptOutDeadline, epochTransitionGate, evaluateEpochTransition, type EpochShadowStage } from "./epoch-shadow-machine.ts"

export async function runEpochShadowScheduler(
  client: SupabaseClient<Database>,
  input: { now: Date; environment: string; workerId: string },
) {
  if (input.environment === "production") return { ok: false as const, error: "epoch_shadow_runtime_disabled" }
  const [{ data: states, error }, { data: calendar, error: calendarError }] = await Promise.all([
    client.from("epoch_shadow_states").select("id,current_stage,state_version,stage_ready_at,opt_out_email_delivered_at,payout_opened_at,carryover_complete,business_calendar_region,accounting_periods(ends_at)").eq("is_paused", false),
    client.from("epoch_business_calendar").select("calendar_date,is_business_day,calendar_region").eq("production_enabled", false),
  ])
  if (error) return { ok: false as const, error: error.message }
  if (calendarError) return { ok: false as const, error: calendarError.message }
  const enqueued: number[] = []
  for (const state of states ?? []) {
    const period = Array.isArray(state.accounting_periods) ? state.accounting_periods[0] : state.accounting_periods
    const stage = state.current_stage as EpochShadowStage
    const holidays = new Set((calendar ?? []).filter((day) => day.calendar_region === state.business_calendar_region && !day.is_business_day).map((day) => day.calendar_date))
    const target = evaluateEpochTransition({
      stage, now: input.now,
      periodEnd: period?.ends_at ? new Date(period.ends_at) : undefined,
      stageReadyAt: state.stage_ready_at ? new Date(state.stage_ready_at) : undefined,
      optOutDeadline: state.opt_out_email_delivered_at ? emailRelativeOptOutDeadline(new Date(state.opt_out_email_delivered_at), holidays) : undefined,
      payoutOpenedAt: state.payout_opened_at ? new Date(state.payout_opened_at) : undefined,
      carryoverComplete: state.carryover_complete,
    })
    if (!target) continue
    const gate = epochTransitionGate[stage as Exclude<EpochShadowStage, "closed">]
    const key = `epoch:${state.id}:${state.state_version}:${target}:${gate}`
    const manifest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))
    const hash = [...new Uint8Array(manifest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    const { data, error: enqueueError } = await client.rpc("enqueue_epoch_shadow_attempt", {
      p_actor_user_id: null as never, p_deployment_environment: input.environment, p_expected_stage: state.current_stage,
      p_expected_state_version: state.state_version, p_idempotency_key: key, p_input_manifest_hash: hash,
      p_scheduled_for: input.now.toISOString(), p_shadow_state_id: state.id, p_target_stage: target, p_trigger_type: "scheduled",
    })
    if (enqueueError) return { ok: false as const, error: enqueueError.message }
    enqueued.push(data)
  }
  return { ok: true as const, enqueued }
}
