import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"
import { privacyReviewDocument } from "../policies/review-policy.ts"

export const PROFILE_PUBLICATION_CHOICE_FUNCTION = "profile-publication-choice-record"
export const publicProfileFields = ["display_name", "avatar", "headline", "bio", "occupation", "location"] as const
export type PublicProfileField = (typeof publicProfileFields)[number]
export type ProfilePublicationChoiceInput = {
  action: "grant" | "withdraw"
  documentId: string
  version: string
  contentHash: string
  status: "review"
  locale: string
  fields: PublicProfileField[]
  sourceSurface: "account_profile_visibility"
}
export type ProfilePublicationChoiceOutput = { consentId: string; recordedAt: string; isPublic: boolean; prospectiveWithdrawal: boolean; status: "review" }

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)) }
export function validateProfilePublicationChoiceInput(input: unknown): EdgeCommandResult<ProfilePublicationChoiceInput> {
  if (!isObject(input)) return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  if (input.documentId !== privacyReviewDocument.documentId || input.version !== privacyReviewDocument.version || input.contentHash !== privacyReviewDocument.contentHash || input.status !== "review") return edgeCommandFailure("review_document_mismatch", "Only the current non-effective Privacy review draft can be referenced.")
  if (input.action !== "grant" && input.action !== "withdraw") return edgeCommandFailure("invalid_payload", "action must be grant or withdraw.")
  if (!Array.isArray(input.fields) || input.fields.some((field) => !publicProfileFields.includes(field as PublicProfileField))) return edgeCommandFailure("invalid_payload", "fields contains an unsupported public-profile field.")
  if (input.action === "grant" && input.fields.length === 0) return edgeCommandFailure("invalid_payload", "At least one field is required for public publication.")
  if (input.sourceSurface !== "account_profile_visibility" || typeof input.locale !== "string" || !input.locale.trim()) return edgeCommandFailure("invalid_payload", "locale and the account source surface are required.")
  return edgeCommandSuccess(input as ProfilePublicationChoiceInput)
}
export function normalizeProfilePublicationChoiceResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<ProfilePublicationChoiceOutput> {
  if (!result.ok) return result
  if (!isObject(result.data) || typeof result.data.consentId !== "string" || typeof result.data.recordedAt !== "string" || typeof result.data.isPublic !== "boolean" || typeof result.data.prospectiveWithdrawal !== "boolean" || result.data.status !== "review") return edgeCommandFailure("invalid_edge_response", "Profile publication command returned an invalid response.")
  return edgeCommandSuccess(result.data as ProfilePublicationChoiceOutput)
}

