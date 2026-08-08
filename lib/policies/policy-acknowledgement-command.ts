import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type { PolicyAcknowledgementInput, PolicyAcknowledgementOutput } from "../edge-functions/policy-acknowledgement-contract.ts"

type CommandResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

export async function executePolicyAcknowledgementCommand(
  supabase: SupabaseClient<Database>,
  actorUserId: string,
  input: PolicyAcknowledgementInput,
): Promise<CommandResult<PolicyAcknowledgementOutput>> {
  const client = supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }
  const { data, error } = await client.rpc("record_review_policy_acknowledgement", {
    p_actor_user_id: actorUserId,
    p_document_identifier: input.documentId,
    p_content_hash: input.contentHash,
    p_locale: input.locale,
    p_actor_capacity: input.actorCapacity,
    p_source_surface: input.sourceSurface,
  })
  if (error) return { ok: false, error: { code: "acknowledgement_failed", message: error.message } }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") return { ok: false, error: { code: "acknowledgement_failed", message: "No acknowledgement record returned." } }
  const value = row as { acceptance_id: string; recorded_at: string }
  return { ok: true, data: { acceptanceId: value.acceptance_id, recordedAt: value.recorded_at, status: "review", noLegalEffect: true, noValueFlowEnabled: true } }
}

