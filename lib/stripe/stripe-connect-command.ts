import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"

type RpcResult = { data: unknown; error: { message: string } | null }
type AdminClient = SupabaseClient<Database> | { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult> }
type StripeConnectProvider = {
  createTransfer: (input: { amount: number; currency: string; destination: string; transferGroup: string; commandId: string }, idempotencyKey: string) => PromiseLike<{ id: string }>
  createPayout: (input: { amount: number; currency: string; providerAccountId: string; commandId: string; transferId: string }, idempotencyKey: string) => PromiseLike<{ id: string }>
}
type Result = { ok: true; data: Record<string, unknown> } | { ok: false; error: { code: string; message: string } }

function failureCode(message: string) {
  return message.match(/stripe_connect_[a-z_]+/)?.[0] ?? "stripe_connect_provider_failed"
}

export async function submitStripeConnectPayout(
  admin: AdminClient,
  provider: StripeConnectProvider,
  actorUserId: string,
  payoutIntentId: number,
  deploymentEnvironment: string,
): Promise<Result> {
  if (!["local", "development", "dev", "preview", "test"].includes(deploymentEnvironment)) {
    return { ok: false, error: { code: "stripe_connect_runtime_disabled", message: "Stripe Connect payouts are unavailable in production." } }
  }
  const prepared = await admin.rpc("prepare_stripe_connect_payout", {
    p_actor_user_id: actorUserId, p_payout_intent_id: payoutIntentId, p_environment: deploymentEnvironment,
  })
  if (prepared.error) return { ok: false, error: { code: failureCode(prepared.error.message), message: prepared.error.message } }
  const value = prepared.data as Record<string, unknown>
  let transferId = String(value.existingTransferId ?? "")
  try {
    if (!transferId) {
      const transfer = await provider.createTransfer({ amount: Number(value.netMinor), currency: String(value.currencyCode),
        destination: String(value.providerAccountId), transferGroup: `fundloop_withdrawal_${payoutIntentId}`,
        commandId: String(value.commandId) }, String(value.transferIdempotencyKey))
      transferId = transfer.id
    }
    const payout = await provider.createPayout({ amount: Number(value.netMinor), currency: String(value.currencyCode),
      providerAccountId: String(value.providerAccountId), commandId: String(value.commandId), transferId },
    String(value.payoutIdempotencyKey))
    let recorded = await admin.rpc("record_stripe_connect_payout_submission", {
      p_command_id: Number(value.commandId), p_transfer_id: transferId, p_payout_id: payout.id, p_provider_request_id: "",
    })
    if (recorded.error) {
      recorded = await admin.rpc("record_stripe_connect_payout_submission", {
        p_command_id: Number(value.commandId), p_transfer_id: transferId, p_payout_id: payout.id, p_provider_request_id: "",
      })
    }
    if (recorded.error) return { ok: false, error: { code: "stripe_connect_local_commit_pending",
      message: "Stripe accepted the idempotent payout, but FundLoop could not record it yet. Retry safely with the same command." } }
    return { ok: true, data: recorded.data as Record<string, unknown> }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe Connect payout submission failed."
    await admin.rpc("record_stripe_connect_payout_failure", {
      p_command_id: Number(value.commandId), p_transfer_id: transferId, p_failure_code: failureCode(message),
    })
    return { ok: false, error: { code: failureCode(message), message } }
  }
}
