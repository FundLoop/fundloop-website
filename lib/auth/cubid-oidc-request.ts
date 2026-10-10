// Building and remembering one Cubid authorization request (#275, stage 2c).
//
// The verifier, state and nonce are kept in a short-lived cookie rather than in a server store, and
// that cookie is the only thing proving a callback belongs to a request this browser started. It is
// therefore defended twice over, because *this browser* is not the only writer of its cookie jar:
// a sibling host under the registrable domain — `dev.fundloop.org`, say, or anything else that ever
// gets a subdomain — can set a cookie with `Domain=.fundloop.org` that www would then send.
// Planting a state, nonce and verifier is enough for login CSRF: lure the person to a crafted
// callback and they are signed in as somebody else's Cubid identity.
//
//   * The `__Host-` prefix. A browser only accepts such a cookie when it is Secure, `Path=/`, and
//     carries no `Domain`, so a sibling host cannot set this name at all. Used on https; local
//     development over http falls back to the unprefixed name, which is why reads accept both.
//   * An HMAC signature over the contents, with a server-held secret. A browser that does not
//     enforce the prefix would still accept a planted cookie, and a signature it cannot forge is
//     what makes that cookie useless. Sign-in is unavailable without the secret rather than
//     unsigned.
//
// Contract: Authorization Code with PKCE is the only grant Cubid offers for human login.

/** Used on https, where a browser enforces the prefix's host-only, `Path=/`, Secure rules. */
export const CUBID_SIGN_IN_COOKIE = "__Host-fundloop_cubid_oidc"
/** Local development over http, where a `__Host-` cookie cannot be set. */
export const CUBID_SIGN_IN_COOKIE_INSECURE = "fundloop_cubid_oidc"

export function signInCookieName(isSecure: boolean) {
  return isSecure ? CUBID_SIGN_IN_COOKIE : CUBID_SIGN_IN_COOKIE_INSECURE
}
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

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes
  } catch {
    return null
  }
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ])
}

/** `<payload>.<signature>`, both base64url. The payload is not secret; the signature is the point. */
export async function sealSignInRequestState(state: CubidSignInRequestState, secret: string) {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(state)))
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

export async function openSignInRequestState(
  sealed: string | undefined,
  secret: string,
): Promise<CubidSignInRequestState | null> {
  if (!sealed) return null
  const [payload, signature] = sealed.split(".")
  if (!payload || !signature) return null
  const signatureBytes = fromBase64Url(signature)
  const payloadBytes = fromBase64Url(payload)
  if (!signatureBytes || !payloadBytes) return null
  // crypto.subtle.verify compares in constant time, and an unverified payload is never parsed.
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    new Uint8Array(signatureBytes).buffer as ArrayBuffer,
    new TextEncoder().encode(payload),
  )
  if (!valid) return null
  return parseSignInRequestState(new TextDecoder().decode(payloadBytes))
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
