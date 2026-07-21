import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import {
  buildDefaultAssetPreferenceSummaries,
  type UserAssetPreferenceInput,
  type UserAssetPreferenceSummary,
  type UserAssetPreferencesUpdateCommandOutput,
} from "../edge-functions/user-asset-preferences-update-contract.ts"

type CommandResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

export type UserAssetPreferencesUpdateExecutionInput = {
  actorUserId: string
  preferences: UserAssetPreferenceInput[]
}

type PreferenceRow = Pick<
  Database["public"]["Tables"]["user_asset_preferences"]["Row"],
  "id" | "rank" | "asset_type" | "asset_code" | "project_id" | "accepted"
>

function success<T>(data: T): CommandResult<T> {
  return { ok: true, data }
}

function failure(code: string, message: string): CommandResult<never> {
  return { ok: false, error: { code, message } }
}

function normalizeSummary(row: PreferenceRow): UserAssetPreferenceSummary {
  return {
    id: Number(row.id),
    rank: Number(row.rank),
    assetType: row.asset_type,
    assetCode: row.asset_code,
    projectId: row.project_id === null ? null : Number(row.project_id),
    accepted: row.accepted,
  }
}

function rejectsAllProjectTokens(preferences: UserAssetPreferenceSummary[]) {
  const projectTokenPreferences = preferences.filter((preference) => preference.assetType === "project_token")
  return projectTokenPreferences.length > 0 && projectTokenPreferences.every((preference) => !preference.accepted)
}

export async function executeUserAssetPreferencesUpdateCommand(
  supabase: SupabaseClient<Database>,
  input: UserAssetPreferencesUpdateExecutionInput,
): Promise<CommandResult<UserAssetPreferencesUpdateCommandOutput>> {
  const { data: rows, error: replaceError } = await supabase.rpc("replace_user_asset_preferences_atomic", {
    p_user_id: input.actorUserId,
    p_preferences: input.preferences,
  })

  if (replaceError) return failure("preference_replace_failed", replaceError.message)

  const preferences = ((rows ?? []) as PreferenceRow[]).map(normalizeSummary)
  return success({
    userId: input.actorUserId,
    hasCustomPreferences: preferences.length > 0,
    preferences,
    defaultPreferences: buildDefaultAssetPreferenceSummaries(),
    rejectsAllProjectTokens: rejectsAllProjectTokens(preferences),
  })
}
