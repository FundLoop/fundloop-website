// Building and remembering one Cubid authorization request (#275, stage 2c).
//
// The verifier, state and nonce are kept in a short-lived httpOnly cookie rather than in a server
// store: the cookie *is* the trusted copy, so comparing the callback's `state` against it is what
// detects a request this browser did not start. Tampering with your own cookie only breaks your own
// sign-in, so nothing here needs a signing secret.
//
// Contract: Authorization Code with PKCE is the only grant Cubid offers for human login.

export const CUBID_SIGN_IN_COOKIE = "fundloop_cubid_oidc"
// Cubid gives an authorization code five minutes; the ceremony in front of it (a passkey, or a
// Google round trip and a consent screen) is what the rest of this allows for.
export const CUBID_SIGN_IN_COOKIE_MAX_AGE_SECONDS = 15 * 60

export type CubidSignInRequestState = {
  state: string
  nonce: string
  codeVerifier: string
  intent: "sign_in" | "link"
  /**
   * For a link, the account whose settings started it. The callback requires the session to still
   * be this person: a browser that switched accounts in another tab during the round trip would
   * otherwise attach the Cubid identity to whichever account happens to be signed in on return.
   */
  linkingUserId?: string
  /** Where to send the person afterwards. Same-origin paths only. */
  redirectTo: string
}

function randomUrlSafe(bytes = 32) {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  let binary = ""
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function codeChallengeFor(codeVerifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))
  let binary = ""
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * A destination supplied by the caller is attacker-controllable, so only a path on this site is
 * allowed through. `//evil.test` is a protocol-relative URL, not a path, which is the case a bare
 * `startsWith("/")` misses.
 */
export function safeRedirectTarget(candidate: string | null, fallback = "/"): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return fallback
  if (candidate.includes("\\") || /[\u0000-\u001f]/.test(candidate)) return fallback
  return candidate
}

export function newSignInRequestState(input: {
  intent: "sign_in" | "link"
  redirectTo: string
  linkingUserId?: string | null
}): CubidSignInRequestState {
  return {
    state: randomUrlSafe(),
    nonce: randomUrlSafe(),
    // RFC 7636 §4.1: 43 to 128 characters of unreserved alphabet, which 32 random bytes in
    // base64url satisfies.
    codeVerifier: randomUrlSafe(),
    intent: input.intent,
    ...(input.intent === "link" && input.linkingUserId ? { linkingUserId: input.linkingUserId } : {}),
    redirectTo: safeRedirectTarget(input.redirectTo),
  }
}

export async function authorizationUrl(
  config: { authorizationEndpoint: string; clientId: string; redirectUri: string },
  request: CubidSignInRequestState,
  scopes = ["openid", "email", "profile"],
) {
  const url = new URL(config.authorizationEndpoint)
  const parameters = {
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: scopes.join(" "),
    state: request.state,
    nonce: request.nonce,
    code_challenge: await codeChallengeFor(request.codeVerifier),
    code_challenge_method: "S256",
  }
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value)
  return url.toString()
}

export function parseSignInRequestState(raw: string | undefined): CubidSignInRequestState | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const record = parsed as Record<string, unknown>
    const state = typeof record.state === "string" ? record.state : null
    const nonce = typeof record.nonce === "string" ? record.nonce : null
    const codeVerifier = typeof record.codeVerifier === "string" ? record.codeVerifier : null
    const intent = record.intent === "link" ? "link" : "sign_in"
    if (!state || !nonce || !codeVerifier) return null
    const linkingUserId = typeof record.linkingUserId === "string" ? record.linkingUserId : undefined
    return {
      state,
      nonce,
      codeVerifier,
      intent,
      ...(intent === "link" && linkingUserId ? { linkingUserId } : {}),
      redirectTo: safeRedirectTarget(typeof record.redirectTo === "string" ? record.redirectTo : null),
    }
  } catch {
    return null
  }
}
