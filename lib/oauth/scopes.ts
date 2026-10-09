// The public scope vocabulary (#266). Mirrors the public.oauth_scope enum: adding a scope is a
// migration plus a change here, because a scope is a promise to a third-party client.

export const OAUTH_SCOPES = ["profile:read", "awards:read", "payout-routes:read"] as const

export type OAuthScope = (typeof OAUTH_SCOPES)[number]

// What the consent screen says a scope allows. Written for the person granting it, not for the
// client developer, and deliberately explicit about what is not included.
export const OAUTH_SCOPE_CONSENT: Record<OAuthScope, { title: string; detail: string }> = {
  "profile:read": {
    title: "See which FundLoop account you are",
    detail: "Your account id, display name and avatar. Not your email address.",
  },
  "awards:read": {
    title: "See your own awards and allocation history",
    detail: "Amounts awarded to you in closed cycles. Nothing about other people, and nothing about other projects you are not in.",
  },
  "payout-routes:read": {
    title: "See which payout routes you have set up",
    detail: "Which kinds of payout route exist and whether they are usable. Never the destination details, such as an account number or wallet address.",
  },
}

export function isOAuthScope(value: string): value is OAuthScope {
  return (OAUTH_SCOPES as readonly string[]).includes(value)
}

// Canonical order, so a scope set has one representation wherever it is compared or displayed.
export function sortScopes(scopes: readonly OAuthScope[]): OAuthScope[] {
  return OAUTH_SCOPES.filter((scope) => scopes.includes(scope))
}

export function scopeString(scopes: readonly OAuthScope[]): string {
  return sortScopes(scopes).join(" ")
}

// RFC 6749 §3.3: space-delimited, order-independent. An unknown scope is rejected rather than
// ignored, so a client never believes it was granted something it asked for.
export function parseScopeParam(raw: string | null | undefined):
  | { ok: true; scopes: OAuthScope[] }
  | { ok: false; reason: "empty" | "unknown_scope"; unknown?: string } {
  const requested = (raw ?? "").split(/[\s+]+/).filter((value) => value.length > 0)
  if (requested.length === 0) return { ok: false, reason: "empty" }
  const unknown = requested.find((value) => !isOAuthScope(value))
  if (unknown !== undefined) return { ok: false, reason: "unknown_scope", unknown }
  return { ok: true, scopes: sortScopes([...new Set(requested as OAuthScope[])]) }
}

export function isScopeSubset(requested: readonly OAuthScope[], allowed: readonly OAuthScope[]): boolean {
  return requested.every((scope) => allowed.includes(scope))
}
