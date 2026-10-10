import { createJwksCache, type JwksCache } from "./id-jag"

// Cubid cross-app access configuration (#266 stage 2).
//
// Fails closed: with no issuer or audience configured there is nothing to verify an assertion
// against, so redemption is refused rather than falling back to a default. Cubid is not on prod yet
// (cubid-monorepo#179 is the staging rollout), so every deployment starts unconfigured.

export type CrossAppConfig = {
  issuer: string
  jwksUri: string
  audience: string
}

export type EnvLike = Record<string, string | undefined>

function trimmed(value: string | undefined) {
  const text = value?.trim()
  return text && text.length > 0 ? text : null
}

export function crossAppConfig(env: EnvLike = process.env): CrossAppConfig | null {
  const issuer = trimmed(env.CUBID_OIDC_ISSUER)
  const audience = trimmed(env.FUNDLOOP_CROSS_APP_AUDIENCE)
  if (!issuer || !audience) return null
  // An issuer that is not HTTPS cannot be trusted to sign anything, except on a loopback host while
  // developing against a local Cubid.
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(issuer)
  if (!issuer.startsWith("https://") && !isLocal) return null
  return { issuer, audience, jwksUri: trimmed(env.CUBID_OIDC_JWKS_URI) ?? `${issuer}/jwks` }
}

let cache: JwksCache | null = null
let cachedFor: string | null = null

export function cubidJwksCache(config: CrossAppConfig): JwksCache {
  if (cache && cachedFor === config.jwksUri) return cache
  cache = createJwksCache({ jwksUri: config.jwksUri })
  cachedFor = config.jwksUri
  return cache
}
