import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  OAUTH_TTL_SECONDS,
  codeChallengeFromVerifier,
  constantTimeEquals,
  expiresAt,
  hasExpired,
  isValidCodeChallenge,
  isValidCodeVerifier,
  randomToken,
  sha256Hex,
  verifyCodeChallenge,
} from "@/lib/oauth/crypto"
import { OAUTH_SCOPES, OAUTH_SCOPE_CONSENT, isScopeSubset, parseScopeParam, scopeString, sortScopes } from "@/lib/oauth/scopes"

const migration = readFileSync("supabase/migrations/20261009120000_oauth_authorization_server.sql", "utf8")

describe("oauth scopes", () => {
  it("matches the database enum exactly", () => {
    // The vocabulary is a contract with third-party clients, so the enum and the module must not
    // drift: a scope that exists in one and not the other is either unusable or unstorable.
    const enumLine = migration.match(/create type public\.oauth_scope as enum \(([^)]+)\)/)
    expect(enumLine).not.toBeNull()
    const labels = [...enumLine![1].matchAll(/'([^']+)'/g)].map((match) => match[1])
    expect(labels).toEqual([...OAUTH_SCOPES])
  })

  it("describes every scope on the consent screen", () => {
    for (const scope of OAUTH_SCOPES) {
      expect(OAUTH_SCOPE_CONSENT[scope].title.length).toBeGreaterThan(0)
      expect(OAUTH_SCOPE_CONSENT[scope].detail.length).toBeGreaterThan(0)
    }
    // The payout-route description has to state what is withheld, because the obvious reading of
    // the scope name is that it includes the destination.
    expect(OAUTH_SCOPE_CONSENT["payout-routes:read"].detail).toMatch(/[Nn]ever the destination/)
  })

  it("rejects an unknown scope instead of ignoring it", () => {
    // Silently dropping one would leave a client believing it was granted something it asked for.
    expect(parseScopeParam("profile:read fundloop:admin")).toEqual({ ok: false, reason: "unknown_scope", unknown: "fundloop:admin" })
    expect(parseScopeParam("")).toEqual({ ok: false, reason: "empty" })
    expect(parseScopeParam(null)).toEqual({ ok: false, reason: "empty" })
  })

  it("normalises a scope set to one representation", () => {
    const parsed = parseScopeParam("awards:read profile:read awards:read")
    expect(parsed).toEqual({ ok: true, scopes: ["profile:read", "awards:read"] })
    expect(scopeString(["awards:read", "profile:read"])).toBe("profile:read awards:read")
    expect(sortScopes(["payout-routes:read", "profile:read"])).toEqual(["profile:read", "payout-routes:read"])
  })

  it("accepts the RFC 6749 space delimiter in its encoded forms", () => {
    expect(parseScopeParam("profile:read+awards:read")).toEqual({ ok: true, scopes: ["profile:read", "awards:read"] })
  })

  it("checks subsets in the direction that matters", () => {
    expect(isScopeSubset(["profile:read"], ["profile:read", "awards:read"])).toBe(true)
    expect(isScopeSubset(["profile:read", "awards:read"], ["profile:read"])).toBe(false)
  })
})

describe("oauth crypto", () => {
  it("stores nothing replayable", () => {
    const token = randomToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(token)
    expect(sha256Hex(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(sha256Hex(token)).not.toContain(token)

    // Every column that holds a credential holds a digest of it, enforced by a CHECK.
    for (const column of ["client_secret_sha256", "request_sha256", "code_sha256", "token_sha256"]) {
      expect(migration).toContain(`${column} text`)
      expect(migration).toMatch(new RegExp(`${column}[^,]*~ '\\^\\[0-9a-f\\]\\{64\\}\\$'`))
    }
  })

  it("verifies a PKCE S256 challenge and refuses plain", () => {
    const verifier = randomToken(48).slice(0, 64)
    const challenge = codeChallengeFromVerifier(verifier)
    expect(isValidCodeVerifier(verifier)).toBe(true)
    expect(isValidCodeChallenge(challenge)).toBe(true)
    expect(verifyCodeChallenge(verifier, challenge, "S256")).toBe(true)

    // plain would hand the verifier to anyone who saw the challenge.
    expect(verifyCodeChallenge(verifier, verifier, "plain")).toBe(false)
    expect(verifyCodeChallenge(verifier, challenge, "plain")).toBe(false)
    expect(verifyCodeChallenge(`${verifier}x`, challenge, "S256")).toBe(false)
    expect(verifyCodeChallenge(verifier, codeChallengeFromVerifier(`${verifier}x`), "S256")).toBe(false)
  })

  it("enforces the RFC 7636 verifier and challenge shapes", () => {
    expect(isValidCodeVerifier("short")).toBe(false)
    expect(isValidCodeVerifier("a".repeat(129))).toBe(false)
    expect(isValidCodeVerifier("a".repeat(43))).toBe(true)
    expect(isValidCodeVerifier(`${"a".repeat(42)}!`)).toBe(false)
    expect(isValidCodeChallenge("a".repeat(42))).toBe(false)
  })

  it("compares without leaking a length-independent timing signal", () => {
    expect(constantTimeEquals("abc", "abc")).toBe(true)
    expect(constantTimeEquals("abc", "abd")).toBe(false)
    // A length mismatch must not throw, which is what timingSafeEqual does on its own.
    expect(constantTimeEquals("abc", "abcd")).toBe(false)
    expect(constantTimeEquals("", "")).toBe(true)
  })

  it("keeps the short-lived things short-lived", () => {
    // RFC 6749 §4.1.2 asks for a code lifetime of at most ten minutes.
    expect(OAUTH_TTL_SECONDS.authorizationCode).toBeLessThanOrEqual(600)
    expect(OAUTH_TTL_SECONDS.accessToken).toBeLessThanOrEqual(3600)
    expect(OAUTH_TTL_SECONDS.refreshToken).toBeGreaterThan(OAUTH_TTL_SECONDS.accessToken)

    const now = new Date("2026-10-09T12:00:00.000Z")
    expect(expiresAt(60, now)).toBe("2026-10-09T12:01:00.000Z")
    expect(hasExpired("2026-10-09T11:59:59.000Z", now)).toBe(true)
    expect(hasExpired("2026-10-09T12:00:01.000Z", now)).toBe(false)
    // A missing or unparseable expiry counts as expired rather than as "no expiry".
    expect(hasExpired(null, now)).toBe(true)
    expect(hasExpired("not a date", now)).toBe(true)
  })
})

describe("oauth schema", () => {
  it("keeps every credential table service-role only with RLS on", () => {
    for (const table of ["oauth_clients", "oauth_client_redirect_uris", "oauth_grants", "oauth_authorization_requests", "oauth_authorization_codes", "oauth_tokens"]) {
      expect(migration).toContain(`'${table}'`)
    }
    expect(migration).toContain("enable row level security")
    expect(migration).toContain("revoke all on table public.%I from anon, authenticated")
    expect(migration).toContain("grant select, insert, update, delete on table public.%I to service_role")
  })

  it("requires S256 and rejects a secretless confidential client", () => {
    expect(migration).toMatch(/code_challenge_method text not null default 'S256' check \(code_challenge_method = 'S256'\)/)
    expect(migration).toContain("oauth_clients_secret_matches_type")
  })

  it("validates each redirect URI on its own row", () => {
    // A CHECK cannot contain a subquery, so per-element validation needs its own rows; and https
    // only, apart from a loopback for native development, with no fragment.
    expect(migration).toContain("create table public.oauth_client_redirect_uris")
    expect(migration).toContain("^https://[^#]+$")
    expect(migration).toContain("127\\.0\\.0\\.1")
  })
})
