"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingAuthStep } from "@/components/onboarding/onboarding-auth-step"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { invokeProjectInvitationAccept } from "@/lib/edge-functions/project-invitation"

export function ProjectInvitationAcceptance({ token, locale }: { token: string; locale: string }) {
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<{ name: string; slug: string } | null>(null)

  useEffect(() => {
    const client = getSupabaseBrowserClient()
    void client.auth.getUser().then(({ data }) => setAuthenticated(Boolean(data.user)))
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => setAuthenticated(Boolean(session?.user)))
    return () => subscription.unsubscribe()
  }, [])

  async function accept() {
    setBusy(true)
    setError(null)
    const result = await invokeProjectInvitationAccept({ token })
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setAccepted({ name: result.data.projectName, slug: result.data.projectSlug })
  }

  if (authenticated === null) return <p className="text-sm text-[var(--text-muted)]">Checking your session…</p>
  if (!authenticated) return <OnboardingAuthStep title="Sign in to accept" description="Use the exact email address that the project invited." onAuthenticated={() => setAuthenticated(true)} />
  if (accepted) return (
    <div className="space-y-4" data-testid="project-invitation-accepted">
      <p className="text-lg font-semibold">You joined {accepted.name}.</p>
      <p className="text-sm text-[var(--text-muted)]">Your project participation and organization membership are active. Accepting this link again is safe.</p>
      <Button onClick={() => router.push(`/${locale}/projects/${accepted.slug}`)}>View project</Button>
    </div>
  )
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)]">Invitation details stay private until your authenticated email is verified.</p>
      <Button onClick={accept} disabled={busy}>{busy ? "Accepting invitation…" : "Accept project invitation"}</Button>
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{error}</p> : null}
    </div>
  )
}
