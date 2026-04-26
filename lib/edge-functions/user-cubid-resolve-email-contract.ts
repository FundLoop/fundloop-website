import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const USER_CUBID_RESOLVE_EMAIL_FUNCTION = "user-cubid-resolve-email"

export type UserCubidResolveEmailInput = {
  emailOverride?: string
}

export type UserCubidResolveEmailValidatedInput = {
  emailOverride?: string
}

export type UserCubidResolveEmailOutput = {
  cubidId: string | null
  primaryEmailIdentity: string | null
  cubidScore: number | null
  cubidIdentityStatus: "unlinked" | "linked" | "verified"
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validateUserCubidResolveEmailInput(input: unknown): EdgeCommandResult<UserCubidResolveEmailValidatedInput> {
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

export function isUserCubidResolveEmailOutput(value: unknown): value is UserCubidResolveEmailOutput {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as {
    cubidId?: unknown
    primaryEmailIdentity?: unknown
    cubidScore?: unknown
    cubidIdentityStatus?: unknown
  }

  return (
    (candidate.cubidId === null || typeof candidate.cubidId === "string") &&
    (candidate.primaryEmailIdentity === null || typeof candidate.primaryEmailIdentity === "string") &&
    (candidate.cubidScore === null || typeof candidate.cubidScore === "number") &&
    (candidate.cubidIdentityStatus === "unlinked" ||
      candidate.cubidIdentityStatus === "linked" ||
      candidate.cubidIdentityStatus === "verified")
  )
}
