"use client"

import { useState } from "react"
import { Building2, ExternalLink, RefreshCw } from "lucide-react"
import { invokeStripeConnectAccount } from "@/lib/edge-functions/stripe-connect-account"
import type { StripeConnectOverview } from "@/lib/stripe/stripe-connect-overview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function money(minor: string, currency: string) { return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(minor) / 100) }

export function StripeConnectPanel({ initial, onRedirect = (url: string) => window.location.assign(url) }: { initial: StripeConnectOverview; onRedirect?: (url: string) => void }) {
  const [overview, setOverview] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  async function run(action: "onboard" | "refresh" | "manage", countryCode: "US" | "CA" = "CA", defaultCurrency: "USD" | "CAD" = "CAD") {
    setBusy(true); setError(null)
    const result = await invokeStripeConnectAccount(action === "onboard" ? { action, countryCode, defaultCurrency } : { action })
    setBusy(false)
    if (!result.ok) { setError(result.error.message); return }
    const data = result.data as { redirectUrl?: string; account?: Record<string, unknown> }
    if (data.redirectUrl) { onRedirect(data.redirectUrl); return }
    const account = data.account
    if (account) setOverview((current) => ({ ...current, account: { status: account.onboardingStatus as NonNullable<StripeConnectOverview["account"]>["status"],
      countryCode: account.countryCode as "US" | "CA", defaultCurrency: account.defaultCurrency as "USD" | "CAD", payoutsEnabled: Boolean(account.payoutsEnabled),
      externalAccountEnabled: Boolean(account.externalAccountEnabled), externalAccountLast4: String(account.externalAccountLast4 || "") || null,
      currentlyDueCount: Number(account.currentlyDueCount), disabledReason: String(account.disabledReason || "") || null, updatedAt: new Date().toISOString() } }))
  }
  if (!overview.available) return <Card data-testid="stripe-connect-production-closed"><CardHeader><CardTitle>Stripe payouts unavailable</CardTitle><CardDescription>Stripe Connect onboarding and payouts are disabled in production until the production approval gates are complete.</CardDescription></CardHeader></Card>
  const account = overview.account; const ready = account?.status === "ready"
  return <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]" data-testid="stripe-connect-panel">
    <CardHeader><div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-[var(--interactive-primary)]"/><CardTitle>Stripe Connect payout account</CardTitle></div>
      <CardDescription>Stripe-hosted onboarding collects and stores bank details. FundLoop retains only readiness, country, currency, and a redacted last four. Sandbox payouts support USD and CAD.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border p-4"><p className="text-sm text-[var(--text-muted)]">Onboarding</p><p className="mt-2 font-semibold">{account?.status.replaceAll("_", " ") ?? "Not started"}</p></div>
        <div className="rounded-2xl border p-4"><p className="text-sm text-[var(--text-muted)]">Payout readiness</p><p className="mt-2 font-semibold">{ready ? "Ready in sandbox" : "Blocked"}</p></div>
        <div className="rounded-2xl border p-4"><p className="text-sm text-[var(--text-muted)]">Destination</p><p className="mt-2 font-semibold">{account?.externalAccountLast4 ? `Bank ••••${account.externalAccountLast4}` : "Held by Stripe"}</p></div>
      </div>
      {account?.currentlyDueCount ? <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Stripe requires {account.currentlyDueCount} update{account.currentlyDueCount === 1 ? "" : "s"}. Payout reservations remain held until the hosted flow is complete.</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => run("onboard", account?.countryCode ?? "CA", account?.defaultCurrency ?? "CAD")} disabled={busy}>{account ? "Continue hosted onboarding" : "Start hosted onboarding"}<ExternalLink className="ml-2 h-4 w-4"/></Button>
        {account ? <Button variant="outline" onClick={() => run("refresh")} disabled={busy}><RefreshCw className="mr-2 h-4 w-4"/>Refresh readiness</Button> : null}
        {account ? <Button variant="outline" onClick={() => run("manage")} disabled={busy}>Manage on Stripe<ExternalLink className="ml-2 h-4 w-4"/></Button> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
      <div className="space-y-2" data-testid="stripe-connect-payout-history">
        {overview.payouts.map((payout) => <div key={payout.id} className="flex items-center justify-between gap-3 rounded-2xl border p-4"><div><p className="font-semibold">{money(payout.netMinor, payout.currencyCode)} net</p><p className="text-xs text-[var(--text-muted)]">Gross {money(payout.grossMinor,payout.currencyCode)} · fee {money(payout.feeMinor,payout.currencyCode)} · trace #{payout.id}</p></div><Badge variant="outline">{payout.status.replaceAll("_", " ")}</Badge></div>)}
        {overview.payouts.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No Stripe sandbox payouts yet. Paid appears only after Stripe settlement and a balanced journal.</p> : null}
      </div>
    </CardContent>
  </Card>
}
