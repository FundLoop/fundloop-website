import type { FetchIdentityResponse, FetchScoreResponse, FetchStampsResponse } from "@cubid/api"
import type { Json } from "@/types/supabase"
import {
  CUBID_RECOMMENDED_STAMPS,
  type CubidIdentitySnapshot,
  type CubidIdentityStatus,
  toDistinctStrings,
} from "./types"

type CubidSnapshotNormalizationInput = {
  cubidUserId: string
  identity: FetchIdentityResponse
  score: FetchScoreResponse | null
  stamps: FetchStampsResponse
}

function isVerifiedStatus(status: string | null | undefined) {
  return typeof status === "string" && status.trim().toLowerCase() === "verified"
}

function pickPrimaryPhone(stamps: FetchStampsResponse["allStamps"]) {
  const phoneStamp = stamps.find((stamp) => stamp.stampType === "phone" && stamp.identity)
  return phoneStamp?.identity ?? phoneStamp?.uniqueValue ?? null
}

export function normalizeCubidIdentitySnapshot(input: CubidSnapshotNormalizationInput): CubidIdentitySnapshot {
  const identityStampTypes = input.identity.stampDetails.map((detail) => detail.stampType)
  const fetchedStampTypes = input.stamps.allStamps.map((stamp) => stamp.stampType ?? null)

  const availableStampTypes = toDistinctStrings([...identityStampTypes, ...fetchedStampTypes])
  const verifiedStampTypes = toDistinctStrings([
    ...input.identity.stampDetails
      .filter((detail) => isVerifiedStatus(detail.status))
      .map((detail) => detail.stampType),
    ...input.stamps.allStamps.filter((stamp) => stamp.isValid).map((stamp) => stamp.stampType ?? null),
  ])

  return {
    cubidUserId: input.cubidUserId,
    primaryEmail: input.stamps.email,
    primaryPhone: pickPrimaryPhone(input.stamps.allStamps),
    cubidScore: input.score?.cubidScore ?? null,
    availableStampTypes,
    verifiedStampTypes,
    rawIdentity: input.identity as unknown as Json,
    rawStamps: input.stamps.allStamps as unknown as Json,
    lastSyncedAt: new Date().toISOString(),
    lastSyncErrorCode: null,
    lastSyncErrorMessage: null,
  }
}

export function inferSnapshotIdentityStatus(
  currentStatus: CubidIdentityStatus | null | undefined,
  snapshot: Pick<CubidIdentitySnapshot, "primaryEmail" | "verifiedStampTypes">,
) {
  if (currentStatus === "verified") {
    return currentStatus
  }

  const hasVerifiedEmail = snapshot.verifiedStampTypes.includes("email")
  if (hasVerifiedEmail) {
    return "verified" as const
  }

  return "linked" as const
}

export function getMissingRecommendedCredentials(snapshot: Pick<CubidIdentitySnapshot, "availableStampTypes" | "verifiedStampTypes"> | null) {
  if (!snapshot) {
    return [...CUBID_RECOMMENDED_STAMPS]
  }

  const present = new Set(toDistinctStrings([...snapshot.availableStampTypes, ...snapshot.verifiedStampTypes]))
  return CUBID_RECOMMENDED_STAMPS.filter((stamp) => !present.has(stamp))
}
