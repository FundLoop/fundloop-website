import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { OAUTH_TTL_SECONDS, constantTimeEquals, expiresAt, hasExpired, randomToken, sha256Hex } from "./crypto"
import { sortScopes, type OAuthScope } from "./scopes"

// Database access for the authorization server (#266 stage 2).
//
// These tables are credentials, so they are service-role only and never reachable from a browser.
// Single use is enforced by the database, not by a read-then-write in application code: every
// consume is an UPDATE guarded on the row still being unconsumed, and a zero-row result means
// someone else got there first. A check-then-act would let two concurrent redemptions of the same
// code both succeed.
//
// types/supabase.ts predates these tables; regenerate it against the migration and drop the cast
// below (`supabase gen types typescript`). The row types here mirror the migration exactly.

export type OAuthClientRecord = {
  client_id: string
  client_secret_sha256: string | null
  client_type: "public" | "confidential"
  name: string
  description: string | null
  logo_url: string | null
  client_uri: string | null
  allowed_scopes: OAuthScope[]
  is_sandbox: boolean
  disabled_at: string | null
}

type GrantRecord = { id: number; client_id: string; user_id: string; scopes: OAuthScope[]; revoked_at: string | null }
type AuthorizationRequestRecord = {
  id: number
  client_id: string
  redirect_uri: string
  scopes: OAuthScope[]
  state: string | null
  code_challenge: string
  code_challenge_method: string
  expires_at: string
  consumed_at: string | null
}
type CodeRecord = {
  id: number
  client_id: string
  user_id: string
  grant_id: number
  redirect_uri: string
  scopes: OAuthScope[]
  code_challenge: string
  code_challenge_method: string
  expires_at: string
}
type TokenRecord = {
  id: number
  token_type: "access" | "refresh"
  client_id: string
  user_id: string
  grant_id: number
  scopes: OAuthScope[]
  rotated_to_id: number | null
  expires_at: string
  revoked_at: string | null
}

type MinimalQuery = {
  select: (columns: string) => MinimalQuery
  eq: (column: string, value: unknown) => MinimalQuery
  is: (column: string, value: unknown) => MinimalQuery
  in: (column: string, value: unknown[]) => MinimalQuery
  insert: (values: Record<string, unknown>) => MinimalQuery
  update: (values: Record<string, unknown>) => MinimalQuery
  limit: (count: number) => MinimalQuery
  maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>
  then: <T>(resolve: (value: { data: unknown; error: { message: string } | null }) => T) => PromiseLike<T>
}

function oauthDb() {
  return getAdminSupabaseClient() as unknown as { from: (table: string) => MinimalQuery }
}

function fail(scope: string, error: { message: string } | null) {
  if (error) throw new Error(`oauth-store:${scope}: ${error.message}`)
}

export async function findEnabledClient(clientId: string): Promise<OAuthClientRecord | null> {
  const { data, error } = await oauthDb()
    .from("oauth_clients")
    .select("client_id, client_secret_sha256, client_type, name, description, logo_url, client_uri, allowed_scopes, is_sandbox, disabled_at")
    .eq("client_id", clientId)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle()
  fail("find-client", error)
  return (data as OAuthClientRecord | null) ?? null
}

export async function clientRedirectUris(clientId: string): Promise<string[]> {
  const { data, error } = await oauthDb().from("oauth_client_redirect_uris").select("redirect_uri").eq("client_id", clientId)
  fail("redirect-uris", error)
  return ((data as { redirect_uri: string }[] | null) ?? []).map((row) => row.redirect_uri)
}

// Exact string match, never a prefix or a pattern: a loose match is how an attacker redirects a
// code to a host the client never registered.
export function isRegisteredRedirectUri(candidate: string, registered: readonly string[]): boolean {
  return registered.some((uri) => constantTimeEquals(uri, candidate))
}

export async function authenticateConfidentialClient(client: OAuthClientRecord, presentedSecret: string | null): Promise<boolean> {
  if (client.client_type !== "confidential") return presentedSecret === null
  if (!presentedSecret || !client.client_secret_sha256) return false
  return constantTimeEquals(sha256Hex(presentedSecret), client.client_secret_sha256)
}

export async function createAuthorizationRequest(input: {
  clientId: string
  redirectUri: string
  scopes: OAuthScope[]
  state: string | null
  codeChallenge: string
}): Promise<string> {
  const requestToken = randomToken()
  const { error } = await oauthDb().from("oauth_authorization_requests").insert({
    request_sha256: sha256Hex(requestToken),
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scopes: sortScopes(input.scopes),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    expires_at: expiresAt(OAUTH_TTL_SECONDS.authorizationRequest),
  })
  fail("create-request", error)
  return requestToken
}

export async function readAuthorizationRequest(requestToken: string): Promise<AuthorizationRequestRecord | null> {
  const { data, error } = await oauthDb()
    .from("oauth_authorization_requests")
    .select("id, client_id, redirect_uri, scopes, state, code_challenge, code_challenge_method, expires_at, consumed_at")
    .eq("request_sha256", sha256Hex(requestToken))
    .limit(1)
    .maybeSingle()
  fail("read-request", error)
  const record = data as AuthorizationRequestRecord | null
  if (!record || record.consumed_at || hasExpired(record.expires_at)) return null
  return record
}

// Claims the request so one decision cannot be submitted twice.
async function consumeAuthorizationRequest(id: number): Promise<boolean> {
  const { data, error } = await oauthDb()
    .from("oauth_authorization_requests")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle()
  fail("consume-request", error)
  return data !== null
}

async function upsertGrant(input: { clientId: string; userId: string; scopes: OAuthScope[] }): Promise<GrantRecord> {
  const existing = await oauthDb()
    .from("oauth_grants")
    .select("id, client_id, user_id, scopes, revoked_at")
    .eq("client_id", input.clientId)
    .eq("user_id", input.userId)
    .limit(1)
    .maybeSingle()
  fail("read-grant", existing.error)

  const scopes = sortScopes(input.scopes)
  const current = existing.data as GrantRecord | null
  if (current) {
    // Re-consenting replaces the scope set rather than adding to it, so withdrawing a scope on the
    // consent screen actually withdraws it.
    const updated = await oauthDb()
      .from("oauth_grants")
      .update({ scopes, revoked_at: null, updated_at: new Date().toISOString() })
      .eq("id", current.id)
      .select("id, client_id, user_id, scopes, revoked_at")
      .maybeSingle()
    fail("update-grant", updated.error)
    return updated.data as GrantRecord
  }

  const inserted = await oauthDb()
    .from("oauth_grants")
    .insert({ client_id: input.clientId, user_id: input.userId, scopes })
    .select("id, client_id, user_id, scopes, revoked_at")
    .maybeSingle()
  fail("insert-grant", inserted.error)
  return inserted.data as GrantRecord
}

export async function approveAuthorizationRequest(input: {
  requestToken: string
  userId: string
  scopes: OAuthScope[]
}): Promise<{ ok: true; code: string; redirectUri: string; state: string | null } | { ok: false; reason: "expired" | "race" }> {
  const request = await readAuthorizationRequest(input.requestToken)
  if (!request) return { ok: false, reason: "expired" }
  if (!(await consumeAuthorizationRequest(request.id))) return { ok: false, reason: "race" }

  const grant = await upsertGrant({ clientId: request.client_id, userId: input.userId, scopes: input.scopes })
  const code = randomToken()
  const { error } = await oauthDb().from("oauth_authorization_codes").insert({
    code_sha256: sha256Hex(code),
    client_id: request.client_id,
    user_id: input.userId,
    grant_id: grant.id,
    redirect_uri: request.redirect_uri,
    scopes: sortScopes(input.scopes),
    code_challenge: request.code_challenge,
    code_challenge_method: request.code_challenge_method,
    expires_at: expiresAt(OAUTH_TTL_SECONDS.authorizationCode),
  })
  fail("insert-code", error)
  return { ok: true, code, redirectUri: request.redirect_uri, state: request.state }
}

export async function denyAuthorizationRequest(requestToken: string): Promise<{ redirectUri: string; state: string | null } | null> {
  const request = await readAuthorizationRequest(requestToken)
  if (!request) return null
  await consumeAuthorizationRequest(request.id)
  return { redirectUri: request.redirect_uri, state: request.state }
}

// Single use, enforced by the guarded UPDATE: two concurrent redemptions cannot both win.
export async function consumeAuthorizationCode(code: string): Promise<CodeRecord | null> {
  const { data, error } = await oauthDb()
    .from("oauth_authorization_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("code_sha256", sha256Hex(code))
    .is("consumed_at", null)
    .select("id, client_id, user_id, grant_id, redirect_uri, scopes, code_challenge, code_challenge_method, expires_at")
    .maybeSingle()
  fail("consume-code", error)
  const record = data as CodeRecord | null
  if (!record || hasExpired(record.expires_at)) return null
  return record
}

export async function issueTokenPair(input: {
  grantId: number
  clientId: string
  userId: string
  scopes: OAuthScope[]
  fromCodeId?: number | null
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const accessToken = randomToken()
  const refreshToken = randomToken()
  const scopes = sortScopes(input.scopes)
  const rows = (["access", "refresh"] as const).map((tokenType) => ({
    token_sha256: sha256Hex(tokenType === "access" ? accessToken : refreshToken),
    token_type: tokenType,
    client_id: input.clientId,
    user_id: input.userId,
    grant_id: input.grantId,
    scopes,
    issued_from_code_id: input.fromCodeId ?? null,
    expires_at: expiresAt(tokenType === "access" ? OAUTH_TTL_SECONDS.accessToken : OAUTH_TTL_SECONDS.refreshToken),
  }))
  const { error } = await oauthDb().from("oauth_tokens").insert(rows as unknown as Record<string, unknown>)
  fail("insert-tokens", error)
  return { accessToken, refreshToken, expiresIn: OAUTH_TTL_SECONDS.accessToken }
}

export async function findRefreshToken(refreshToken: string): Promise<TokenRecord | null> {
  const { data, error } = await oauthDb()
    .from("oauth_tokens")
    .select("id, token_type, client_id, user_id, grant_id, scopes, rotated_to_id, expires_at, revoked_at")
    .eq("token_sha256", sha256Hex(refreshToken))
    .eq("token_type", "refresh")
    .limit(1)
    .maybeSingle()
  fail("find-refresh", error)
  return (data as TokenRecord | null) ?? null
}

// Replay of an already rotated refresh token is treated as a compromised grant, not as a stale
// request: RFC 9700 asks for the whole family to be revoked, because a legitimate client never
// presents a rotated token and an attacker holding one has the earlier value.
export async function revokeGrantFamily(grantId: number, reason: "reuse" | "revocation"): Promise<void> {
  const now = new Date().toISOString()
  const tokens = await oauthDb().from("oauth_tokens").update({ revoked_at: now }).eq("grant_id", grantId).is("revoked_at", null)
  fail(`revoke-family-tokens:${reason}`, tokens.error)
  const grant = await oauthDb().from("oauth_grants").update({ revoked_at: now, updated_at: now }).eq("id", grantId).is("revoked_at", null)
  fail(`revoke-family-grant:${reason}`, grant.error)
}

export async function rotateRefreshToken(record: TokenRecord): Promise<{ ok: true } | { ok: false; reason: "race" }> {
  const { data, error } = await oauthDb()
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", record.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle()
  fail("rotate-refresh", error)
  return data ? { ok: true } : { ok: false, reason: "race" }
}

export async function linkRotation(previousTokenId: number, refreshToken: string): Promise<void> {
  const next = await oauthDb()
    .from("oauth_tokens")
    .select("id")
    .eq("token_sha256", sha256Hex(refreshToken))
    .limit(1)
    .maybeSingle()
  fail("link-rotation-read", next.error)
  const nextId = (next.data as { id: number } | null)?.id
  if (!nextId) return
  const { error } = await oauthDb().from("oauth_tokens").update({ rotated_to_id: nextId }).eq("id", previousTokenId)
  fail("link-rotation", error)
}

export async function readGrant(grantId: number): Promise<GrantRecord | null> {
  const { data, error } = await oauthDb()
    .from("oauth_grants")
    .select("id, client_id, user_id, scopes, revoked_at")
    .eq("id", grantId)
    .limit(1)
    .maybeSingle()
  fail("read-grant-by-id", error)
  return (data as GrantRecord | null) ?? null
}

// RFC 7009: revoking either token of a pair revokes the grant's tokens. Unknown tokens are not
// reported as errors, so the endpoint cannot be used to test whether a token exists.
export async function revokeByToken(token: string): Promise<void> {
  const { data, error } = await oauthDb()
    .from("oauth_tokens")
    .select("id, token_type, client_id, user_id, grant_id, scopes, rotated_to_id, expires_at, revoked_at")
    .eq("token_sha256", sha256Hex(token))
    .limit(1)
    .maybeSingle()
  fail("revoke-lookup", error)
  const record = data as TokenRecord | null
  if (!record) return
  await revokeGrantFamily(record.grant_id, "revocation")
}
