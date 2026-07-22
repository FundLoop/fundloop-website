import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  buildDefaultAssetPreferenceSummaries,
  type UserAssetPreferenceSummary,
} from "@/lib/edge-functions/user-asset-preferences-update-contract"

export type UserAssetPreferenceReadiness = {
  userId: string | null
  hasCustomPreferences: boolean
  preferences: UserAssetPreferenceSummary[]
  defaultPreferences: UserAssetPreferenceSummary[]
  rejectsAllProjectTokens: boolean
  warningCodes: Array<"using_defaults" | "rejects_all_project_tokens">
}

type PreferenceRow = Pick<
  Database["public"]["Tables"]["user_asset_preferences"]["Row"],
  "id" | "rank" | "asset_type" | "asset_code" | "project_id" | "accepted"
>

function mapPreference(row: PreferenceRow): UserAssetPreferenceSummary {
  return {
    id: Number(row.id),
    rank: Number(row.rank),
    assetType: row.asset_type,
    assetCode: row.asset_code,
    projectId: row.project_id === null ? null : Number(row.project_id),
    accepted: row.accepted,
  }
}

export function buildUserAssetPreferenceReadiness({
  userId,
  rows,
}: {
  userId: string | null
  rows: PreferenceRow[]
}): UserAssetPreferenceReadiness {
  const preferences = rows.map(mapPreference).sort((left, right) => left.rank - right.rank)
  const rejectsAllProjectTokens =
    preferences.some((preference) => preference.assetType === "project_token") &&
    preferences.filter((preference) => preference.assetType === "project_token").every((preference) => !preference.accepted)
  const warningCodes: UserAssetPreferenceReadiness["warningCodes"] = []

  if (preferences.length === 0) {
    warningCodes.push("using_defaults")
  }

  if (rejectsAllProjectTokens) {
    warningCodes.push("rejects_all_project_tokens")
  }

  return {
    userId,
    hasCustomPreferences: preferences.length > 0,
    preferences,
    defaultPreferences: buildDefaultAssetPreferenceSummaries(),
    rejectsAllProjectTokens,
    warningCodes,
  }
}

export async function getUserAssetPreferenceReadiness(
  userId: string | null | undefined,
  supabaseClient?: SupabaseClient<Database>,
): Promise<UserAssetPreferenceReadiness> {
  if (!userId) return buildUserAssetPreferenceReadiness({ userId: null, rows: [] })

  const supabase = supabaseClient ?? (await createServerSupabaseClient())
  const { data, error } = await supabase
    .from("user_asset_preferences")
    .select("id, rank, asset_type, asset_code, project_id, accepted")
    .eq("user_id", userId)
    .order("rank", { ascending: true })

  if (error) return buildUserAssetPreferenceReadiness({ userId, rows: [] })

  return buildUserAssetPreferenceReadiness({ userId, rows: (data ?? []) as PreferenceRow[] })
}
