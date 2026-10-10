import { cookies } from "next/headers"
import { crossAppSignInConfig } from "@/lib/cross-app/config"
import {
  authorizationUrl,
  newSignInRequestState,
  safeRedirectTarget,
  CUBID_SIGN_IN_COOKIE,
  CUBID_SIGN_IN_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/cubid-oidc-request"

// GET /auth/cubid/start — begins Sign in with Cubid (#275, stage 2c).
//
// `intent=link` runs the same round trip to attach a Cubid identity to the account already signed
// in here; the callback is what tells the two apart, and it requires a session for the link case.
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const config = crossAppSignInConfig()
  // Cubid is not deployed yet (cubid-monorepo#179 is the staging rollout), so an unconfigured
  // deployment is the normal state and must not look like a broken one.
  if (!config) {
    return Response.redirect(new URL("/?cubid=unavailable", request.url), 303)
  }

  const url = new URL(request.url)
  const intent = url.searchParams.get("intent") === "link" ? "link" : "sign_in"
  const state = newSignInRequestState({
    intent,
    redirectTo: safeRedirectTarget(url.searchParams.get("redirect_to"), intent === "link" ? "/settings/account" : "/"),
  })

  const store = await cookies()
  store.set(CUBID_SIGN_IN_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    // The callback is a top-level navigation from Cubid, which Lax allows and Strict would drop.
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/auth/cubid",
    maxAge: CUBID_SIGN_IN_COOKIE_MAX_AGE_SECONDS,
  })

  return Response.redirect(await authorizationUrl(config, state), 303)
}
