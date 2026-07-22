import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const USER_ASSET_PREFERENCES_UPDATE_FUNCTION = "user-asset-preferences-update"

export const userAssetPreferenceTypes = ["project_token", "stablecoin", "fiat"] as const
export type UserAssetPreferenceType = (typeof userAssetPreferenceTypes)[number]

export type UserAssetPreferenceInput = {
  assetType: UserAssetPreferenceType
  assetCode: string
  projectId?: number
  accepted: boolean
}

export type UserAssetPreferencesUpdateCommandInput = {
  preferences: UserAssetPreferenceInput[]
  attemptId?: string
}

export type UserAssetPreferenceSummary = {
  id: number | null
  rank: number
  assetType: UserAssetPreferenceType
  assetCode: string
  projectId: number | null
  accepted: boolean
}

export type UserAssetPreferencesUpdateCommandOutput = {
  userId: string
  hasCustomPreferences: boolean
  preferences: UserAssetPreferenceSummary[]
  defaultPreferences: UserAssetPreferenceSummary[]
  rejectsAllProjectTokens: boolean
}

const ASSET_CODE_PATTERN = /^[A-Z0-9]{2,32}$/

export const defaultAssetPreferenceInputs: UserAssetPreferenceInput[] = [
  { assetType: "stablecoin", assetCode: "USDC", accepted: true },
  { assetType: "fiat", assetCode: "USD", accepted: true },
  { assetType: "project_token", assetCode: "PROJECT", projectId: 0, accepted: true },
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readOptionalString(input: Record<string, unknown>, key: string) {
  if (input[key] === undefined || input[key] === null) return edgeCommandSuccess(undefined)
  if (typeof input[key] !== "string") return edgeCommandFailure("invalid_payload", `${key} must be a string when provided.`)
  const value = input[key].trim()
  return edgeCommandSuccess(value || undefined)
}

function isUserAssetPreferenceType(value: unknown): value is UserAssetPreferenceType {
  return typeof value === "string" && userAssetPreferenceTypes.includes(value as UserAssetPreferenceType)
}

function normalizeAssetCode(value: unknown, index: number) {
  const assetCode = typeof value === "string" ? value.trim().toUpperCase() : ""
  if (!ASSET_CODE_PATTERN.test(assetCode)) {
    return edgeCommandFailure("invalid_payload", `preferences[${index}].assetCode must be a 2-32 character uppercase asset code.`)
  }

  return edgeCommandSuccess(assetCode)
}

function readProjectId(value: unknown, index: number) {
  if (value === undefined || value === null) return edgeCommandSuccess(undefined)
  if (!Number.isInteger(value) || Number(value) <= 0) {
    return edgeCommandFailure("invalid_payload", `preferences[${index}].projectId must be a positive integer when provided.`)
  }

  return edgeCommandSuccess(Number(value))
}

export function buildDefaultAssetPreferenceSummaries(): UserAssetPreferenceSummary[] {
  return defaultAssetPreferenceInputs.map((preference, index) => ({
    id: null,
    rank: index + 1,
    assetType: preference.assetType,
    assetCode: preference.assetCode,
    projectId: preference.assetType === "project_token" ? null : preference.projectId ?? null,
    accepted: preference.accepted,
  }))
}

export function validateUserAssetPreferencesUpdateInput(
  input: unknown,
): EdgeCommandResult<UserAssetPreferencesUpdateCommandInput> {
  if (!isPlainObject(input)) return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  if (!Array.isArray(input.preferences)) return edgeCommandFailure("invalid_payload", "preferences must be an array.")
  if (input.preferences.length > 30) return edgeCommandFailure("invalid_payload", "preferences cannot contain more than 30 rows.")

  const seen = new Set<string>()
  const preferences: UserAssetPreferenceInput[] = []

  for (const [index, rawPreference] of input.preferences.entries()) {
    if (!isPlainObject(rawPreference)) {
      return edgeCommandFailure("invalid_payload", `preferences[${index}] must be a JSON object.`)
    }

    if (!isUserAssetPreferenceType(rawPreference.assetType)) {
      return edgeCommandFailure("invalid_payload", `preferences[${index}].assetType must be project_token, stablecoin, or fiat.`)
    }

    const assetCode = normalizeAssetCode(rawPreference.assetCode, index)
    if (!assetCode.ok) return assetCode

    const projectId = readProjectId(rawPreference.projectId, index)
    if (!projectId.ok) return projectId

    if (rawPreference.assetType === "project_token" && !projectId.data) {
      return edgeCommandFailure("invalid_payload", `preferences[${index}].projectId is required for project_token preferences.`)
    }

    if (rawPreference.assetType !== "project_token" && projectId.data) {
      return edgeCommandFailure("invalid_payload", `preferences[${index}].projectId is only allowed for project_token preferences.`)
    }

    if (typeof rawPreference.accepted !== "boolean") {
      return edgeCommandFailure("invalid_payload", `preferences[${index}].accepted must be true or false.`)
    }

    const dedupeKey = `${rawPreference.assetType}:${assetCode.data}:${projectId.data ?? ""}`
    if (seen.has(dedupeKey)) {
      return edgeCommandFailure("invalid_payload", `preferences[${index}] duplicates an earlier asset preference.`)
    }
    seen.add(dedupeKey)

    preferences.push({
      assetType: rawPreference.assetType,
      assetCode: assetCode.data,
      projectId: projectId.data,
      accepted: rawPreference.accepted,
    })
  }

  const attemptId = readOptionalString(input, "attemptId")
  if (!attemptId.ok) return attemptId

  return edgeCommandSuccess({ preferences, attemptId: attemptId.data })
}

function isSummary(value: unknown): value is UserAssetPreferenceSummary {
  return (
    isPlainObject(value) &&
    (Number.isInteger(value.id) || value.id === null) &&
    Number.isInteger(value.rank) &&
    Number(value.rank) > 0 &&
    isUserAssetPreferenceType(value.assetType) &&
    typeof value.assetCode === "string" &&
    (Number.isInteger(value.projectId) || value.projectId === null) &&
    typeof value.accepted === "boolean"
  )
}

function isOutput(value: unknown): value is UserAssetPreferencesUpdateCommandOutput {
  return (
    isPlainObject(value) &&
    typeof value.userId === "string" &&
    typeof value.hasCustomPreferences === "boolean" &&
    Array.isArray(value.preferences) &&
    value.preferences.every(isSummary) &&
    Array.isArray(value.defaultPreferences) &&
    value.defaultPreferences.every(isSummary) &&
    typeof value.rejectsAllProjectTokens === "boolean"
  )
}

export function normalizeUserAssetPreferencesUpdateResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<UserAssetPreferencesUpdateCommandOutput> {
  if (!result.ok) return result
  if (!isOutput(result.data)) {
    return edgeCommandFailure("invalid_edge_response", `${USER_ASSET_PREFERENCES_UPDATE_FUNCTION} returned an invalid response envelope.`)
  }

  return edgeCommandSuccess(result.data)
}
