import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

// Token primitives for the FundLoop side of redemption (#266). Nothing here touches the database,
// so each rule is testable on its own.
//
// This file is Node-side and may use node:crypto. The portable half of the flow — assertion and
// event verification — lives in lib/cross-app/, which uses Web Crypto only so it can be lifted into
// a shared kit for the other sibling apps.

export const OAUTH_TTL_SECONDS = {
  // Deliberately short. A withdrawn consent reaches FundLoop as a Security Event Token, and until
  // that receiver exists (the next piece of this stage) the only bound on a withdrawn client's
  // remaining access is this lifetime. A client renews by redeeming a fresh assertion, which
  // re-checks consent at Cubid, so a short life costs the client nothing but a round trip.
  accessToken: 900,
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

export function expiresAt(seconds: number, now: Date = new Date()): string {
  return new Date(now.getTime() + seconds * 1000).toISOString()
}

export function hasExpired(expiry: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiry) return true
  const parsed = Date.parse(expiry)
  return Number.isNaN(parsed) || parsed <= now.getTime()
}
