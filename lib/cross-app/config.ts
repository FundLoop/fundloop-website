import { createJwksCache, type JwksCache } from "./jws"

// Cubid cross-app access configuration (#266 stage 2).
//
// Fails closed: with no issuer configured there is nothing to verify anything against, so both
// redemption and event receipt are refused rather than falling back to a default. Cubid is not on
// prod yet (cubid-monorepo#179 is the staging rollout), so every deployment starts unconfigured.

export type CubidIssuerConfig = {
  issuer: string
  jwksUri: string
}

export type CrossAppConfig = CubidIssuerConfig & {
  /** The resource audience Cubid mints assertions for, from the pairing. */
  audience: string
}

export type CrossAppReceiverConfig = CubidIssuerConfig & {
  /**
   * FundLoop's own client id at Cubid. A Security Event Token is addressed to the client, not to
   * the resource audience an assertion carries, so this is a separate value and the receiver is
   * configurable without a pairing being in place.
   */
  clientId: string
}

export type EnvLike = Record<string, string | undefined>

function trimmed(value: string | undefined) {
  const text = value?.trim()
  return text && text.length > 0 ? text : null
}

function issuerConfig(env: EnvLike): CubidIssuerConfig | null {
  const issuer = trimmed(env.CUBID_OIDC_ISSUER)
  if (!issuer) return null
  // An issuer that is not HTTPS cannot be trusted to sign anything, except on a loopback host while
  // developing against a local Cubid.
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(issuer)
  if (!issuer.startsWith("https://") && !isLocal) return null
  return { issuer, jwksUri: trimmed(env.CUBID_OIDC_JWKS_URI) ?? `${issuer}/jwks` }
}

export function crossAppConfig(env: EnvLike = process.env): CrossAppConfig | null {
  const issuer = issuerConfig(env)
  const audience = trimmed(env.FUNDLOOP_CROSS_APP_AUDIENCE)
  if (!issuer || !audience) return null
  return { ...issuer, audience }
}

export function crossAppReceiverConfig(env: EnvLike = process.env): CrossAppReceiverConfig | null {
  const issuer = issuerConfig(env)
  const clientId = trimmed(env.FUNDLOOP_CUBID_CLIENT_ID)
  if (!issuer || !clientId) return null
  return { ...issuer, clientId }
}

let cache: JwksCache | null = null
let cachedFor: string | null = null

export function cubidJwksCache(config: CubidIssuerConfig): JwksCache {
  if (cache && cachedFor === config.jwksUri) return cache
  cache = createJwksCache({ jwksUri: config.jwksUri })
  cachedFor = config.jwksUri
  return cache
}
