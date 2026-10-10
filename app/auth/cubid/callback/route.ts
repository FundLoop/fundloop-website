import { cookies } from "next/headers"
import { completeCubidSignIn, type CubidSignInOutcome } from "@/lib/auth/cubid-sign-in"
import { CUBID_SIGN_IN_COOKIE, parseSignInRequestState } from "@/lib/auth/cubid-oidc-request"
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
  const store = await cookies()
  const pending = parseSignInRequestState(store.get(CUBID_SIGN_IN_COOKIE)?.value)
  // One authorization request, one use. Clearing it before anything else means a replayed callback
  // finds nothing to match against, whatever happens below.
  store.delete({ name: CUBID_SIGN_IN_COOKIE, path: "/auth/cubid" })

  const url = new URL(request.url)
  const redirectTo = pending?.redirectTo ?? "/"

  if (!pending) return back(request, redirectTo, "expired")

  // RFC 6749 §4.1.2.1: the person declined, or Cubid refused. Not an error of ours.
  const failure = url.searchParams.get("error")
  if (failure) {
    return back(request, redirectTo, failure === "access_denied" ? "declined" : "refused")
  }

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  // The state has to match the copy this browser was given, and the comparison is what makes a
  // callback forged elsewhere useless here.
  if (!code || !state || state !== pending.state) return back(request, redirectTo, "expired")

  let currentUserId: string | null = null
  if (pending.intent === "link") {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    currentUserId = data.user?.id ?? null
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
