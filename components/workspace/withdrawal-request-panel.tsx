"use client"

import { useMemo, useState } from "react"
import { Landmark } from "lucide-react"
import { invokeUserWithdrawalRequestCreate } from "@/lib/edge-functions/user-withdrawal-request"
import type { UserWithdrawalAssetOption, UserWithdrawalRequest } from "@/lib/workspace/user-earnings-workspace"
import type { Database } from "@/types/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TermsPreviewGate } from "@/components/policies/terms-preview-gate"

function usd(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
}

const statusLabels: Record<UserWithdrawalRequest["status"], string> = {
  requested: "Requested", reserved: "Reserved", queued: "Queued for next epoch", held: "Compliance hold",
  paid: "Paid", cancelled: "Cancelled", closed: "Closed",
}

export function WithdrawalRequestPanel({ eligibleUsd, defaultRoute, assetOptions, initialRequests, termsPreviewRequired = false }: {
  eligibleUsd: number
  defaultRoute: { id: number; label: string; rail: Database["public"]["Enums"]["payout_rail"] } | null
  assetOptions: UserWithdrawalAssetOption[]
  initialRequests: UserWithdrawalRequest[]
  termsPreviewRequired?: boolean
}) {
  const compatibleAssets = useMemo(() => assetOptions.filter((asset) =>
    defaultRoute?.rail === "fiat_stub" ? asset.railKey === "stripe_bank_transfer" : defaultRoute?.rail === "evm" ? asset.railKey === "base_stablecoin" : false),
  [assetOptions, defaultRoute?.rail])
  const [requests, setRequests] = useState(initialRequests)
  const [amount, setAmount] = useState(eligibleUsd > 0 ? eligibleUsd.toFixed(2) : "")
  const [assetKey, setAssetKey] = useState(compatibleAssets[0]?.assetKey ?? "")
  const [projectId, setProjectId] = useState(compatibleAssets[0]?.projectId ?? 0)
  const [feePercent, setFeePercent] = useState("0")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [termsPreviewAcknowledged, setTermsPreviewAcknowledged] = useState(!termsPreviewRequired)
  const amountNumber = Number(amount)
  const requestedMinor = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : 0

  async function requestWithdrawal() {
    if (!defaultRoute || !termsPreviewAcknowledged || !assetKey || projectId <= 0 || requestedMinor <= 0) return
    setBusy(true); setError(null)
    const result = await invokeUserWithdrawalRequestCreate({ action: "create", payoutRouteId: defaultRoute.id, requestedMinor,
      projectId, assetKey, userFeeBps: Math.round(Number(feePercent) * 100), idempotencyKey: crypto.randomUUID() })
    setBusy(false)
    if (!result.ok) { setError(result.error.message); return }
    const now = new Date().toISOString()
    const selectedCurrency = compatibleAssets.find((asset) => asset.assetKey === (result.data.assetKey ?? assetKey) && asset.projectId === projectId)?.symbol === "CAD" ? "CAD" : "USD"
    setRequests((current) => [{ id: result.data.requestId, payoutRouteId: defaultRoute.id, status: result.data.status,
      requestedUsdAmount: Number(result.data.requestedMinor ?? requestedMinor) / 100, currencyCode: selectedCurrency, creditCount: 0,
      requestedAt: now, assetKey: result.data.assetKey ?? assetKey, feeUsd: Number(result.data.feeMinor ?? 0) / 100,
      netUsd: Number(result.data.netMinor ?? requestedMinor) / 100, statusReason: null }, ...current])
  }

  async function cancelRequest(requestId: string) {
    setBusy(true); setError(null)
    const result = await invokeUserWithdrawalRequestCreate({ action: "cancel", requestId, reason: "user_cancelled" })
    setBusy(false)
    if (!result.ok) { setError(result.error.message); return }
    setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status: "cancelled" } : request))
  }

  const minimum = defaultRoute?.rail === "fiat_stub" ? 10 : 5
  const canSubmit = termsPreviewAcknowledged && !busy && Boolean(defaultRoute && assetKey && projectId) && amountNumber >= minimum && Number(feePercent) >= 0 && Number(feePercent) <= 100

  return <div className="space-y-4">
    {termsPreviewRequired ? <TermsPreviewGate sourceSurface="payout_preview" actorCapacity="user" onAcknowledged={setTermsPreviewAcknowledged} /> : null}
    <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]" data-testid="withdrawal-request-panel">
      <CardHeader>
        <div className="flex items-center gap-3"><Landmark className="h-5 w-5 text-[var(--interactive-primary)]" /><CardTitle>Request a partial withdrawal</CardTitle></div>
        <CardDescription>Choose one route, one project-linked asset, and an amount. FundLoop reserves oldest earnings and exact inventory atomically. No provider call or money movement occurs in this review environment.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4"><p className="text-sm text-[var(--text-muted)]">Available obligations</p><p className="mt-2 text-2xl font-semibold">{usd(eligibleUsd)}</p></div>
          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4"><p className="text-sm text-[var(--text-muted)]">Active route</p><p className="mt-2 font-semibold">{defaultRoute?.label ?? "Not configured"}</p></div>
          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4"><p className="text-sm text-[var(--text-muted)]">Eligible inventory</p><p className="mt-2 font-semibold">{compatibleAssets.length} asset{compatibleAssets.length === 1 ? "" : "s"}</p></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm font-medium">Amount (USD)
            <input aria-label="Amount (USD)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-11 w-full rounded-xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-3" />
            <span className="block text-xs font-normal text-[var(--text-muted)]">Minimum {usd(minimum)} · partial requests allowed</span>
          </label>
          <label className="space-y-2 text-sm font-medium">Project-linked asset
            <select aria-label="Project-linked asset" value={`${projectId}:${assetKey}`} onChange={(event) => {
              const selected = compatibleAssets.find((asset) => `${asset.projectId}:${asset.assetKey}` === event.target.value)
              setProjectId(selected?.projectId ?? 0)
              setAssetKey(selected?.assetKey ?? "")
            }} className="h-11 w-full rounded-xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-3">
              <option value="">Select eligible inventory</option>
              {compatibleAssets.map((asset) => <option key={`${asset.projectId}:${asset.assetKey}`} value={`${asset.projectId}:${asset.assetKey}`}>{asset.symbol} · project {asset.projectId} · {usd(asset.availableUsd)}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">User fee snapshot (%)
            <input aria-label="User fee snapshot (%)" type="number" min="0" max="100" step="1" value={feePercent} onChange={(event) => setFeePercent(event.target.value)} className="h-11 w-full rounded-xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-3" />
            <span className="block text-xs font-normal text-[var(--text-muted)]">Accepted range 0%–100%; the snapshot is immutable.</span>
          </label>
        </div>
        <Button onClick={requestWithdrawal} disabled={!canSubmit}>
          {!termsPreviewAcknowledged ? "Review acknowledgement required" : busy ? "Updating…" : !defaultRoute ? "Payout route required" : !assetKey ? "Eligible asset required" : amountNumber < minimum ? `Minimum ${usd(minimum)}` : `Reserve ${usd(amountNumber)}`}
        </Button>
        {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{error}</p> : null}
        <div className="space-y-3" data-testid="withdrawal-request-history">
          {requests.map((request) => <div key={request.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4 sm:flex-row sm:items-center">
            <div><p className="font-semibold">{usd(request.requestedUsdAmount)} · {request.assetKey ?? "legacy USD"}</p><p className="text-sm text-[var(--text-muted)]">Fee {usd(request.feeUsd)} · net {usd(request.netUsd)} · one obligation path · no payout executed</p></div>
            <div className="flex items-center gap-2"><Badge variant="outline">{statusLabels[request.status]}</Badge>
              {(["requested", "reserved", "queued", "held"] as const).includes(request.status as never) ? <Button size="sm" variant="outline" onClick={() => cancelRequest(request.id)} disabled={busy}>Cancel</Button> : null}
            </div>
          </div>)}
        </div>
      </CardContent>
    </Card>
  </div>
}
