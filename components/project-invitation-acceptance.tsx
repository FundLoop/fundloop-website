"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingAuthStep } from "@/components/onboarding/onboarding-auth-step"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { invokeProjectInvitationAccept, invokeProjectInvitationDecline, invokeProjectInvitationInspect } from "@/lib/edge-functions/project-invitation"
import type { ProjectInvitationInspectResult } from "@/lib/edge-functions/project-invitation-contract"
import { isReviewPolicyPreviewEnabled, REVIEW_POLICY_BANNER } from "@/lib/policies/review-policy"

const FIELD_LABELS: Record<string, string> = {
  display_name: "display name", avatar: "avatar", profile_headline: "profile headline",
  bio: "bio", occupation: "occupation", location: "location",
}

export function ProjectInvitationAcceptance({ token, locale }: { token: string; locale: string }) {
  const router = useRouter()
  const previewEnabled = isReviewPolicyPreviewEnabled()
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [invitation, setInvitation] = useState<ProjectInvitationInspectResult | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<{ name: string; slug: string } | null>(null)
  const [declined, setDeclined] = useState(false)

  useEffect(() => {
    const client = getSupabaseBrowserClient()
    void client.auth.getUser().then(({ data }) => setAuthenticated(Boolean(data.user)))
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => setAuthenticated(Boolean(session?.user)))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authenticated) return
    void invokeProjectInvitationInspect({ token }).then((result) => {
      if (result.ok) setInvitation(result.data)
      else setError(result.error.message)
    })
  }, [authenticated, token])

  async function accept() {
    if (!invitation || !acknowledged) return
    setBusy(true); setError(null)
    const result = await invokeProjectInvitationAccept({ token, acknowledged: true,
      policyDocumentId: invitation.policyDocumentId, policyContentHash: invitation.policyContentHash,
      policyLocale: invitation.policyLocale, sharedProfileFields: invitation.sharedProfileFields })
    setBusy(false)
    if (!result.ok) return setError(result.error.message)
    setAccepted({ name: result.data.projectName, slug: result.data.projectSlug })
  }

  async function decline() {
    setBusy(true); setError(null)
    const result = await invokeProjectInvitationDecline({ token })
    setBusy(false)
    if (!result.ok) return setError(result.error.message)
    setDeclined(true)
  }

  if (authenticated === null) return <p className="text-sm text-[var(--text-muted)]">Checking your session…</p>
  if (!authenticated) return <OnboardingAuthStep title="Sign in to review" description="Use the exact email address that the project invited. Pending invitations grant no access." onAuthenticated={() => setAuthenticated(true)} />
  if (accepted) return <div className="space-y-4" data-testid="project-invitation-accepted"><p className="text-lg font-semibold">You joined {accepted.name}.</p><p className="text-sm text-[var(--text-muted)]">Your selected project profile fields are now shared only with project participants.</p><Button onClick={() => router.push(`/${locale}/projects/${accepted.slug}`)}>View project</Button></div>
  if (declined) return <p data-testid="project-invitation-declined" className="text-sm font-semibold">Invitation declined. No membership or profile access was granted.</p>
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4" data-testid="invitation-review-disclosure">
        <p className="font-bold text-amber-900 dark:text-amber-100">{REVIEW_POLICY_BANNER}</p>
        <p className="mt-2 text-sm">This local/dev review disclosure is not legal approval and does not activate production sharing.</p>
      </div>
      {!previewEnabled ? <p role="alert" className="text-sm text-rose-700">Invitation acceptance is unavailable in production until professional approval and activation.</p> : null}
      {!invitation && !error ? <p className="text-sm text-[var(--text-muted)]">Verifying this private invitation…</p> : null}
      {invitation ? <>
        <div><p className="font-semibold">Invitation to {invitation.projectName}</p><p className="text-sm text-[var(--text-muted)]">Role: {invitation.role}. Pending access remains private.</p></div>
        <div><p className="text-sm font-semibold">Fields shared after acceptance</p><ul className="mt-1 list-disc pl-5 text-sm">{invitation.sharedProfileFields.map((field) => <li key={field}>{FIELD_LABELS[field]}</li>)}</ul></div>
        <p className="break-all text-xs text-[var(--text-muted)]">Disclosure: {invitation.policyDocumentId} · {invitation.policyLocale} · {invitation.policyContentHash}</p>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />I acknowledge this exact non-effective review disclosure and choose to join this project with only the listed fields shared.</label>
        <div className="flex flex-wrap gap-3"><Button onClick={accept} disabled={busy || !acknowledged || !previewEnabled}>{busy ? "Recording response…" : "Acknowledge and accept"}</Button><Button variant="outline" onClick={decline} disabled={busy || !previewEnabled}>Decline invitation</Button></div>
      </> : null}
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{error}</p> : null}
    </div>
  )
}
