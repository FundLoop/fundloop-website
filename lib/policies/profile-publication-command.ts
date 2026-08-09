import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type { ProfilePublicationChoiceInput, ProfilePublicationChoiceOutput } from "../edge-functions/profile-publication-choice-contract.ts"
type Result = { ok: true; data: ProfilePublicationChoiceOutput } | { ok: false; error: { code: string; message: string } }
export async function executeProfilePublicationChoiceCommand(supabase: SupabaseClient<Database>, actorUserId: string, input: ProfilePublicationChoiceInput): Promise<Result> {
  const client = supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }
  const { data, error } = await client.rpc("record_profile_publication_choice", { p_actor_user_id: actorUserId, p_document_identifier: input.documentId, p_content_hash: input.contentHash, p_locale: input.locale, p_action: input.action, p_fields: input.fields, p_source_surface: input.sourceSurface })
  if (error) return { ok: false, error: { code: "profile_publication_failed", message: error.message } }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") return { ok: false, error: { code: "profile_publication_failed", message: "No publication record returned." } }
  const value = row as { consent_id: string; recorded_at: string; is_public: boolean }
  return { ok: true, data: { consentId: value.consent_id, recordedAt: value.recorded_at, isPublic: value.is_public, prospectiveWithdrawal: input.action === "withdraw", status: "review" } }
}
