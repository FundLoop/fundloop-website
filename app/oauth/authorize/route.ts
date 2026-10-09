import { cookies } from "next/headers"
import { isValidCodeChallenge } from "@/lib/oauth/crypto"
import { authorizeErrorRedirect } from "@/lib/oauth/errors"
import { isScopeSubset, parseScopeParam } from "@/lib/oauth/scopes"
import { clientRedirectUris, createAuthorizationRequest, findEnabledClient, isRegisteredRedirectUri } from "@/lib/oauth/store"
import { defaultLocale, isValidLocale, localeCookieName } from "@/i18n/routing"

// GET /oauth/authorize — RFC 6749 §4.1.1 with mandatory PKCE (#266 stage 2).
//
// This endpoint validates and then hands over to the consent page. The client-controlled values are
// stored server-side against an opaque request token instead of being carried through the UI, so
// nothing the client sent can be tampered with between the consent screen and the issued code, and
// the consent page needs no client-supplied parameters of its own.
//
// It is a route handler rather than a page because the advertised endpoint must not be
// locale-prefixed, while the consent UI belongs inside the localized layout.
export const dynamic = "force-dynamic"

// RFC 6749 §4.1.2.1: until the client and its redirect URI are both known good, there is nowhere
// trustworthy to send an error, so it has to be shown to the person instead.
function untrustedRequestPage(reason: string) {
  const body = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>FundLoop authorization</title></head>
  <body style="font-family: system-ui, sans-serif; max-width: 34rem; margin: 4rem auto; line-height: 1.5">
    <h1 style="font-size: 1.25rem">This authorization request cannot be completed</h1>
    <p>${reason}</p>
    <p>Nothing has been shared. Close this window and start again from the application you were using.</p>
  </body>
</html>`
  return new Response(body, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const clientId = params.get("client_id")
  const redirectUri = params.get("redirect_uri")
  const state = params.get("state")

  if (!clientId || !redirectUri) {
    return untrustedRequestPage("The request is missing its client identifier or redirect URI.")
  }

  const client = await findEnabledClient(clientId)
  if (!client) {
    // An unknown client and a disabled one are not distinguished here.
    return untrustedRequestPage("The application making this request is not registered with FundLoop, or its access has been withdrawn.")
  }

  const registered = await clientRedirectUris(client.client_id)
  if (!isRegisteredRedirectUri(redirectUri, registered)) {
    return untrustedRequestPage("The redirect address in this request is not one the application has registered.")
  }

  // From here the redirect URI is trusted, so errors go back to the client in the standard shape.
  const fail = (code: Parameters<typeof authorizeErrorRedirect>[1]["code"], description: string) =>
    Response.redirect(authorizeErrorRedirect(redirectUri, { code, description, state }).toString(), 302)

  if (params.get("response_type") !== "code") {
    return fail("unsupported_response_type", "Only response_type=code is supported.")
  }

  const codeChallenge = params.get("code_challenge")
  if (params.get("code_challenge_method") !== "S256" || !codeChallenge || !isValidCodeChallenge(codeChallenge)) {
    // PKCE is not optional, and S256 is the only method: a plain challenge gives a network observer
    // the verifier.
    return fail("invalid_request", "A code_challenge with code_challenge_method=S256 is required.")
  }

  const requested = parseScopeParam(params.get("scope"))
  if (!requested.ok) {
    return fail("invalid_scope", requested.reason === "empty" ? "A scope is required." : `Unknown scope: ${requested.unknown}.`)
  }
  if (!isScopeSubset(requested.scopes, client.allowed_scopes)) {
    return fail("invalid_scope", "This application is not registered for one or more of the requested scopes.")
  }

  const requestToken = await createAuthorizationRequest({
    clientId: client.client_id,
    redirectUri,
    scopes: requested.scopes,
    state,
    codeChallenge,
  })

  const cookieLocale = (await cookies()).get(localeCookieName)?.value
  const locale = cookieLocale && isValidLocale(cookieLocale) ? cookieLocale : defaultLocale
  const consent = new URL(`/${locale}/oauth/consent`, request.url)
  consent.searchParams.set("request", requestToken)
  return Response.redirect(consent.toString(), 302)
}
