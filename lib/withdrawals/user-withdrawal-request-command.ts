import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type { UserWithdrawalRequestInput, UserWithdrawalRequestResult } from "../edge-functions/user-withdrawal-request-contract.ts"
import { requireCurrentTermsAcknowledgement } from "../policies/terms-acknowledgement-guard.ts"

type Result = { ok: true; data: UserWithdrawalRequestResult } | { ok: false; error: { code: string; message: string } }

const messages: Record<string, string> = {
  active_payout_route_required: "Choose an active payout route before requesting withdrawal.",
  withdrawal_minimum_not_met: "Stripe withdrawals require at least $10 and Base withdrawals require at least $5.",
  withdrawal_asset_not_eligible: "That asset is not available from your project-linked inventory.",
  withdrawal_available_amount_insufficient: "The requested amount exceeds your available earnings.",
  withdrawal_idempotency_conflict: "That request key was already used with different withdrawal details.",
  withdrawal_runtime_disabled: "Withdrawal reservations are unavailable in this environment.",
  withdrawal_request_not_cancellable: "This withdrawal can no longer be cancelled.",
  withdrawal_request_not_queued: "Only queued withdrawals can be retried.",
}

function errorCode(message: string) {
  return Object.keys(messages).find((code) => message.includes(code)) ?? message.match(/withdrawal_[a-z_]+/)?.[0] ?? "withdrawal_request_failed"
}

export async function executeUserWithdrawalRequestCreate(
  supabase: SupabaseClient<Database>,
  input: UserWithdrawalRequestInput & { actorUserId: string; deploymentEnvironment: string },
): Promise<Result> {
  if (input.action === "create") {
    const acknowledgement = await requireCurrentTermsAcknowledgement(supabase, {
      actorUserId: input.actorUserId, actorCapacity: "user", sourceSurface: "payout_preview",
    })
    if (!acknowledgement.ok) return { ok: false, error: { code: acknowledgement.code, message: acknowledgement.message } }
    const { data, error } = await supabase.rpc("create_user_withdrawal_request_v2", { p_actor_user_id: input.actorUserId, p_command: {
      contractVersion: "withdrawal_request.v2", deploymentEnvironment: input.deploymentEnvironment, payoutRouteId: input.payoutRouteId,
      requestedMinor: input.requestedMinor, assetKey: input.assetKey, userFeeBps: input.userFeeBps, idempotencyKey: input.idempotencyKey,
    } })
    if (error) {
      const code = errorCode(error.message)
      return { ok: false, error: { code, message: messages[code] ?? "The withdrawal request could not be created." } }
    }
    const row = data as unknown as UserWithdrawalRequestResult
    if (!row || row.noPayoutExecuted !== true) return { ok: false, error: { code: "withdrawal_request_safety_check_failed", message: "The withdrawal safety confirmation was missing." } }
    return { ok: true, data: row }
  }
  const { data, error } = await supabase.rpc("manage_user_withdrawal_request", {
    p_actor_user_id: input.actorUserId, p_request_id: input.requestId, p_action: input.action,
    p_reason: input.reason ?? "", p_environment: input.deploymentEnvironment,
  })
  if (error) {
    const code = errorCode(error.message)
    return { ok: false, error: { code, message: messages[code] ?? "The withdrawal request could not be updated." } }
  }
  const row = data as unknown as UserWithdrawalRequestResult
  if (!row || row.noPayoutExecuted !== true) return { ok: false, error: { code: "withdrawal_request_safety_check_failed", message: "The withdrawal safety confirmation was missing." } }
  return { ok: true, data: row }
}
