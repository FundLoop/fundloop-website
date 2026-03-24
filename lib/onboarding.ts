import type { Tables } from "@/types/supabase"

export const USER_ONBOARDING_SCREENS = [
  "welcome",
  "resume",
  "identity",
  "visibility",
  "about",
  "relationship",
  "review",
] as const

export const PROJECT_ONBOARDING_SCREENS = [
  "resume",
  "basics",
  "details",
  "contribution",
  "review",
] as const

export type UserOnboardingScreen = (typeof USER_ONBOARDING_SCREENS)[number]
export type ProjectOnboardingScreen = (typeof PROJECT_ONBOARDING_SCREENS)[number]

export type PrivacyPreset = "public" | "limited" | "private"
export type RelationshipChoice = "individual" | "team_member" | "create_project"

export type UserVisibilitySettings = {
  isPublic: boolean
  isNamePublic: boolean
  isPfpPublic: boolean
  isGenderPublic: boolean
  isOccupationPublic: boolean
  isLocationPublic: boolean
  isBirthyearPublic: boolean
  isBirthdayPublic: boolean
}

export type UserOnboardingPayload = {
  fullName: string
  displayName: string
  profileHeadline: string
  avatarUrl: string
  bio: string
  occupationId: string
  locationId: string
  genderId: string
  interestIds: string[]
  inviteCode: string
  privacyPreset: PrivacyPreset
  visibility: UserVisibilitySettings
  relationshipChoice: RelationshipChoice
  selectedProjectId: number | null
}

export type ProjectOnboardingPayload = {
  name: string
  slug: string
  logoUrl: string
  website: string
  description: string
  contactEmail: string
  detailedDescription: string
  categoryIds: string[]
  pledgeAccepted: boolean
  paymentMethodId: string
  billingEmail: string
  billingFrequency: string
  paymentPercentage: string
  paymentPeriodicityId: string
}

export type UserDraftRow = Tables<"user_onboarding_drafts">
export type ProjectDraftRow = Tables<"project_onboarding_drafts">

export type TeamMemberContact = {
  name: string
  role: string
  email: string | null
}

export type TeamMemberProjectMatch = {
  id: number
  name: string
  slug: string | null
  description: string
  website: string | null
  contactEmail: string | null
  contacts: TeamMemberContact[]
  fallbackMessage: string
}

export const DEFAULT_USER_VISIBILITY: Record<PrivacyPreset, UserVisibilitySettings> = {
  public: {
    isPublic: true,
    isNamePublic: true,
    isPfpPublic: true,
    isGenderPublic: true,
    isOccupationPublic: true,
    isLocationPublic: true,
    isBirthyearPublic: false,
    isBirthdayPublic: false,
  },
  limited: {
    isPublic: true,
    isNamePublic: true,
    isPfpPublic: true,
    isGenderPublic: false,
    isOccupationPublic: true,
    isLocationPublic: true,
    isBirthyearPublic: false,
    isBirthdayPublic: false,
  },
  private: {
    isPublic: false,
    isNamePublic: false,
    isPfpPublic: false,
    isGenderPublic: false,
    isOccupationPublic: false,
    isLocationPublic: false,
    isBirthyearPublic: false,
    isBirthdayPublic: false,
  },
}

export const DEFAULT_USER_ONBOARDING_PAYLOAD: UserOnboardingPayload = {
  fullName: "",
  displayName: "",
  profileHeadline: "",
  avatarUrl: "",
  bio: "",
  occupationId: "",
  locationId: "",
  genderId: "",
  interestIds: [],
  inviteCode: "",
  privacyPreset: "limited",
  visibility: DEFAULT_USER_VISIBILITY.limited,
  relationshipChoice: "individual",
  selectedProjectId: null,
}

export const DEFAULT_PROJECT_ONBOARDING_PAYLOAD: ProjectOnboardingPayload = {
  name: "",
  slug: "",
  logoUrl: "",
  website: "",
  description: "",
  contactEmail: "",
  detailedDescription: "",
  categoryIds: [],
  pledgeAccepted: false,
  paymentMethodId: "",
  billingEmail: "",
  billingFrequency: "monthly",
  paymentPercentage: "1.0",
  paymentPeriodicityId: "",
}

export function mergeUserOnboardingPayload(
  payload: Partial<UserOnboardingPayload> | null | undefined,
): UserOnboardingPayload {
  return {
    ...DEFAULT_USER_ONBOARDING_PAYLOAD,
    ...payload,
    visibility: {
      ...DEFAULT_USER_ONBOARDING_PAYLOAD.visibility,
      ...payload?.visibility,
    },
    interestIds: payload?.interestIds ?? DEFAULT_USER_ONBOARDING_PAYLOAD.interestIds,
  }
}

export function mergeProjectOnboardingPayload(
  payload: Partial<ProjectOnboardingPayload> | null | undefined,
): ProjectOnboardingPayload {
  return {
    ...DEFAULT_PROJECT_ONBOARDING_PAYLOAD,
    ...payload,
    categoryIds: payload?.categoryIds ?? DEFAULT_PROJECT_ONBOARDING_PAYLOAD.categoryIds,
  }
}

export function buildVisibilityFromPreset(preset: PrivacyPreset): UserVisibilitySettings {
  return { ...DEFAULT_USER_VISIBILITY[preset] }
}

export function sanitizeProjectSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function getDisplayName(payload: Pick<UserOnboardingPayload, "displayName" | "fullName">) {
  return payload.displayName.trim() || payload.fullName.trim() || "Future FundLoop member"
}
