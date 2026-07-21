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
  const { error: deleteError } = await supabase.from("user_asset_preferences").delete().eq("user_id", input.actorUserId)
  if (deleteError) return failure("preference_delete_failed", deleteError.message)

  if (input.preferences.length > 0) {
    const inserts = input.preferences.map((preference, index) => ({
      user_id: input.actorUserId,
      rank: index + 1,
      asset_type: preference.assetType,
      asset_code: preference.assetCode,
      project_id: preference.projectId ?? null,
      accepted: preference.accepted,
      created_by_user_id: input.actorUserId,
      updated_by_user_id: input.actorUserId,
    }))

    const { error: insertError } = await supabase.from("user_asset_preferences").insert(inserts)
    if (insertError) return failure("preference_insert_failed", insertError.message)
  }

  const { data: rows, error: readError } = await supabase
    .from("user_asset_preferences")
    .select("id, rank, asset_type, asset_code, project_id, accepted")
    .eq("user_id", input.actorUserId)
    .order("rank", { ascending: true })

  if (readError) return failure("preference_read_failed", readError.message)

  const preferences = ((rows ?? []) as PreferenceRow[]).map(normalizeSummary)
  return success({
    userId: input.actorUserId,
    hasCustomPreferences: preferences.length > 0,
    preferences,
    defaultPreferences: buildDefaultAssetPreferenceSummaries(),
    rejectsAllProjectTokens: rejectsAllProjectTokens(preferences),
  })
}
