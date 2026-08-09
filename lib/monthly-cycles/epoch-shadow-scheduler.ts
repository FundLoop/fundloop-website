import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import { evaluateEpochTransition, type EpochShadowStage } from "./epoch-shadow-machine.ts"

export async function runEpochShadowScheduler(
  client: SupabaseClient<Database>,
  input: { now: Date; environment: string; workerId: string },
) {
  if (input.environment === "production") return { ok: false as const, error: "epoch_shadow_runtime_disabled" }
  const { data: states, error } = await client.from("epoch_shadow_states").select("id,current_stage,state_version,accounting_periods(ends_at)").eq("is_paused", false)
  if (error) return { ok: false as const, error: error.message }
  const enqueued: number[] = []
  for (const state of states ?? []) {
    const period = Array.isArray(state.accounting_periods) ? state.accounting_periods[0] : state.accounting_periods
    const target = evaluateEpochTransition({ stage: state.current_stage as EpochShadowStage, now: input.now, periodEnd: period?.ends_at ? new Date(period.ends_at) : undefined })
    if (!target) continue
    const key = `epoch:${state.id}:${state.state_version}:${target}`
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
