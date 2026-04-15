import { computeHybridProfileCompletion } from "@/lib/profile-completion"
import {
  toCubidIdentitySnapshot,
  toCubidIdentitySnapshotSummary,
  type CubidIdentitySnapshotRecord,
  type CubidIdentityStatus,
} from "@/lib/cubid/types"

export type ManagedIdentityFieldState = "synced" | "pending" | "legacy_local_fallback"

export type ManagedIdentityField = {
  value: string | null
  state: ManagedIdentityFieldState
}

export type CubidIdentityOwnership = {
  cubidManaged: string[]
  fundloopManaged: string[]
}

type CompletionSourceProfile = {
  fullName: string | null | undefined
  displayName: string | null | undefined
  profileHeadline: string | null | undefined
  bio: string | null | undefined
  occupationId: string | number | null | undefined
  locationId: string | number | null | undefined
  cubidIdentityStatus: CubidIdentityStatus | null | undefined
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim())
}

function buildManagedIdentityField(cubidValue: string | null | undefined, legacyValue?: string | null | undefined): ManagedIdentityField {
  if (hasText(cubidValue)) {
    return {
      value: cubidValue!.trim(),
      state: "synced",
    }
  }

  if (hasText(legacyValue)) {
    return {
      value: legacyValue!.trim(),
      state: "legacy_local_fallback",
    }
  }

  return {
    value: null,
    state: "pending",
  }
}

export function buildCubidIdentityReadModel(
  profile: CompletionSourceProfile | null | undefined,
  snapshotRecord: CubidIdentitySnapshotRecord | null | undefined,
  interestCount: number,
) {
  const cubidSnapshot = toCubidIdentitySnapshot(snapshotRecord)
  const completion = computeHybridProfileCompletion(
    {
      displayName: profile?.displayName,
      profileHeadline: profile?.profileHeadline,
      bio: profile?.bio,
      occupationId: profile?.occupationId,
      locationId: profile?.locationId,
      interestCount,
    },
    profile?.cubidIdentityStatus ?? "unlinked",
    cubidSnapshot,
  )

  const managedIdentity = {
    fullName: buildManagedIdentityField(cubidSnapshot?.primaryName, profile?.fullName),
    primaryEmail: buildManagedIdentityField(cubidSnapshot?.primaryEmail),
    primaryPhone: buildManagedIdentityField(cubidSnapshot?.primaryPhone),
  }

  const identityOwnership: CubidIdentityOwnership = {
    cubidManaged: ["full_name", "email", "phone", "provider_stamps", "verification_state", "cubid_score"],
    fundloopManaged: ["display_name", "profile_headline", "bio", "occupation", "location", "interests", "visibility", "wallets"],
  }

  return {
    cubidSnapshot,
    cubidSnapshotSummary: toCubidIdentitySnapshotSummary(cubidSnapshot),
    managedIdentity,
    identityOwnership,
    profileCompletionPercent: completion.percent,
    profileCompletionMissingItems: completion.missingItems,
  }
}
