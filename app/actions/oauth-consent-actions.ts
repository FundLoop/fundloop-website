"use server"

import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { authorizeErrorRedirect, authorizeSuccessRedirect } from "@/lib/oauth/errors"
import { isOAuthScope, isScopeSubset, type OAuthScope } from "@/lib/oauth/scopes"
import { defaultLocale, isValidLocale } from "@/i18n/routing"
import { approveAuthorizationRequest, denyAuthorizationRequest, readAuthorizationRequest } from "@/lib/oauth/store"

// The consent decision (#266 stage 2).
//
// Everything that matters is re-read from the stored authorization request, not from the form: the
// redirect URI, the PKCE challenge and the requested scopes. A tampered form field can therefore
// only narrow what is granted, never widen it or change where the code is sent.

// Errors return to the consent page in the locale the person was using.
function consentPath(formData: FormData, error: string) {
  const submitted = String(formData.get("locale") ?? "")
  const locale = isValidLocale(submitted) ? submitted : defaultLocale
  return `/${locale}/oauth/consent?error=${error}`
}

async function currentUserId() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

export async function approveOAuthConsent(formData: FormData) {
  const requestToken = String(formData.get("request") ?? "")
  const userId = await currentUserId()
  if (!requestToken || !userId) redirect(consentPath(formData, "session"))

  const request = await readAuthorizationRequest(requestToken)
  if (!request) redirect(consentPath(formData, "expired"))

  // A person may withhold individual scopes. The submitted set has to be a subset of what the
  // client asked for, and at least one scope, or there is nothing to grant.
  const submitted = formData.getAll("scope").map(String).filter(isOAuthScope) as OAuthScope[]
  const granted = submitted.length > 0 ? submitted : request.scopes
  if (!isScopeSubset(granted, request.scopes)) redirect(consentPath(formData, "scope"))

  const result = await approveAuthorizationRequest({ requestToken, userId, scopes: granted })
  if (!result.ok) {
    redirect(authorizeErrorRedirect(request.redirect_uri, {
      code: "server_error",
      description: "The authorization request could not be completed. Please start again.",
      state: request.state,
    }).toString())
  }

  redirect(authorizeSuccessRedirect(result.redirectUri, { code: result.code, state: result.state }).toString())
}

export async function denyOAuthConsent(formData: FormData) {
  const requestToken = String(formData.get("request") ?? "")
  const request = requestToken ? await denyAuthorizationRequest(requestToken) : null
  if (!request) redirect(consentPath(formData, "expired"))

  // RFC 6749 §4.1.2.1: a refusal is reported to the client as access_denied.
  redirect(authorizeErrorRedirect(request.redirectUri, {
    code: "access_denied",
    description: "The person declined the request.",
    state: request.state,
  }).toString())
}
