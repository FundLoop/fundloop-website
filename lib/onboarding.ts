import type { Tables } from "../types/supabase.ts"

export const USER_ONBOARDING_SCREENS = [
  "welcome",
  "resume",
  "cubid",
  "extended_identity",
  "identity",
  "visibility",
  "about",
  "relationship",
  "review",
] as const

export const PROJECT_ONBOARDING_SCREENS = [
  "resume",
  "cubid",
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
  billingEmail: string
  billingFrequency: string
  paymentPercentage: string
  defaultReportingCurrencyCode: string
  paymentPeriodicityId: string
  cryptoPaymentMethods: ProjectCryptoPaymentMethod[]
}

export type ProjectCryptoPaymentMethod = {
  id: string
  chainId: string
  chainAssetId: string
  intakeContractId: string
  label: string
  isDefault: boolean
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
  billingEmail: "",
  billingFrequency: "monthly",
  paymentPercentage: "1.0",
  defaultReportingCurrencyCode: "USD",
  paymentPeriodicityId: "",
  cryptoPaymentMethods: [],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function getBooleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback
}

export function sanitizeUserOnboardingPayload(payload: unknown): Partial<UserOnboardingPayload> {
  if (!isRecord(payload)) {
    return {}
  }

  const visibility = isRecord(payload.visibility) ? payload.visibility : {}
  const relationshipChoice = payload.relationshipChoice
  const privacyPreset = payload.privacyPreset

  return {
    fullName: getStringValue(payload.fullName),
    displayName: getStringValue(payload.displayName),
    profileHeadline: getStringValue(payload.profileHeadline),
    avatarUrl: getStringValue(payload.avatarUrl),
    bio: getStringValue(payload.bio),
    occupationId: getStringValue(payload.occupationId),
    locationId: getStringValue(payload.locationId),
    genderId: getStringValue(payload.genderId),
    interestIds: getStringArray(payload.interestIds),
    inviteCode: getStringValue(payload.inviteCode),
    privacyPreset:
      privacyPreset === "public" || privacyPreset === "limited" || privacyPreset === "private" ? privacyPreset : undefined,
    visibility: {
      isPublic: getBooleanValue(visibility.isPublic, DEFAULT_USER_ONBOARDING_PAYLOAD.visibility.isPublic),
      isNamePublic: getBooleanValue(visibility.isNamePublic, DEFAULT_USER_ONBOARDING_PAYLOAD.visibility.isNamePublic),
      isPfpPublic: getBooleanValue(visibility.isPfpPublic, DEFAULT_USER_ONBOARDING_PAYLOAD.visibility.isPfpPublic),
      isGenderPublic: getBooleanValue(visibility.isGenderPublic, DEFAULT_USER_ONBOARDING_PAYLOAD.visibility.isGenderPublic),
      isOccupationPublic: getBooleanValue(
        visibility.isOccupationPublic,
        DEFAULT_USER_ONBOARDING_PAYLOAD.visibility.isOccupationPublic,
      ),
      isLocationPublic: getBooleanValue(visibility.isLocationPublic, DEFAULT_USER_ONBOARDING_PAYLOAD.visibility.isLocationPublic),
      isBirthyearPublic: getBooleanValue(
        visibility.isBirthyearPublic,
        DEFAULT_USER_ONBOARDING_PAYLOAD.visibility.isBirthyearPublic,
      ),
      isBirthdayPublic: getBooleanValue(
        visibility.isBirthdayPublic,
        DEFAULT_USER_ONBOARDING_PAYLOAD.visibility.isBirthdayPublic,
      ),
    },
    relationshipChoice:
      relationshipChoice === "individual" || relationshipChoice === "team_member" || relationshipChoice === "create_project"
        ? relationshipChoice
        : undefined,
    selectedProjectId: typeof payload.selectedProjectId === "number" ? payload.selectedProjectId : null,
  }
}

export function sanitizeProjectOnboardingPayload(payload: unknown): Partial<ProjectOnboardingPayload> {
  if (!isRecord(payload)) {
    return {}
  }

  const rawMethods = Array.isArray(payload.cryptoPaymentMethods) ? payload.cryptoPaymentMethods : []

  return {
    name: getStringValue(payload.name),
    slug: getStringValue(payload.slug),
    logoUrl: getStringValue(payload.logoUrl),
    website: getStringValue(payload.website),
    description: getStringValue(payload.description),
    contactEmail: getStringValue(payload.contactEmail),
    detailedDescription: getStringValue(payload.detailedDescription),
    categoryIds: getStringArray(payload.categoryIds),
    pledgeAccepted: getBooleanValue(payload.pledgeAccepted),
    billingEmail: getStringValue(payload.billingEmail),
    billingFrequency: getStringValue(payload.billingFrequency),
    paymentPercentage: getStringValue(payload.paymentPercentage),
    defaultReportingCurrencyCode: getStringValue(payload.defaultReportingCurrencyCode),
    paymentPeriodicityId: getStringValue(payload.paymentPeriodicityId),
    cryptoPaymentMethods: rawMethods
      .filter(isRecord)
      .map((method) => ({
        id: getStringValue(method.id),
        chainId: getStringValue(method.chainId),
        chainAssetId: getStringValue(method.chainAssetId),
        intakeContractId: getStringValue(method.intakeContractId),
        label: getStringValue(method.label),
        isDefault: getBooleanValue(method.isDefault),
      })),
  }
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
    cryptoPaymentMethods: payload?.cryptoPaymentMethods ?? DEFAULT_PROJECT_ONBOARDING_PAYLOAD.cryptoPaymentMethods,
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

export function createEmptyProjectCryptoPaymentMethod(): ProjectCryptoPaymentMethod {
  return {
    id: crypto.randomUUID(),
    chainId: "",
    chainAssetId: "",
    intakeContractId: "",
    label: "",
    isDefault: false,
  }
}
