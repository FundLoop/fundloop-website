"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { invokeProfilePublicationChoice } from "@/lib/edge-functions/profile-publication-choice"
import { publicProfileFields } from "@/lib/edge-functions/profile-publication-choice-contract"
import { isReviewPolicyPreviewEnabled, privacyReviewDocument, REVIEW_POLICY_BANNER } from "@/lib/policies/review-policy"

export function ProfilePublicationConsent({ initiallyPublic }: { initiallyPublic: boolean }) {
  const [isPublic, setIsPublic] = useState(initiallyPublic)
  const [affirmed, setAffirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const enabled = isReviewPolicyPreviewEnabled()
  async function choose(action: "grant" | "withdraw") {
    if (!enabled || (action === "grant" && !affirmed)) return
    setBusy(true); setMessage(null)
    const result = await invokeProfilePublicationChoice({ ...privacyReviewDocument, action, fields: action === "grant" ? [...publicProfileFields] : [], sourceSurface: "account_profile_visibility" })
    setBusy(false)
    if (!result.ok) { setMessage(result.error.message); return }
    setIsPublic(result.data.isPublic); setAffirmed(false)
    setMessage(action === "withdraw" ? "Withdrawn prospectively. Your profile was removed from FundLoop public discovery." : "Review publication choice recorded for local/dev discovery only.")
  }
  return <section className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-5 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100" data-testid="profile-publication-consent">
    <p className="font-bold">{REVIEW_POLICY_BANNER}</p><p className="mt-2 text-sm leading-6">Public profile publication is optional and separate from Terms and project membership. This review control is not legal consent or an effective Privacy Notice.</p>
    <p className="mt-2 text-xs font-mono">{privacyReviewDocument.documentId} · {privacyReviewDocument.contentHash.slice(0, 16)}…</p>
    {!enabled ? <p className="mt-3 font-semibold">Review publication is disabled in production.</p> : isPublic ? <Button className="mt-4" variant="outline" disabled={busy} onClick={() => choose("withdraw")}>{busy ? "Withdrawing…" : "Withdraw public-profile publication"}</Button> : <div className="mt-4 space-y-3"><label className="flex items-start gap-3 text-sm"><Checkbox checked={affirmed} onCheckedChange={(value) => setAffirmed(value === true)} /><span>Publish my display name, avatar, headline, bio, occupation, and location in FundLoop public discovery. This optional choice is not preselected.</span></label><Button variant="outline" disabled={!affirmed || busy} onClick={() => choose("grant")}>{busy ? "Saving…" : "Publish profile in review preview"}</Button></div>}
    {message ? <p role="status" className="mt-3 text-sm font-semibold">{message}</p> : null}
  </section>
}

