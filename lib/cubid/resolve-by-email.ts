import { getCubidConfig, type CubidConfig } from "./config"
import type { CubidIdentitySnapshot } from "./types"

type CubidFetch = typeof fetch

type CubidApiError = {
  message?: unknown
  error?: unknown
}

type CubidApiResponse = Record<string, unknown>

type ResolveCubidIdentityByEmailInput = {
  email: string
  primaryEmailIdentity: string | null
  config?: CubidConfig
  fetchImpl?: CubidFetch
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function extractNestedObjects(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 6) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractNestedObjects(item, depth + 1))
  }

  if (!isPlainObject(value)) {
    return []
  }

  return [value, ...Object.values(value).flatMap((entry) => extractNestedObjects(entry, depth + 1))]
}

function findFirstString(value: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    let current: unknown = value

    for (const key of path) {
      if (!isPlainObject(current)) {
        current = undefined
        break
      }

      current = current[key]
    }

    const found = getString(current)
    if (found) {
      return found
    }
  }

  return null
}

function findFirstNumber(value: unknown, paths: string[][]): number | null {
  for (const path of paths) {
    let current: unknown = value

    for (const key of path) {
      if (!isPlainObject(current)) {
        current = undefined
        break
      }

      current = current[key]
    }

    const found = getNumber(current)
    if (found !== null) {
      return found
    }
  }

  return null
}

function hasVerifiedFlag(candidate: Record<string, unknown>) {
  const directFlags = [candidate.verified, candidate.is_verified, candidate.isVerified]
  if (directFlags.some((value) => value === true)) {
    return true
  }

  const statusFields = [candidate.status, candidate.verification_status, candidate.verificationStatus, candidate.state]
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))

  return statusFields.includes("verified")
}

function inferIdentityStatus(identityResponse: unknown, normalizedEmail: string) {
  const candidates = extractNestedObjects(identityResponse)
  const matchingEmailObject = candidates.find((candidate) => {
    const possibleEmail = [candidate.email, candidate.identity, candidate.value, candidate.address]
      .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
      .find(Boolean)

    return possibleEmail === normalizedEmail
  })

  if (matchingEmailObject && hasVerifiedFlag(matchingEmailObject)) {
    return "verified" as const
  }

  if (
    candidates.some((candidate) => {
      const value = [candidate.primary_email, candidate.primaryEmail, candidate.email]
        .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
        .find(Boolean)

      return value === normalizedEmail && hasVerifiedFlag(candidate)
    })
  ) {
    return "verified" as const
  }

  return "linked" as const
}

function getCubidUserId(value: unknown) {
  return findFirstString(value, [
    ["user_id"],
    ["userId"],
    ["id"],
    ["data", "user_id"],
    ["data", "userId"],
    ["data", "id"],
    ["user", "user_id"],
    ["user", "id"],
  ])
}

function getCubidScore(value: unknown) {
  return findFirstNumber(value, [
    ["score"],
    ["trust_score"],
    ["cubid_score"],
    ["data", "score"],
    ["data", "trust_score"],
    ["data", "cubid_score"],
  ])
}

async function postCubid<T extends CubidApiResponse>(
  endpoint: string,
  body: Record<string, unknown>,
  config: CubidConfig,
  fetchImpl: CubidFetch,
): Promise<T> {
  let response: Response

  try {
    response = await fetchImpl(`${config.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "dapp-id": config.dappId,
        "api-key": config.apiKey,
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error"
    throw new Error(`CUBID request to ${endpoint} failed: ${message}`)
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      (isPlainObject(payload) &&
        [payload.message, payload.error].find(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )) ||
      response.statusText ||
      "Unknown API error"

    throw new Error(`CUBID request to ${endpoint} failed: ${message}`)
  }

  if (!isPlainObject(payload)) {
    throw new Error(`CUBID request to ${endpoint} returned an unexpected payload.`)
  }

  return payload as T
}

export async function resolveCubidIdentityByEmail(
  input: ResolveCubidIdentityByEmailInput,
): Promise<CubidIdentitySnapshot> {
  const email = normalizeEmail(input.email)
  if (!email) {
    throw new Error("An authenticated email is required to resolve CUBID identity.")
  }

  const config = input.config ?? getCubidConfig()
  const fetchImpl = input.fetchImpl ?? fetch

  const createUserResponse = await postCubid<CubidApiResponse>(
    "create_user",
    {
      dapp_id: config.dappId,
      apikey: config.apiKey,
      email,
    },
    config,
    fetchImpl,
  )

  const cubidId = getCubidUserId(createUserResponse)
  if (!cubidId) {
    throw new Error("CUBID did not return a user identifier for this email.")
  }

  const [identityResponse, scoreResponse] = await Promise.all([
    postCubid<CubidApiResponse>(
      "identity/fetch_identity",
      {
        apikey: config.apiKey,
        user_id: cubidId,
      },
      config,
      fetchImpl,
    ),
    postCubid<CubidApiResponse>(
      "score/fetch_score",
      {
        apikey: config.apiKey,
        user_id: cubidId,
      },
      config,
      fetchImpl,
    ).catch((error) => {
      if (error instanceof Error) {
        return { error: error.message }
      }

      return { error: "Unable to fetch CUBID score." }
    }),
  ])

  return {
    cubidId,
    primaryEmailIdentity: input.primaryEmailIdentity,
    cubidScore: getCubidScore(scoreResponse),
    cubidIdentityStatus: inferIdentityStatus(identityResponse, email),
  }
}
