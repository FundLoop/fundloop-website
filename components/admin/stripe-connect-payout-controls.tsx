"use client"

import { useState } from "react"
import { Building2 } from "lucide-react"
import { invokeStripeConnectPayout } from "@/lib/edge-functions/stripe-connect-payout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Account = { id: number; user_id: string; onboarding_status: string; country_code: string; default_currency: string; payouts_enabled: boolean; external_account_enabled: boolean; external_account_last4: string | null; currently_due_count: number; disabled_reason: string | null }
type Command = { id: number; payout_intent_id: number; status: string; currency_code: string; gross_minor: number | string; user_fee_minor: number | string; net_minor: number | string; provider_payout_minor: number | string; failure_code: string | null; submitted_at: string | null; settled_at: string | null; ledger_transaction_id: number | null }
type Intent = { id: number; user_id: string; rail: string | null; status: string; amount_usd: number; payout_route_id: number | null }

export function StripeConnectPayoutControls({ enabled, accounts, commands, intents }: { enabled: boolean; accounts: Account[]; commands: Command[]; intents: Intent[] }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null)
  async function submit(payoutIntentId: number) { setBusy(true); setMessage(null); const result = await invokeStripeConnectPayout({ action: "submit", payoutIntentId }); setBusy(false)
    setMessage(result.ok ? `Stripe sandbox checkpoint submitted for intent #${payoutIntentId}. Settlement and journal are still pending.` : result.error.message); if (result.ok) location.reload() }
  if (!enabled) return <Card data-testid="stripe-connect-operator-closed"><CardHeader><CardTitle>Stripe Connect review unavailable</CardTitle><CardDescription>The sandbox operator is disabled in production and without the explicit review flag.</CardDescription></CardHeader></Card>
  return <Card data-testid="stripe-connect-payout-controls"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5"/>Stripe Connect sandbox checkpoints</CardTitle>
    <CardDescription>Submit only persisted withdrawal-backed intents. Connected-account transfer, payout, signed provider events, and balanced journal reconciliation remain distinct checkpoints.</CardDescription></CardHeader>
    <CardContent className="space-y-5"><div className="grid gap-3 md:grid-cols-3">{accounts.map((account) => <div key={account.id} className="rounded-xl border p-3"><div className="flex items-center justify-between"><span className="font-medium">{account.country_code} · {account.default_currency}</span><Badge variant={account.onboarding_status === "ready" ? "default" : "secondary"}>{account.onboarding_status.replaceAll("_", " ")}</Badge></div><p className="mt-2 text-xs text-[var(--text-muted)]">{account.external_account_last4 ? `Bank ••••${account.external_account_last4}` : "No eligible external account"} · {account.currently_due_count} due</p></div>)}</div>
      {intents.filter((intent) => intent.rail === "fiat_stub" && ["draft", "failed"].includes(intent.status)).map((intent) => <div key={intent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><span>Intent #{intent.id} · ${intent.amount_usd.toFixed(2)} · {intent.status}</span><Button size="sm" disabled={busy} onClick={() => submit(intent.id)}>{intent.status === "failed" ? "Retry without double transfer" : "Submit sandbox payout"}</Button></div>)}
      {commands.map((command) => <div key={command.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium">Command #{command.id} · intent #{command.payout_intent_id}</p><p className="text-xs text-[var(--text-muted)]">Canonical net {command.net_minor} · provider {command.provider_payout_minor} {command.currency_code} minor · fee {command.user_fee_minor}</p></div><div className="text-right"><Badge variant="outline">{command.status.replaceAll("_", " ")}</Badge><p className="mt-1 text-xs text-[var(--text-muted)]">{command.ledger_transaction_id ? `Journal #${command.ledger_transaction_id}` : command.failure_code ?? "Awaiting settlement journal"}</p></div></div>)}
      {message ? <p role="status" className="text-sm">{message}</p> : null}</CardContent></Card>
}
