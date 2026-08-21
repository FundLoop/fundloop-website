"use client"

import { useState } from "react"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { invokePolicyAcknowledgement } from "@/lib/edge-functions/policy-acknowledgement"
import type { PolicyAcknowledgementSource } from "@/lib/edge-functions/policy-acknowledgement-contract"
import { isReviewPolicyPreviewEnabled, REVIEW_POLICY_BANNER, termsReviewDocument } from "@/lib/policies/review-policy"

export function TermsPreviewGate({ sourceSurface, actorCapacity, onAcknowledged }: { sourceSurface: PolicyAcknowledgementSource; actorCapacity: "project_actor" | "user"; onAcknowledged?: (accepted: boolean) => void }) {
  const [checked, setChecked] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewEnabled = isReviewPolicyPreviewEnabled()

  async function acknowledge() {
    if (!checked || !previewEnabled) return
    setBusy(true)
    setError(null)
    const result = await invokePolicyAcknowledgement({ ...termsReviewDocument, sourceSurface, actorCapacity, locale: termsReviewDocument.locale })
    setBusy(false)
    if (!result.ok) { setError(result.error.message); return }
    setAccepted(true)
    onAcknowledged?.(true)
  }

  return (
    <section className="rounded-3xl border-2 border-amber-500 bg-amber-50 p-5 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100" data-testid={`terms-preview-gate-${sourceSurface}`}>
      <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><div className="space-y-3">
        <p className="font-bold tracking-wide">{REVIEW_POLICY_BANNER}</p>
        <p className="text-sm leading-6">This acknowledgement exercises a local/dev preview control only. It is not legal acceptance, does not transfer ownership, and cannot enable a live payment or payout.</p>
        <p className="text-xs font-mono">{termsReviewDocument.documentId} · {termsReviewDocument.contentHash.slice(0, 16)}…</p>
        {!previewEnabled ? <p className="font-semibold">Review acknowledgement is disabled in production.</p> : accepted ? <p className="font-semibold text-emerald-800 dark:text-emerald-200">Review acknowledgement recorded. The simulated boundary is unlocked for this page session only.</p> : <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} /><span>I reviewed the <Link href="/terms" className="underline">non-effective Terms preview</Link> and understand this is only a test acknowledgement.</span></label>
          <Button type="button" variant="outline" onClick={acknowledge} disabled={!checked || busy}>{busy ? "Recording…" : "Record review acknowledgement"}</Button>
        </div>}
        {error ? <p role="alert" className="text-sm font-semibold">{error}</p> : null}
      </div></div>
    </section>
  )
}
