import { computeHybridProfileCompletion } from "@/lib/profile-completion"
import {
  toCubidIdentitySnapshot,
  toCubidIdentitySnapshotSummary,
  type CubidIdentitySnapshotRecord,
  type CubidIdentityStatus,
} from "@/lib/cubid/types"

type CompletionSourceProfile = {
  fullName: string | null | undefined
  displayName: string | null | undefined
  bio: string | null | undefined
  occupationId: string | number | null | undefined
  locationId: string | number | null | undefined
  cubidIdentityStatus: CubidIdentityStatus | null | undefined
}

export function buildCubidIdentityReadModel(
  profile: CompletionSourceProfile | null | undefined,
  snapshotRecord: CubidIdentitySnapshotRecord | null | undefined,
  interestCount: number,
) {
  const cubidSnapshot = toCubidIdentitySnapshot(snapshotRecord)
  const completion = computeHybridProfileCompletion(
    {
      fullName: profile?.fullName,
      displayName: profile?.displayName,
      bio: profile?.bio,
      occupationId: profile?.occupationId,
      locationId: profile?.locationId,
      interestCount,
    },
    profile?.cubidIdentityStatus ?? "unlinked",
    cubidSnapshot,
  )

  return {
    cubidSnapshot,
    cubidSnapshotSummary: toCubidIdentitySnapshotSummary(cubidSnapshot),
    profileCompletionPercent: completion.percent,
    profileCompletionMissingItems: completion.missingItems,
  }
}
