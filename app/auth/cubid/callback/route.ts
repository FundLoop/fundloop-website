import { cookies } from "next/headers"
import { crossAppSignInConfig } from "@/lib/cross-app/config"
import { completeCubidSignIn, type CubidSignInOutcome } from "@/lib/auth/cubid-sign-in"
import { openSignInRequestState, signInCookieName } from "@/lib/auth/cubid-oidc-request"
import { establishSupabaseSessionForEmail } from "@/lib/auth/cubid-session-bridge"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// GET /auth/cubid/callback — where Cubid returns an authorization code (#275, stage 2c).
//
// Registered at Cubid as a redirect URI, matched there exactly, so this path is part of the client
// registration and must stay stable.
//
// The handler does no deciding of its own: it checks that this browser started the request, hands
// the code to `completeCubidSignIn`, and turns the outcome into somewhere to send the person. Every
// outcome redirects — a person who just came back from an identity provider should land on a page,
// not on a JSON body.
export const dynamic = "force-dynamic"

// Short, stable codes, so a page can say something useful without the reason being a free-text
// string from a verifier.
const OUTCOME_QUERY: Record<CubidSignInOutcome["kind"], string> = {
  signed_in: "signed-in",
  linked: "linked",
  already_linked: "already-linked",
  email_taken: "email-taken",
  no_email: "no-email",
  purged_subject: "unavailable",
  conflict: "conflict",
  refused: "refused",
  unavailable: "unavailable",
}

function back(request: Request, redirectTo: string, outcome: string) {
  const destination = new URL(redirectTo, request.url)
  destination.searchParams.set("cubid", outcome)
  return Response.redirect(destination, 303)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const config = crossAppSignInConfig()
  // Without configuration there is no secret to check the pending request with, so there is nothing
  // here that can be trusted — including the cookie.
  if (!config) return Response.redirect(new URL("/?cubid=unavailable", request.url), 303)

  const store = await cookies()
  const cookieName = signInCookieName(url.protocol === "https:")
  // The signature is checked before the contents are parsed: a sibling host can write this browser's
  // cookie jar, and a planted request it cannot sign is not a request.
  const pending = await openSignInRequestState(store.get(cookieName)?.value, config.cookieSecret)
  const redirectTo = pending?.redirectTo ?? "/"

  if (!pending) return back(request, redirectTo, "expired")

  // The state has to match the copy this browser was given, and that comparison is what makes a
  // callback forged or replayed elsewhere useless here. It happens *before* the cookie is
  // consumed: deleting first would let an unsolicited callback, or the slower of two overlapping
  // sign-ins, erase the request the person is actually in the middle of.
  const state = url.searchParams.get("state")
  if (!state || state !== pending.state) return back(request, redirectTo, "expired")

  // Matched, so this request is spent either way: one authorization request, one use.
  store.delete({ name: cookieName, path: "/" })

  // RFC 6749 §4.1.2.1: the person declined, or Cubid refused. Not an error of ours.
  const failure = url.searchParams.get("error")
  if (failure) {
    return back(request, redirectTo, failure === "access_denied" ? "declined" : "refused")
  }

  const code = url.searchParams.get("code")
  if (!code) return back(request, redirectTo, "expired")

  let currentUserId: string | null = null
  if (pending.intent === "link") {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    currentUserId = data.user?.id ?? null
    // The link belongs to the account whose settings started it. If this browser switched accounts
    // while the person was at Cubid, attaching the identity to whoever is signed in now would link
    // the wrong account — so a mismatch is a refusal, not a silent reassignment.
    if (!currentUserId || currentUserId !== pending.linkingUserId) {
      return back(request, redirectTo, "session-changed")
    }
  }

  let outcome: CubidSignInOutcome
  try {
    outcome = await completeCubidSignIn(
      { code, codeVerifier: pending.codeVerifier, nonce: pending.nonce, intent: pending.intent },
      { establishSession: establishSupabaseSessionForEmail, currentUserId },
    )
  } catch (error) {
    console.error(`[auth/cubid] sign-in failed: ${error instanceof Error ? error.message : "unknown"}`)
    return back(request, redirectTo, "refused")
  }

  if (outcome.kind === "refused" || outcome.kind === "unavailable") {
    console.warn(`[auth/cubid] ${outcome.kind}: ${outcome.reason}`)
  }

  return back(request, redirectTo, OUTCOME_QUERY[outcome.kind])
}
