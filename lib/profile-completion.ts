import { type CubidIdentitySnapshot, getMissingRecommendedStamps, hasVerifiedPhoneStamp, hasVerifiedProviderStamp } from "@/lib/cubid/types"

type LocalProfileState = {
  fullName: string | null | undefined
  displayName: string | null | undefined
  bio: string | null | undefined
  occupationId: string | number | null | undefined
  locationId: string | number | null | undefined
  interestCount: number
}

export type ProfileCompletionSnapshot = {
  percent: number
  missingItems: string[]
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim())
}

function hasSelection(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value)
  }

  return hasText(value ?? null)
}

export function computeHybridProfileCompletion(
  localProfile: LocalProfileState,
  cubidStatus: "unlinked" | "linked" | "verified",
  cubidSnapshot: CubidIdentitySnapshot | null,
): ProfileCompletionSnapshot {
  let percent = 0
  const missingItems: string[] = []

  const localChecks: Array<[string, boolean]> = [
    ["full_name", hasText(localProfile.fullName)],
    ["display_name", hasText(localProfile.displayName)],
    ["bio", hasText(localProfile.bio)],
    ["occupation", hasSelection(localProfile.occupationId)],
    ["location", hasSelection(localProfile.locationId)],
    ["interests", localProfile.interestCount > 0],
  ]

  for (const [key, complete] of localChecks) {
    if (complete) {
      percent += 10
    } else {
      missingItems.push(key)
    }
  }

  if (cubidStatus === "linked" || cubidStatus === "verified") {
    percent += 20
  } else {
    missingItems.push("cubid_link")
  }

  if (hasVerifiedPhoneStamp(cubidSnapshot)) {
    percent += 10
  } else {
    missingItems.push("cubid_phone")
  }

  if (hasVerifiedProviderStamp(cubidSnapshot)) {
    percent += 10
  } else {
    missingItems.push("cubid_provider")
  }

  return {
    percent,
    missingItems,
  }
}

export function getCompletionRecommendedStamps(snapshot: CubidIdentitySnapshot | null) {
  return getMissingRecommendedStamps(snapshot)
}
