"use client"

import { useState } from "react"
import { Landmark } from "lucide-react"
import { invokeUserWithdrawalRequestCreate } from "@/lib/edge-functions/user-withdrawal-request"
import type { UserWithdrawalRequest } from "@/lib/workspace/user-earnings-workspace"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TermsPreviewGate } from "@/components/policies/terms-preview-gate"

function usd(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
}

export function WithdrawalRequestPanel({
  eligibleUsd,
  defaultRoute,
  initialRequests,
  termsPreviewRequired = false,
}: {
  eligibleUsd: number
  defaultRoute: { id: number; label: string } | null
  initialRequests: UserWithdrawalRequest[]
  termsPreviewRequired?: boolean
}) {
  const [requests, setRequests] = useState(initialRequests)
  const [available, setAvailable] = useState(eligibleUsd)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [termsPreviewAcknowledged, setTermsPreviewAcknowledged] = useState(!termsPreviewRequired)

  async function requestWithdrawal() {
    if (!defaultRoute || !termsPreviewAcknowledged) return
    setBusy(true)
    setError(null)
    const result = await invokeUserWithdrawalRequestCreate({ payoutRouteId: defaultRoute.id, idempotencyKey: crypto.randomUUID() })
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setAvailable(0)
    setRequests((current) => [{
      id: result.data.requestId,
      payoutRouteId: result.data.payoutRouteId,
      status: "requested",
      requestedUsdAmount: result.data.requestedUsdAmount,
      currencyCode: "USD",
      creditCount: result.data.creditCount,
      requestedAt: result.data.requestedAt,
    }, ...current])
  }

  return (
    <div className="space-y-4">
      {termsPreviewRequired ? <TermsPreviewGate sourceSurface="payout_preview" actorCapacity="user" onAcknowledged={setTermsPreviewAcknowledged} /> : null}
    <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]" data-testid="withdrawal-request-panel">
      <CardHeader>
        <div className="flex items-center gap-3"><Landmark className="h-5 w-5 text-[var(--interactive-primary)]" /><CardTitle>Request withdrawal</CardTitle></div>
        <CardDescription>Reserve eligible credited earnings for a future payout. This request does not move money and does not mark earnings paid.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4"><p className="text-sm text-[var(--text-muted)]">Eligible credited, not paid</p><p className="mt-2 text-2xl font-semibold">{usd(available)}</p></div>
          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4"><p className="text-sm text-[var(--text-muted)]">Active default route</p><p className="mt-2 font-semibold">{defaultRoute?.label ?? "Not configured"}</p></div>
        </div>
        <Button onClick={requestWithdrawal} disabled={!termsPreviewAcknowledged || busy || available <= 0 || !defaultRoute}>
          {!termsPreviewAcknowledged ? "Review acknowledgement required" : busy ? "Submitting request…" : available <= 0 ? "No eligible earnings" : !defaultRoute ? "Default payout route required" : `Request ${usd(available)}`}
        </Button>
        {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{error}</p> : null}
        <div className="space-y-3" data-testid="withdrawal-request-history">
          {requests.map((request) => (
            <div key={request.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
              <div><p className="font-semibold">{usd(request.requestedUsdAmount)} requested</p><p className="text-sm text-[var(--text-muted)]">{request.creditCount} credited earning{request.creditCount === 1 ? "" : "s"} reserved · no payout executed</p></div>
              <Badge variant="outline">Requested · not paid</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card></div>
  )
}
