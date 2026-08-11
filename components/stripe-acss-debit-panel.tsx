"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Landmark, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { invokeStripeAcssDebitCheckoutBrowser } from "@/lib/edge-functions/stripe-acss-debit-checkout"
import { invokeStripeAcssDebitStatusBrowser } from "@/lib/edge-functions/stripe-acss-debit-status"
import type { StripeAcssDebitStatus } from "@/lib/stripe/stripe-acss-debit-contract"

type PaymentOption = {id: number; paymentAmount: number; statusCode: string; periodStart: string; periodEnd: string}

function statusDescription(status: StripeAcssDebitStatus) {
  if (status.reversed || ["refunded", "dispute_lost"].includes(status.status)) return "Reversed and removed from package eligibility; the project requires new settled funding."
  if (status.status === "disputed") return "Dispute open; this source is blocked from every project package until Stripe resolves it."
  if (status.availableForPackage) return "Reconciled: available custody and balanced provisional journal verified."
  if (["processing", "checkout_completed"].includes(status.status)) return "Authorization recorded; PAD settlement is pending and not fundable."
  if (status.status === "checkout_created") return "Authorization required in Stripe-hosted Checkout; no funding has been recorded."
  return "Not fundable; awaiting authoritative settlement."
}

export function StripeAcssDebitPanel({projectSlug, payments, termsAcknowledged}: {projectSlug: string; payments: PaymentOption[]; termsAcknowledged: boolean}) {
  const [statuses, setStatuses] = useState<StripeAcssDebitStatus[]>([])
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void invokeStripeAcssDebitStatusBrowser(projectSlug).then((result) => { if (active && result.ok) setStatuses(result.data) })
    return () => { active = false }
  }, [projectSlug])
  const create = async (payment: PaymentOption) => {
    if (!termsAcknowledged) return
    setLoadingId(payment.id); setError(null)
    const result = await invokeStripeAcssDebitCheckoutBrowser({projectSlug, paymentId: payment.id, currencyCode: "CAD", expectedAmountMinor: String(Math.round(payment.paymentAmount * 100))})
    if (result.ok) window.location.assign(result.data.checkoutUrl)
    else { setError(result.error.message); setLoadingId(null) }
  }
  const eligible = payments.filter((payment) => ["draft", "pending", "failed"].includes(payment.statusCode))
  return <Card data-testid="stripe-acss-debit-panel" className="border-sky-200 dark:border-sky-900">
    <CardHeader><div className="flex items-start gap-3"><div className="rounded-full bg-sky-100 p-2 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Landmark className="h-5 w-5"/></div><div>
      <CardTitle>Canadian pre-authorized debit</CardTitle>
      <CardDescription>Authorize a one-time CAD business PAD in Stripe-hosted Checkout. FundLoop never receives your bank account details.</CardDescription>
    </div></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p><strong>Sandbox and delayed settlement.</strong> Returning from Checkout does not fund the project. The payment remains pending until signed Stripe evidence proves the PAD settled into available custody. USD and production remain disabled.</p></div>
      </div>
      {eligible.length === 0 ? <p className="text-sm text-slate-500">No draft payment is ready for PAD authorization.</p> : <div className="space-y-2">{eligible.map((payment) => {
        const status = statuses.find((row) => row.paymentId === payment.id)
        const resumable = !status || ["prepared", "checkout_created", "checkout_completed", "processing"].includes(status.status)
        return <div key={payment.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`stripe-acss-payment-${payment.id}`}>
          <div><p className="font-medium">Payment #{payment.id} · {new Intl.NumberFormat("en-CA", {style: "currency", currency: "CAD"}).format(payment.paymentAmount)}</p>
            <p className="text-xs text-slate-500">{payment.periodStart} to {payment.periodEnd}</p>
            {status ? <div className="mt-2 flex flex-wrap gap-2"><Badge variant={status.availableForPackage ? "default" : "outline"}>{status.status.replaceAll("_", " ")}</Badge>
              <span className="text-xs text-slate-500">{statusDescription(status)}</span></div> : null}</div>
          <Button variant="outline" disabled={!termsAcknowledged || loadingId !== null || !resumable} onClick={() => void create(payment)} data-testid={`stripe-acss-create-${payment.id}`}>
            {loadingId === payment.id ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Landmark className="mr-2 h-4 w-4"/>}{!resumable ? "New payment required" : status ? "Resume CAD PAD" : "Open CAD PAD Checkout"}
          </Button>
        </div>
      })}</div>}
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
    </CardContent>
  </Card>
}
