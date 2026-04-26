import type { Database, Json } from "../../types/supabase.ts"

export type CubidIdentityStatus = Database["public"]["Enums"]["cubid_identity_status"]

export const CUBID_PROVIDER_STAMPS = ["google", "github", "linkedin", "twitter", "discord"] as const
export const CUBID_RECOMMENDED_STAMPS = ["phone", ...CUBID_PROVIDER_STAMPS] as const

export type CubidProviderStamp = (typeof CUBID_PROVIDER_STAMPS)[number]
export type CubidRecommendedStamp = (typeof CUBID_RECOMMENDED_STAMPS)[number]

export type CubidIdentityLinkState = {
  cubidId: string | null
  primaryEmailIdentity: string | null
  cubidScore: number | null
  cubidIdentityStatus: CubidIdentityStatus
}

export type CubidIdentitySnapshot = {
  cubidUserId: string
  primaryName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  cubidScore: number | null
  availableStampTypes: string[]
  verifiedStampTypes: string[]
  rawIdentity: Json
  rawStamps: Json
  lastSyncedAt: string | null
  lastSyncErrorCode: string | null
  lastSyncErrorMessage: string | null
}

export type CubidIdentitySnapshotSummary = Pick<
  CubidIdentitySnapshot,
  | "primaryName"
  | "primaryEmail"
  | "primaryPhone"
  | "cubidScore"
  | "availableStampTypes"
  | "verifiedStampTypes"
  | "lastSyncedAt"
  | "lastSyncErrorCode"
  | "lastSyncErrorMessage"
>

export type CubidIdentitySnapshotRecord = Database["public"]["Tables"]["cubid_identity_snapshots"]["Row"]

export function isResolvedCubidIdentityStatus(status: CubidIdentityStatus | null | undefined) {
  return status === "linked" || status === "verified"
}

export function isCubidProviderStamp(value: string): value is CubidProviderStamp {
  return CUBID_PROVIDER_STAMPS.includes(value as CubidProviderStamp)
}

export function toDistinctStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim().toLowerCase()).filter((value): value is string => Boolean(value))),
  )
}

export function toCubidIdentitySnapshot(record: CubidIdentitySnapshotRecord | null | undefined): CubidIdentitySnapshot | null {
  if (!record) {
    return null
  }

  return {
    cubidUserId: record.cubid_user_id,
    primaryName: record.primary_name,
    primaryEmail: record.primary_email,
    primaryPhone: record.primary_phone,
    cubidScore: record.cubid_score,
    availableStampTypes: toDistinctStrings(record.available_stamp_types ?? []),
    verifiedStampTypes: toDistinctStrings(record.verified_stamp_types ?? []),
    rawIdentity: record.raw_identity,
    rawStamps: record.raw_stamps,
    lastSyncedAt: record.last_synced_at,
    lastSyncErrorCode: record.last_sync_error_code,
    lastSyncErrorMessage: record.last_sync_error_message,
  }
}

export function toCubidIdentitySnapshotSummary(
  snapshot: Pick<
    CubidIdentitySnapshot,
    | "primaryName"
    | "primaryEmail"
    | "primaryPhone"
    | "cubidScore"
    | "availableStampTypes"
    | "verifiedStampTypes"
    | "lastSyncedAt"
    | "lastSyncErrorCode"
    | "lastSyncErrorMessage"
  > | null | undefined,
): CubidIdentitySnapshotSummary | null {
  if (!snapshot) {
    return null
  }

  return {
    primaryName: snapshot.primaryName ?? null,
    primaryEmail: snapshot.primaryEmail ?? null,
    primaryPhone: snapshot.primaryPhone ?? null,
    cubidScore: snapshot.cubidScore ?? null,
    availableStampTypes: toDistinctStrings(snapshot.availableStampTypes ?? []),
    verifiedStampTypes: toDistinctStrings(snapshot.verifiedStampTypes ?? []),
    lastSyncedAt: snapshot.lastSyncedAt ?? null,
    lastSyncErrorCode: snapshot.lastSyncErrorCode ?? null,
    lastSyncErrorMessage: snapshot.lastSyncErrorMessage ?? null,
  }
}

export function getMissingRecommendedStamps(snapshot: Pick<CubidIdentitySnapshot, "availableStampTypes" | "verifiedStampTypes"> | null) {
  if (!snapshot) {
    return [...CUBID_RECOMMENDED_STAMPS]
  }

  const present = new Set(
    toDistinctStrings([
      ...snapshot.availableStampTypes,
      ...snapshot.verifiedStampTypes,
    ]),
  )

  return CUBID_RECOMMENDED_STAMPS.filter((stamp) => !present.has(stamp))
}

export function hasVerifiedPhoneStamp(snapshot: Pick<CubidIdentitySnapshot, "verifiedStampTypes"> | null) {
  return Boolean(snapshot?.verifiedStampTypes.includes("phone"))
}

export function getVerifiedProviderStamps(snapshot: Pick<CubidIdentitySnapshot, "verifiedStampTypes"> | null) {
  const verified = new Set(snapshot?.verifiedStampTypes ?? [])
  return CUBID_PROVIDER_STAMPS.filter((stamp) => verified.has(stamp))
}

export function hasVerifiedProviderStamp(snapshot: Pick<CubidIdentitySnapshot, "verifiedStampTypes"> | null) {
  return getVerifiedProviderStamps(snapshot).length > 0
}
