import type { Tables } from "../../types/supabase.ts"

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function isNullableString(value: unknown) {
  return value === null || typeof value === "string"
}

export function isNullableNumber(value: unknown) {
  return value === null || typeof value === "number"
}

export function isUserOnboardingDraftRow(value: unknown): value is Tables<"user_onboarding_drafts"> {
  return (
    isPlainObject(value) &&
    typeof value.id === "number" &&
    typeof value.user_id === "string" &&
    typeof value.current_screen === "string" &&
    typeof value.started_at === "string" &&
    typeof value.updated_at === "string" &&
    isNullableString(value.completed_at) &&
    value.payload !== undefined
  )
}

export function isProjectOnboardingDraftRow(value: unknown): value is Tables<"project_onboarding_drafts"> {
  return (
    isPlainObject(value) &&
    typeof value.id === "number" &&
    typeof value.user_id === "string" &&
    typeof value.current_screen === "string" &&
    typeof value.started_at === "string" &&
    typeof value.updated_at === "string" &&
    isNullableString(value.completed_at) &&
    value.payload !== undefined
  )
}
