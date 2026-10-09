import { notFound } from "next/navigation"
import { isValidLocale } from "@/i18n/routing"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { findEnabledClient, readAuthorizationRequest } from "@/lib/oauth/store"
import { OAuthConsentForm } from "@/components/oauth/oauth-consent-form"
import { OAuthConsentSignIn } from "@/components/oauth/oauth-consent-sign-in"

// The consent screen for delegated access (#266 stage 2).
//
// Reached only by redirect from /oauth/authorize, which has already validated the client, the
// redirect URI, the PKCE challenge and the scopes, and stored them against the opaque request token
// in the URL. Nothing here comes from the client application's own parameters.
export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ request?: string; error?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  session: "You were signed out before the decision was recorded. Start again from the application.",
  expired: "This request has expired or was already answered. Start again from the application.",
  scope: "That combination of permissions does not match the request. Start again from the application.",
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16 sm:py-24">
      <div className="rounded-[2rem] border border-[color:var(--marketing-line)] p-6 sm:p-8">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">FundLoop</p>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}

export default async function OAuthConsentPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  if (!isValidLocale(locale)) notFound()

  const { request: requestToken, error } = await searchParams

  if (error) {
    return <Shell title="This request could not be completed">
      <p className="text-sm leading-6 text-[var(--text-muted)]">{ERROR_MESSAGES[error] ?? ERROR_MESSAGES.expired}</p>
    </Shell>
  }

  if (!requestToken) notFound()

  const authorizationRequest = await readAuthorizationRequest(requestToken)
  if (!authorizationRequest) {
    return <Shell title="This request has expired">
      <p className="text-sm leading-6 text-[var(--text-muted)]">{ERROR_MESSAGES.expired}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Nothing has been shared.</p>
    </Shell>
  }

  const client = await findEnabledClient(authorizationRequest.client_id)
  if (!client) {
    return <Shell title="This application is no longer registered">
      <p className="text-sm leading-6 text-[var(--text-muted)]">Its access to FundLoop has been withdrawn. Nothing has been shared.</p>
    </Shell>
  }

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  // Sign-in happens on this page so the request token in the URL survives it. The person decides
  // after they are signed in, never before, so a request can only be approved by an account that
  // was authenticated for this decision.
  if (!user) {
    return <Shell title={`Sign in to connect ${client.name}`}>
      <p className="text-sm leading-6 text-[var(--text-muted)]">
        {client.name} is asking to read part of your FundLoop account. Sign in first, and you will come back here to decide.
      </p>
      <div className="mt-6">
        <OAuthConsentSignIn clientName={client.name} />
      </div>
    </Shell>
  }

  return <Shell title={`Allow ${client.name} to read your FundLoop data?`}>
    {client.is_sandbox ? (
      <p className="mb-5 rounded-xl border border-[color:var(--marketing-line)] bg-black/[0.03] p-3 text-sm dark:bg-white/[0.04]">
        This is a sandbox application. It is for testing an integration, not for production use.
      </p>
    ) : null}
    {client.description ? <p className="mb-5 text-sm leading-6 text-[var(--text-muted)]">{client.description}</p> : null}
    <OAuthConsentForm
      requestToken={requestToken}
      locale={locale}
      clientName={client.name}
      clientUri={client.client_uri}
      scopes={authorizationRequest.scopes}
      accountLabel={user.email ?? "your account"}
    />
  </Shell>
}
