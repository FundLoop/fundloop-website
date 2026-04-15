import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

export const USER_CUBID_SYNC_PROFILE_FUNCTION = "user-cubid-sync-profile"

export type UserCubidSyncProfileInput = {
  emailOverride?: string
}

export type UserCubidSyncProfileValidatedInput = {
  emailOverride?: string
}

export type UserCubidSnapshotSummaryOutput = {
  primaryName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  cubidScore: number | null
  availableStampTypes: string[]
  verifiedStampTypes: string[]
  lastSyncedAt: string | null
  lastSyncErrorCode: string | null
  lastSyncErrorMessage: string | null
}

export type UserCubidSyncProfileOutput = {
  cubidId: string | null
  primaryEmailIdentity: string | null
  cubidScore: number | null
  cubidIdentityStatus: "unlinked" | "linked" | "verified"
  cubidSnapshot: UserCubidSnapshotSummaryOutput | null
  missingRecommendedStamps: string[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validateUserCubidSyncProfileInput(input: unknown): EdgeCommandResult<UserCubidSyncProfileValidatedInput> {
  if (input === undefined) {
    return edgeCommandSuccess({})
  }

  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  if (input.emailOverride !== undefined && typeof input.emailOverride !== "string") {
    return edgeCommandFailure("invalid_payload", "emailOverride must be a string when provided.")
  }

  const emailOverride =
    typeof input.emailOverride === "string" && input.emailOverride.trim() ? input.emailOverride.trim().toLowerCase() : undefined

  return edgeCommandSuccess({ emailOverride })
}

function isSnapshotSummaryOutput(value: unknown): value is UserCubidSnapshotSummaryOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    (candidate.primaryName === null || typeof candidate.primaryName === "string") &&
    (candidate.primaryEmail === null || typeof candidate.primaryEmail === "string") &&
    (candidate.primaryPhone === null || typeof candidate.primaryPhone === "string") &&
    (candidate.cubidScore === null || typeof candidate.cubidScore === "number") &&
    Array.isArray(candidate.availableStampTypes) &&
    candidate.availableStampTypes.every((item) => typeof item === "string") &&
    Array.isArray(candidate.verifiedStampTypes) &&
    candidate.verifiedStampTypes.every((item) => typeof item === "string") &&
    (candidate.lastSyncedAt === null || typeof candidate.lastSyncedAt === "string") &&
    (candidate.lastSyncErrorCode === null || typeof candidate.lastSyncErrorCode === "string") &&
    (candidate.lastSyncErrorMessage === null || typeof candidate.lastSyncErrorMessage === "string")
  )
}

export function isUserCubidSyncProfileOutput(value: unknown): value is UserCubidSyncProfileOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    (candidate.cubidId === null || typeof candidate.cubidId === "string") &&
    (candidate.primaryEmailIdentity === null || typeof candidate.primaryEmailIdentity === "string") &&
    (candidate.cubidScore === null || typeof candidate.cubidScore === "number") &&
    (candidate.cubidIdentityStatus === "unlinked" ||
      candidate.cubidIdentityStatus === "linked" ||
      candidate.cubidIdentityStatus === "verified") &&
    (candidate.cubidSnapshot === null || isSnapshotSummaryOutput(candidate.cubidSnapshot)) &&
    Array.isArray(candidate.missingRecommendedStamps) &&
    candidate.missingRecommendedStamps.every((item) => typeof item === "string")
  )
}
