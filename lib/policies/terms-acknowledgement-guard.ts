import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type { PolicyAcknowledgementSource } from "../edge-functions/policy-acknowledgement-contract.ts"
import { termsReviewDocument } from "./review-policy.ts"

export type TermsAcknowledgementGuardResult =
  | { ok: true; acceptanceId: string }
  | { ok: false; code: "terms_review_acknowledgement_required"; message: string }

export async function requireCurrentTermsAcknowledgement(
  supabase: SupabaseClient<Database>,
  input: {
    actorUserId: string
    actorCapacity: "project_actor" | "user"
    sourceSurface: PolicyAcknowledgementSource
  },
): Promise<TermsAcknowledgementGuardResult> {
  const { data, error } = await supabase
    .from("legal_acceptance_records")
    .select("id")
    .eq("actor_user_id", input.actorUserId)
    .eq("document_identifier", termsReviewDocument.documentId)
    .eq("content_hash", termsReviewDocument.contentHash)
    .eq("locale", termsReviewDocument.locale)
    .eq("document_status", "review")
    .eq("actor_capacity", input.actorCapacity)
    .eq("source_surface", input.sourceSurface)
    .maybeSingle()

  if (error || !data?.id) {
    return {
      ok: false,
      code: "terms_review_acknowledgement_required",
      message: "Record the current non-effective Terms review acknowledgement before testing this boundary.",
    }
  }

  return { ok: true, acceptanceId: data.id }
}
