import "server-only"

import { crossAppSignInConfig, cubidJwksCache, type CrossAppSignInConfig } from "@/lib/cross-app/config"
import { verifyIdToken } from "@/lib/cross-app/id-token"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"

// Sign in with Cubid, and linking an existing account (#275, stage 2c).
//
// The decisions live here rather than in the route handlers so they can be tested without Next's
// request plumbing, and so the two entry points — signing in and linking from account settings —
// cannot drift apart on the rule that matters.
//
// FundLoop's identity stays Supabase Auth: every RLS policy in the schema is written against
// `auth.uid()`, so a Cubid sign-in has to end in a real Supabase session. Supabase Auth has no
// generic OIDC provider (its provider list is fixed and `signInWithIdToken` takes only Google,
// Apple, Azure, Facebook and Kakao), so FundLoop runs the OIDC client itself, server side, and
// bridges into a session through the admin API.
//
// Contract: cubid-monorepo docs/engineering/login-with-cubid-oidc-architecture.md.

export type SignInIntent = "sign_in" | "link"

export type CubidSignInOutcome =
  /** A session was established. */
  | { kind: "signed_in"; userId: string; created: boolean; revokedClients: number }
  /** The subject was mapped to the already-signed-in person. No session was touched. */
  | { kind: "linked"; userId: string; revokedClients: number }
  | { kind: "already_linked"; userId: string }
  /**
   * A FundLoop account already holds this email address. Deliberately **not** linked: holding the
   * address is not proof of controlling the account, and silently merging the two is what #275
   * acceptance 3 forbids. The person signs in to that account and links from settings.
   */
  | { kind: "email_taken"; email: string }
  /** Cubid released no verified email, so there is no address to create an account against. */
  | { kind: "no_email" }
  | { kind: "purged_subject" }
  /** The subject belongs to another FundLoop account, or this account already has one. */
  | { kind: "conflict"; reason: "subject_claimed" | "user_already_linked" | "conflict" }
  | { kind: "refused"; reason: string; detail?: string }
  | { kind: "unavailable"; reason: string }

export type TokenExchange = {
  idToken: string
}

type AdminClient = ReturnType<typeof getAdminSupabaseClient>

export type SignInDependencies = {
  config?: CrossAppSignInConfig | null
  admin?: AdminClient
  fetchImpl?: typeof fetch
  /** Sets the session cookies on the response being built. Injected so tests need no Next runtime. */
  establishSession: (input: { email: string }) => Promise<{ ok: true } | { ok: false; error: string }>
  /** The signed-in person, for the linking path. */
  currentUserId?: string | null
}

// RFC 6749 §4.1.3 token request, authenticated as a confidential client. Basic is what the contract
// lists first for a confidential web client, and the secret never travels in a query string.
async function exchangeCode(
  config: CrossAppSignInConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; idToken: string } | { ok: false; reason: string; detail?: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  })

  let response: Response
  try {
    response = await fetchImpl(config.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`)}`,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
      // The code is a credential: a redirect would hand it to whoever controls the destination.
      redirect: "manual",
    })
  } catch {
    return { ok: false, reason: "issuer_unreachable" }
  }

  if (!response.ok) {
    // RFC 6749 §5.2 error, which says why the code was refused. It is not shown to the person.
    let detail = String(response.status)
    try {
      const failure = (await response.json()) as { error?: unknown }
      if (typeof failure.error === "string") detail = failure.error
    } catch {
      // A non-JSON body from the token endpoint tells us nothing more than the status.
    }
    return { ok: false, reason: "code_rejected", detail }
  }

  let payload: { id_token?: unknown }
  try {
    payload = (await response.json()) as { id_token?: unknown }
  } catch {
    return { ok: false, reason: "malformed_token_response" }
  }
  const idToken = typeof payload.id_token === "string" ? payload.id_token : null
  if (!idToken) return { ok: false, reason: "malformed_token_response", detail: "no id_token" }
  return { ok: true, idToken }
}

export async function completeCubidSignIn(
  input: { code: string; codeVerifier: string; nonce: string; intent: SignInIntent },
  dependencies: SignInDependencies,
): Promise<CubidSignInOutcome> {
  const config = dependencies.config === undefined ? crossAppSignInConfig() : dependencies.config
  if (!config) return { kind: "unavailable", reason: "not_configured" }

  const jwks = await cubidJwksCache(config).get()
  if (!jwks) return { kind: "unavailable", reason: "issuer_keys_unavailable" }

  const exchanged = await exchangeCode(config, input.code, input.codeVerifier, dependencies.fetchImpl ?? fetch)
  if (!exchanged.ok) {
    return exchanged.reason === "issuer_unreachable"
      ? { kind: "unavailable", reason: exchanged.reason }
      : { kind: "refused", reason: exchanged.reason, detail: exchanged.detail }
  }

  const options = { jwks, issuer: config.issuer, audience: config.clientId, nonce: input.nonce }
  let verified = await verifyIdToken(exchanged.idToken, options)
  // An unknown key is what a rotation looks like, and the refresh distinguishes "that key does not
  // exist" from "I could not find out" — only the first is grounds for refusing a sign-in.
  if (!verified.ok && verified.reason === "unknown_key") {
    const refreshed = await cubidJwksCache(config).refresh()
    if (refreshed.outcome === "refreshed") {
      verified = await verifyIdToken(exchanged.idToken, { ...options, jwks: refreshed.keys })
    } else {
      return { kind: "unavailable", reason: "issuer_keys_unavailable" }
    }
  }
  if (!verified.ok) return { kind: "refused", reason: verified.reason, detail: verified.detail }

  const { sub, email } = verified.claims
  const admin = dependencies.admin ?? getAdminSupabaseClient()

  const { data: mapping, error: mappingError } = await admin
    .from("cubid_oidc_subjects")
    .select("user_id")
    .eq("issuer", config.issuer)
    .eq("subject", sub)
    .limit(1)
    .maybeSingle()
  if (mappingError) throw new Error(`cubid-sign-in:find-subject: ${mappingError.message}`)

  if (mapping?.user_id) {
    if (input.intent === "link") {
      return dependencies.currentUserId === mapping.user_id
        ? { kind: "already_linked", userId: mapping.user_id }
        : { kind: "conflict", reason: "subject_claimed" }
    }
    return signInExistingUser(admin, dependencies, mapping.user_id)
  }

  if (input.intent === "link") {
    const userId = dependencies.currentUserId
    // Linking proves control of the FundLoop account by holding its session. Without one there is
    // nothing to link to, and choosing an account by email is exactly what must not happen.
    if (!userId) return { kind: "refused", reason: "not_signed_in" }
    return linkSubject(admin, config.issuer, sub, userId, { signedIn: false })
  }

  // Signing in for the first time with this subject. An account has to be created, and that needs
  // an address: Cubid releases `email` only when it has verified it and the person consented.
  // Synthesising a placeholder would put an address into auth.users that looks real and is not.
  if (!email) return { kind: "no_email" }

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { signup_source: "cubid_oidc" },
  })
  if (created.error) {
    // The uniqueness of auth.users.email is the check, so there is no read-then-write race and no
    // need to query auth.users at all. An address already in use means an account exists, and it is
    // refused rather than signed into.
    const code = created.error.code
    if (code === "email_exists" || code === "user_already_exists") return { kind: "email_taken", email }
    return { kind: "refused", reason: "account_creation_failed", detail: code ?? created.error.message }
  }

  const userId = created.data.user?.id
  if (!userId) return { kind: "refused", reason: "account_creation_failed", detail: "no user returned" }

  let linked: CubidSignInOutcome
  try {
    linked = await linkSubject(admin, config.issuer, sub, userId, { signedIn: true })
  } catch (error) {
    // A transient database failure must not leave the address taken by an account nobody can
    // reach: the person's next attempt would be told the email is in use and sent into an
    // email-recovery flow for an account that was never theirs to recover.
    await removeUnreachableAccount(admin, userId)
    throw error
  }
  if (linked.kind !== "signed_in" && linked.kind !== "linked") {
    await removeUnreachableAccount(admin, userId)
    return linked
  }

  const session = await dependencies.establishSession({ email })
  if (!session.ok) return { kind: "refused", reason: "session_failed", detail: session.error }
  return { kind: "signed_in", userId, created: true, revokedClients: linked.revokedClients }
}

// An account created moments ago for a subject that could not then be linked to it is
// unreachable: nobody can sign into it and nothing points at it. Removing it is the only way not to
// leave the address taken, and a failure to remove it is worth a log line for exactly that reason.
async function removeUnreachableAccount(admin: AdminClient, userId: string) {
  try {
    const removal = await admin.auth.admin.deleteUser(userId)
    if (removal.error) {
      console.error(`[cubid-sign-in] could not remove the unlinked account ${userId}: ${removal.error.message}`)
    }
  } catch (error) {
    console.error(
      `[cubid-sign-in] could not remove the unlinked account ${userId}: ${error instanceof Error ? error.message : "unknown"}`,
    )
  }
}

async function linkSubject(
  admin: AdminClient,
  issuer: string,
  subject: string,
  userId: string,
  options: { signedIn: boolean },
): Promise<CubidSignInOutcome> {
  const { data, error } = await admin.rpc("link_cubid_subject", {
    p_issuer: issuer,
    p_subject: subject,
    p_user_id: userId,
  })
  if (error) throw new Error(`cubid-sign-in:link-subject: ${error.message}`)
  const row = data?.[0]
  if (!row) throw new Error("cubid-sign-in:link-subject: no outcome returned")

  switch (row.outcome) {
    case "linked":
      return options.signedIn
        ? { kind: "signed_in", userId, created: true, revokedClients: row.revoked_clients ?? 0 }
        : { kind: "linked", userId, revokedClients: row.revoked_clients ?? 0 }
    case "already_linked":
      return { kind: "already_linked", userId }
    case "purged_subject":
      return { kind: "purged_subject" }
    default:
      return { kind: "conflict", reason: row.outcome as "subject_claimed" | "user_already_linked" | "conflict" }
  }
}

async function signInExistingUser(
  admin: AdminClient,
  dependencies: SignInDependencies,
  userId: string,
): Promise<CubidSignInOutcome> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user) return { kind: "refused", reason: "account_unavailable" }
  const email = data.user.email
  // The bridge into a Supabase session needs an address on the account. One cannot normally be
  // missing — every FundLoop sign-up path sets one — so this is a refusal rather than a fallback.
  if (!email) return { kind: "refused", reason: "account_without_email" }

  await admin
    .from("cubid_oidc_subjects")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", userId)

  const session = await dependencies.establishSession({ email })
  if (!session.ok) return { kind: "refused", reason: "session_failed", detail: session.error }
  return { kind: "signed_in", userId, created: false, revokedClients: 0 }
}
