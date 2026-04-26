import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import { executeResolveCubidIdentityByEmailCommand } from "./resolve-email-command.ts"
import { createServerCubidApiClient } from "./server-client.ts"
import { getMissingRecommendedCredentials, inferSnapshotIdentityStatus, normalizeCubidIdentitySnapshot } from "./snapshot.ts"
import {
  isResolvedCubidIdentityStatus,
  toCubidIdentitySnapshot,
  toCubidIdentitySnapshotSummary,
  type CubidIdentitySnapshotRecord,
} from "./types.ts"

type CubidSyncFailureCode =
  | "missing_email"
  | "profile_load_failed"
  | "snapshot_load_failed"
  | "cubid_resolution_failed"
  | "cubid_sync_failed"
  | "snapshot_persist_failed"
  | "profile_update_failed"

type CubidSyncCommandFailure = {
  ok: false
  error: {
    code: CubidSyncFailureCode
    message: string
  }
}

type CubidSyncCommandSuccess = {
  ok: true
  data: {
    cubidId: string | null
    primaryEmailIdentity: string | null
    cubidScore: number | null
    cubidIdentityStatus: Database["public"]["Enums"]["cubid_identity_status"]
    cubidSnapshot: ReturnType<typeof toCubidIdentitySnapshotSummary>
    missingRecommendedStamps: ReturnType<typeof getMissingRecommendedCredentials>
  }
}

export type CubidSyncCommandResult = CubidSyncCommandSuccess | CubidSyncCommandFailure

type CubidSyncCommandInput = {
  actorUserId: string
  actorEmail: string | null
}

type CubidProfileRow = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "cubid_id" | "cubid_identity_status" | "cubid_score" | "primary_email_identity" | "full_name"
>

function commandFailure(code: CubidSyncFailureCode, message: string): CubidSyncCommandFailure {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

export async function executeSyncCubidProfileCommand(
  supabase: SupabaseClient<Database>,
  input: CubidSyncCommandInput,
): Promise<CubidSyncCommandResult> {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("cubid_id, cubid_identity_status, cubid_score, primary_email_identity, full_name")
    .eq("user_id", input.actorUserId)
    .single<CubidProfileRow>()

  if (profileError || !profile) {
    return commandFailure("profile_load_failed", profileError?.message ?? "Failed to load the FundLoop profile.")
  }

  const { data: existingSnapshotRow, error: existingSnapshotError } = await supabase
    .from("cubid_identity_snapshots")
    .select("*")
    .eq("user_id", input.actorUserId)
    .maybeSingle<CubidIdentitySnapshotRecord>()

  if (existingSnapshotError) {
    return commandFailure("snapshot_load_failed", existingSnapshotError.message)
  }

  const existingSnapshot = toCubidIdentitySnapshot(existingSnapshotRow)

  let resolvedCubidId = profile.cubid_id
  let resolvedIdentityStatus = profile.cubid_identity_status
  let primaryEmailIdentity = profile.primary_email_identity
  let cubidScore = profile.cubid_score

  if (!resolvedCubidId) {
    if (!input.actorEmail?.trim()) {
      return commandFailure("missing_email", "A signed-in email address is required before CUBID can be synced.")
    }

    const resolved = await executeResolveCubidIdentityByEmailCommand(supabase, input)
    if (!resolved.ok) {
      return commandFailure(
        resolved.error.code === "missing_email" ? "missing_email" : "cubid_resolution_failed",
        resolved.error.message,
      )
    }

    resolvedCubidId = resolved.data.cubidId
    resolvedIdentityStatus = resolved.data.cubidIdentityStatus
    primaryEmailIdentity = resolved.data.primaryEmailIdentity
    cubidScore = resolved.data.cubidScore
  }

  if (!resolvedCubidId) {
    return commandFailure("cubid_resolution_failed", "CUBID did not return a user identifier for this account.")
  }

  const cubidClient = createServerCubidApiClient()

  try {
    const [identity, score, stamps, userData] = await Promise.all([
      cubidClient.fetchIdentity({ userId: resolvedCubidId }),
      cubidClient.fetchScore({ userId: resolvedCubidId }).catch(() => null),
      cubidClient.fetchStamps({ userId: resolvedCubidId }),
      cubidClient.fetchUserData({ userId: resolvedCubidId }).catch(() => null),
    ])

    const normalizedSnapshot = normalizeCubidIdentitySnapshot({
      cubidUserId: resolvedCubidId,
      identity,
      score,
      stamps,
      userData,
    })

    const nextIdentityStatus = inferSnapshotIdentityStatus(resolvedIdentityStatus, normalizedSnapshot)
    const nextPrimaryEmailIdentity =
      primaryEmailIdentity ?? normalizedSnapshot.primaryEmail ?? profile.primary_email_identity ?? null

    const { error: snapshotPersistError } = await supabase.from("cubid_identity_snapshots").upsert(
      {
        user_id: input.actorUserId,
        cubid_user_id: normalizedSnapshot.cubidUserId,
        primary_email: normalizedSnapshot.primaryEmail,
        primary_name: normalizedSnapshot.primaryName,
        primary_phone: normalizedSnapshot.primaryPhone,
        cubid_score: normalizedSnapshot.cubidScore,
        available_stamp_types: normalizedSnapshot.availableStampTypes,
        verified_stamp_types: normalizedSnapshot.verifiedStampTypes,
        raw_identity: normalizedSnapshot.rawIdentity,
        raw_stamps: normalizedSnapshot.rawStamps,
        last_synced_at: normalizedSnapshot.lastSyncedAt,
        last_sync_error_code: null,
        last_sync_error_message: null,
      },
      { onConflict: "user_id" },
    )

    if (snapshotPersistError) {
      return commandFailure("snapshot_persist_failed", snapshotPersistError.message)
    }

    const nextScore = normalizedSnapshot.cubidScore ?? cubidScore ?? null
    const { error: profileUpdateError } = await supabase
      .from("users")
      .update({
        ...(normalizedSnapshot.primaryName ? { full_name: normalizedSnapshot.primaryName } : {}),
        cubid_id: resolvedCubidId,
        cubid_score: nextScore,
        cubid_identity_status:
          resolvedIdentityStatus === "verified" || nextIdentityStatus === "verified" ? "verified" : "linked",
        ...(nextPrimaryEmailIdentity ? { primary_email_identity: nextPrimaryEmailIdentity } : {}),
      })
      .eq("user_id", input.actorUserId)

    if (profileUpdateError) {
      return commandFailure("profile_update_failed", profileUpdateError.message)
    }

    return {
      ok: true,
      data: {
        cubidId: resolvedCubidId,
        primaryEmailIdentity: nextPrimaryEmailIdentity,
        cubidScore: nextScore,
        cubidIdentityStatus:
          resolvedIdentityStatus === "verified" || nextIdentityStatus === "verified" ? "verified" : "linked",
        cubidSnapshot: toCubidIdentitySnapshotSummary(normalizedSnapshot),
        missingRecommendedStamps: getMissingRecommendedCredentials(normalizedSnapshot),
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to sync the CUBID identity snapshot."

    if (existingSnapshotRow) {
      await supabase
        .from("cubid_identity_snapshots")
        .update({
          last_sync_error_code: "cubid_sync_failed",
          last_sync_error_message: errorMessage,
        })
        .eq("user_id", input.actorUserId)
    } else if (resolvedCubidId) {
      await supabase.from("cubid_identity_snapshots").upsert(
        {
          user_id: input.actorUserId,
          cubid_user_id: resolvedCubidId,
          primary_name: existingSnapshot?.primaryName ?? profile.full_name ?? null,
          primary_email: existingSnapshot?.primaryEmail ?? null,
          primary_phone: existingSnapshot?.primaryPhone ?? null,
          cubid_score: existingSnapshot?.cubidScore ?? cubidScore ?? null,
          available_stamp_types: existingSnapshot?.availableStampTypes ?? [],
          verified_stamp_types: existingSnapshot?.verifiedStampTypes ?? [],
          raw_identity: existingSnapshot?.rawIdentity ?? {},
          raw_stamps: existingSnapshot?.rawStamps ?? [],
          last_synced_at: existingSnapshot?.lastSyncedAt ?? null,
          last_sync_error_code: "cubid_sync_failed",
          last_sync_error_message: errorMessage,
        },
        { onConflict: "user_id" },
      )
    }

    return commandFailure("cubid_sync_failed", errorMessage)
  }
}
