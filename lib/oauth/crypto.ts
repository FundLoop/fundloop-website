import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

// Token and PKCE primitives (#266). Nothing here touches the database, so each rule is testable on
// its own.

export const OAUTH_TTL_SECONDS = {
  // Long enough for a person to read the consent screen and sign in first if they need to.
  authorizationRequest: 600,
  // RFC 6749 §4.1.2 recommends a maximum of 10 minutes; one minute is enough for a redirect.
  authorizationCode: 60,
  accessToken: 3600,
  refreshToken: 60 * 60 * 24 * 30,
} as const

// 32 bytes of CSPRNG output, base64url, so a token carries 256 bits and survives a URL unescaped.
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}

// Stored form. A database reader holds hashes, not bearer credentials.
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8")
  const rightBytes = Buffer.from(right, "utf8")
  // timingSafeEqual throws on a length mismatch, and the length of a hash or a challenge is not
  // itself a secret, so comparing lengths first is safe.
  if (leftBytes.length !== rightBytes.length) return false
  return timingSafeEqual(leftBytes, rightBytes)
}

// RFC 7636 §4.1: 43-128 characters from the unreserved set.
const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/
// §4.2 S256 challenges are base64url without padding.
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/

export function isValidCodeVerifier(verifier: string): boolean {
  return VERIFIER_PATTERN.test(verifier)
}

export function isValidCodeChallenge(challenge: string): boolean {
  return CHALLENGE_PATTERN.test(challenge)
}

export function codeChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

// S256 only: "plain" is not accepted, so a network observer who sees the challenge cannot derive
// the verifier.
export function verifyCodeChallenge(verifier: string, challenge: string, method: string): boolean {
  if (method !== "S256") return false
  if (!isValidCodeVerifier(verifier) || !isValidCodeChallenge(challenge)) return false
  return constantTimeEquals(codeChallengeFromVerifier(verifier), challenge)
}

export function expiresAt(seconds: number, now: Date = new Date()): string {
  return new Date(now.getTime() + seconds * 1000).toISOString()
}

export function hasExpired(expiry: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiry) return true
  const parsed = Date.parse(expiry)
  return Number.isNaN(parsed) || parsed <= now.getTime()
}
