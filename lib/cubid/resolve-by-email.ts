import type { CubidApiClient, CubidApiClientOptions } from "@cubid/core"
import { createCubidApiClient } from "@cubid/core"
import { getCubidConfig, type CubidConfig } from "./config.ts"
import type { CubidIdentityLinkState } from "./types.ts"

type ResolveCubidIdentityByEmailInput = {
  email: string
  primaryEmailIdentity: string | null
  client?: CubidApiClient
  config?: CubidConfig
  fetchImpl?: typeof fetch
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isVerifiedIdentityEmail(
  response: Awaited<ReturnType<CubidApiClient["fetchIdentity"]>>,
  normalizedEmail: string,
) {
  return response.stampDetails.some(
    (detail) =>
      detail.stampType === "email" &&
      typeof detail.value === "string" &&
      detail.value.trim().toLowerCase() === normalizedEmail &&
      detail.status?.trim().toLowerCase() === "verified",
  )
}

function createClientFromInput(input: ResolveCubidIdentityByEmailInput) {
  if (input.client) {
    return input.client
  }

  const config = input.config ?? getCubidConfig()
  const clientConfig: CubidApiClientOptions = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    dappId: config.dappId,
    fetch: input.fetchImpl ?? fetch,
  }

  return createCubidApiClient(clientConfig)
}

export async function resolveCubidIdentityByEmail(
  input: ResolveCubidIdentityByEmailInput,
): Promise<CubidIdentityLinkState> {
  const email = normalizeEmail(input.email)
  if (!email) {
    throw new Error("An authenticated email is required to resolve CUBID identity.")
  }

  const client = createClientFromInput(input)
  const created = await client.ensureUserByEmail({ email })

  if (!created.userId) {
    throw new Error("CUBID did not return a user identifier for this email.")
  }

  const [identity, score] = await Promise.all([
    client.fetchIdentity({ userId: created.userId }),
    client.fetchScore({ userId: created.userId }).catch(() => null),
  ])

  return {
    cubidId: created.userId,
    primaryEmailIdentity: input.primaryEmailIdentity,
    cubidScore: score?.cubidScore ?? null,
    cubidIdentityStatus: isVerifiedIdentityEmail(identity, email) ? "verified" : "linked",
  }
}
