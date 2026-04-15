import "server-only"

import type { Tables } from "../../types/supabase"
import {
  mergeUserOnboardingPayload,
  type UserOnboardingPayload,
  type UserOnboardingScreen,
} from "../onboarding"
import type { OnboardingCommandClient } from "./command-utils"
import { parseInteger } from "./command-utils"

type UserDraftCommandFailureCode = "not_authenticated" | "draft_save_failed" | "draft_clear_failed"
type UserPublishCommandFailureCode =
  | "not_authenticated"
  | "draft_not_found"
  | "profile_update_failed"
  | "interest_reset_failed"
  | "interest_insert_failed"
  | "draft_clear_failed"

type UserDraftUpsertInput = {
  actorUserId: string
  currentScreen: UserOnboardingScreen
  payload: UserOnboardingPayload
}

type UserDraftClearInput = {
  actorUserId: string
}

type UserPublishInput = {
  actorUserId: string
  actorEmail: string | null
}

type UserCommandFailure<TCode extends string> = {
  ok: false
  error: {
    code: TCode
    message: string
  }
}

type UserCommandSuccess<T> = {
  ok: true
  data: T
}

export type UserDraftUpsertCommandResult =
  | UserCommandSuccess<Tables<"user_onboarding_drafts">>
  | UserCommandFailure<UserDraftCommandFailureCode>

export type UserDraftClearCommandResult = UserCommandSuccess<undefined> | UserCommandFailure<UserDraftCommandFailureCode>

export type UserPublishCommandResult =
  | UserCommandSuccess<{
      nextFlow: "project" | null
      relationshipChoice: UserOnboardingPayload["relationshipChoice"]
    }>
  | UserCommandFailure<UserPublishCommandFailureCode>

function commandFailure<TCode extends string>(code: TCode, message: string): UserCommandFailure<TCode> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

export async function executeUserOnboardingDraftUpsertCommand(
  supabase: OnboardingCommandClient,
  input: UserDraftUpsertInput,
): Promise<UserDraftUpsertCommandResult> {
  const payload = mergeUserOnboardingPayload(input.payload)
  const { data, error } = await supabase
    .from("user_onboarding_drafts")
    .upsert(
      {
        user_id: input.actorUserId,
        current_screen: input.currentScreen,
        payload,
        completed_at: null,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single()

  if (error || !data) {
    return commandFailure("draft_save_failed", error?.message ?? "Failed to save user draft")
  }

  return { ok: true, data }
}

export async function executeUserOnboardingDraftClearCommand(
  supabase: OnboardingCommandClient,
  input: UserDraftClearInput,
): Promise<UserDraftClearCommandResult> {
  const { error } = await supabase.from("user_onboarding_drafts").delete().eq("user_id", input.actorUserId)

  if (error) {
    return commandFailure("draft_clear_failed", error.message)
  }

  return { ok: true, data: undefined }
}

export async function executeUserOnboardingPublishCommand(
  supabase: OnboardingCommandClient,
  input: UserPublishInput,
): Promise<UserPublishCommandResult> {
  const { data: draft, error: draftError } = await supabase
    .from("user_onboarding_drafts")
    .select("*")
    .eq("user_id", input.actorUserId)
    .single()

  if (draftError || !draft) {
    return commandFailure("draft_not_found", draftError?.message ?? "User draft not found")
  }

  const payload = mergeUserOnboardingPayload(draft.payload as Partial<UserOnboardingPayload>)
  const occupationId = parseInteger(payload.occupationId)
  const locationId = parseInteger(payload.locationId)
  const genderId = parseInteger(payload.genderId)
  const { data: existingProfile } = await supabase
    .from("users")
    .select("invited_by_code")
    .eq("user_id", input.actorUserId)
    .single()

  const { error: updateError } = await supabase
    .from("users")
    .update({
      full_name: payload.fullName.trim() || null,
      display_name: payload.displayName.trim() || payload.fullName.trim() || null,
      avatar_url: payload.avatarUrl.trim() || null,
      bio: payload.bio.trim() || null,
      occupation_id: occupationId,
      location_id: locationId,
      gender_id: genderId,
      profile_headline: payload.profileHeadline.trim() || null,
      email: input.actorEmail ?? null,
      invited_by_code: payload.inviteCode.trim() || null,
      is_public: payload.visibility.isPublic,
      is_name_public: payload.visibility.isNamePublic,
      is_pfp_public: payload.visibility.isPfpPublic,
      is_gender_public: payload.visibility.isGenderPublic,
      is_occupation_public: payload.visibility.isOccupationPublic,
      is_location_public: payload.visibility.isLocationPublic,
      is_birthyear_public: payload.visibility.isBirthyearPublic,
      is_birthday_public: payload.visibility.isBirthdayPublic,
      status: "active",
    })
    .eq("user_id", input.actorUserId)

  if (updateError) {
    return commandFailure("profile_update_failed", updateError.message)
  }

  const { error: clearInterestsError } = await supabase.from("user_interests").delete().eq("user_id", input.actorUserId)
  if (clearInterestsError) {
    return commandFailure("interest_reset_failed", clearInterestsError.message)
  }

  if (payload.interestIds.length > 0) {
    const interestsPayload = payload.interestIds
      .map((interestId) => parseInteger(interestId))
      .filter((interestId): interestId is number => interestId !== null)
      .map((interest_id) => ({
        user_id: input.actorUserId,
        interest_id,
      }))

    if (interestsPayload.length > 0) {
      const { error: interestsError } = await supabase.from("user_interests").insert(interestsPayload)
      if (interestsError) {
        return commandFailure("interest_insert_failed", interestsError.message)
      }
    }
  }

  if (payload.inviteCode.trim() && !existingProfile?.invited_by_code) {
    const { data: inviteRow } = await supabase
      .from("invitation_codes")
      .select("usage_count")
      .eq("code", payload.inviteCode.trim())
      .single()

    if (inviteRow) {
      await supabase
        .from("invitation_codes")
        .update({ usage_count: inviteRow.usage_count + 1 })
        .eq("code", payload.inviteCode.trim())
    }
  }

  const { error: deleteDraftError } = await supabase.from("user_onboarding_drafts").delete().eq("user_id", input.actorUserId)
  if (deleteDraftError) {
    return commandFailure("draft_clear_failed", deleteDraftError.message)
  }

  return {
    ok: true,
    data: {
      nextFlow: payload.relationshipChoice === "create_project" ? "project" : null,
      relationshipChoice: payload.relationshipChoice,
    },
  }
}
