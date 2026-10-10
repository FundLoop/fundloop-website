import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { OAUTH_TTL_SECONDS, constantTimeEquals, expiresAt, hasExpired, randomToken, sha256Hex } from "@/lib/oauth/crypto"
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
    for (const column of ["client_secret_sha256", "token_sha256"]) {
      expect(migration).toContain(`${column} text`)
      expect(migration).toMatch(new RegExp(`${column}[^,]*~ '\\^\\[0-9a-f\\]\\{64\\}\\$'`))
    }
  })

  it("compares without leaking a length-independent timing signal", () => {
    expect(constantTimeEquals("abc", "abc")).toBe(true)
    expect(constantTimeEquals("abc", "abd")).toBe(false)
    // A length mismatch must not throw, which is what timingSafeEqual does on its own.
    expect(constantTimeEquals("abc", "abcd")).toBe(false)
    expect(constantTimeEquals("", "")).toBe(true)
  })

  it("keeps the access token short-lived", () => {
    // Until the Security Event Token receiver lands, this lifetime is the only bound on a withdrawn
    // client's remaining access, and a client renews by redeeming a fresh assertion anyway.
    expect(OAUTH_TTL_SECONDS.accessToken).toBeLessThanOrEqual(900)

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
    for (const table of ["oauth_clients", "oauth_grants", "oauth_assertion_jtis", "cubid_oidc_subjects", "oauth_tokens"]) {
      expect(migration).toContain(`'${table}'`)
    }
    expect(migration).toContain("enable row level security")
    expect(migration).toContain("revoke all on table public.%I from anon, authenticated")
    expect(migration).toContain("grant select, insert, update, delete on table public.%I to service_role")
  })

  it("admits no client that cannot authenticate, and no token type but access", () => {
    // Expressed as NOT NULL rather than a CHECK: a client without a secret is not a state the
    // table should be able to hold at all.
    expect(migration).toContain("client_secret_sha256 text not null")
    expect(migration).toContain("client_type = 'confidential'")
    // No refresh token: renewal means redeeming a fresh assertion, so consent is re-checked at
    // Cubid rather than extended here.
    expect(migration).toContain("check (token_type = 'access')")
    expect(migration).not.toContain("rotated_to_id")
  })

  it("makes a replayed assertion a constraint violation, not a race", () => {
    expect(migration).toContain("create table public.oauth_assertion_jtis")
    expect(migration).toContain("jti text not null primary key")
  })

  it("maps a Cubid pairwise subject to exactly one account, per issuer", () => {
    // Nothing else in an assertion identifies the person, and the subject must not be inferred from
    // an email address: that would defeat the pairwise scheme.
    expect(migration).toContain("create table public.cubid_oidc_subjects")
    expect(migration).toContain("unique (issuer, subject)")
    expect(migration).toContain("unique (issuer, user_id)")
  })
})
