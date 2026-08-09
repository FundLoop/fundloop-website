import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type { UserWithdrawalRequestCreateInput, UserWithdrawalRequestCreateResult } from "../edge-functions/user-withdrawal-request-contract.ts"
import { requireCurrentTermsAcknowledgement } from "../policies/terms-acknowledgement-guard.ts"

type Result = { ok: true; data: UserWithdrawalRequestCreateResult } | { ok: false; error: { code: string; message: string } }

export async function executeUserWithdrawalRequestCreate(
  supabase: SupabaseClient<Database>,
  input: UserWithdrawalRequestCreateInput & { actorUserId: string },
): Promise<Result> {
  const acknowledgement = await requireCurrentTermsAcknowledgement(supabase, {
    actorUserId: input.actorUserId,
    actorCapacity: "user",
    sourceSurface: "payout_preview",
  })
  if (!acknowledgement.ok) {
    return { ok: false, error: { code: acknowledgement.code, message: acknowledgement.message } }
  }

  const { data, error } = await supabase.rpc("create_user_withdrawal_request", {
    p_actor_user_id: input.actorUserId,
    p_payout_route_id: input.payoutRouteId,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) {
    const known = ["active_default_payout_route_required", "no_eligible_credited_earnings", "invalid_idempotency_key"]
      .find((code) => error.message.includes(code))
    const code = known ?? "withdrawal_request_failed"
    const messages: Record<string, string> = {
      active_default_payout_route_required: "Set an active default payout route before requesting withdrawal.",
      no_eligible_credited_earnings: "No eligible credited and not-paid earnings are available.",
      invalid_idempotency_key: "The withdrawal request key is invalid.",
    }
    return { ok: false, error: { code, message: messages[code] ?? "The withdrawal request could not be created." } }
  }
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return { ok: false, error: { code: "withdrawal_request_failed", message: "The withdrawal request returned no result." } }
  if (row.no_payout_executed !== true) {
    return { ok: false, error: { code: "withdrawal_request_safety_check_failed", message: "The withdrawal request safety confirmation was missing." } }
  }
  return { ok: true, data: {
    requestId: row.request_id,
    payoutRouteId: row.payout_route_id,
    status: "requested",
    requestedUsdAmount: Number(row.requested_usd_amount),
    currencyCode: "USD",
    creditCount: row.credit_count,
    requestedAt: row.requested_at,
    noPayoutExecuted: row.no_payout_executed,
  } }
}
