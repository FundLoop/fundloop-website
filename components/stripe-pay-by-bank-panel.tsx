"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Landmark, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { invokeStripePayByBankCheckoutBrowser } from "@/lib/edge-functions/stripe-pay-by-bank-checkout"
import { invokeStripePayByBankStatusBrowser } from "@/lib/edge-functions/stripe-pay-by-bank-status"
import type { StripePayByBankStatus } from "@/lib/stripe/stripe-pay-by-bank-contract"

type PaymentOption = {id: number; paymentAmount: number; statusCode: string; periodStart: string; periodEnd: string}

function statusDescription(status: StripePayByBankStatus) {
  if (status.reversed || status.status === "refunded") return "Refunded and removed from package eligibility; any remaining partial balance stays quarantined from allocation."
  if (status.status === "refund_pending") return "Refund pending; this source is blocked from project packages until Stripe resolves it."
  if (status.status === "refund_failed") return "Refund failed; authoritative settled custody may be used only in a newly validated package."
  if (status.availableForPackage) return "Reconciled: available custody and balanced provisional journal verified."
  if (["processing", "checkout_completed"].includes(status.status)) return "Authorization recorded; Pay by Bank settlement is pending and not fundable."
  if (status.status === "checkout_created") return "Authorization required in Stripe-hosted Checkout; no funding has been recorded."
  return "Not fundable; awaiting authoritative settlement."
}

export function StripePayByBankPanel({projectSlug, payments, termsAcknowledged}: {projectSlug: string; payments: PaymentOption[]; termsAcknowledged: boolean}) {
  const [statuses, setStatuses] = useState<StripePayByBankStatus[]>([])
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currencyCode, setCurrencyCode] = useState<"EUR" | "GBP">("GBP")
  const [customerCountry, setCustomerCountry] = useState<"GB" | "FI">("GB")
  useEffect(() => {
    let active = true
    void invokeStripePayByBankStatusBrowser(projectSlug).then((result) => { if (active && result.ok) setStatuses(result.data) })
    return () => { active = false }
  }, [projectSlug])
  const create = async (payment: PaymentOption) => {
    if (!termsAcknowledged) return
    setLoadingId(payment.id); setError(null)
    const result = await invokeStripePayByBankCheckoutBrowser({projectSlug, paymentId: payment.id, currencyCode,
      customerCountry})
    if (result.ok) window.location.assign(result.data.checkoutUrl)
    else { setError(result.error.message); setLoadingId(null) }
  }
  const eligible = payments.filter((payment) => ["draft", "pending", "failed"].includes(payment.statusCode))
  return <Card data-testid="stripe-pay-by-bank-panel" className="border-sky-200 dark:border-sky-900">
    <CardHeader><div className="flex items-start gap-3"><div className="rounded-full bg-sky-100 p-2 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Landmark className="h-5 w-5"/></div><div>
      <CardTitle>Pay by Bank</CardTitle>
      <CardDescription>Authorize a one-time EUR or GBP payment in Stripe-hosted Checkout. A fresh reviewed FX quote converts the recorded USD obligation before Checkout; FundLoop never receives your bank credentials.</CardDescription>
    </div></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p><strong>Sandbox and delayed settlement.</strong> Returning from Checkout does not fund the project. Signed Stripe evidence must prove available custody. UK and Finland are generally available; France, Germany, and Ireland remain private-preview gated. Production remains disabled.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="font-medium">Presentment currency</span>
          <select className="w-full rounded-md border bg-background px-3 py-2" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value as "EUR"|"GBP")}>
            <option value="GBP">GBP</option><option value="EUR">EUR</option>
          </select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Customer bank country</span>
          <select className="w-full rounded-md border bg-background px-3 py-2" value={customerCountry} onChange={(event) => setCustomerCountry(event.target.value as "GB"|"FI")}>
            <option value="GB">United Kingdom (available)</option><option value="FI">Finland (available)</option>
          </select></label>
      </div>
      <p className="text-xs text-slate-500">France, Germany, and Ireland are unavailable unless Stripe enables private preview for the exact merchant account.</p>
      {eligible.length === 0 ? <p className="text-sm text-slate-500">No draft payment is ready for Pay by Bank authorization.</p> : <div className="space-y-2">{eligible.map((payment) => {
        const status = statuses.find((row) => row.paymentId === payment.id)
        const resumable = !status || ["prepared", "checkout_created", "checkout_completed", "processing"].includes(status.status)
        return <div key={payment.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`stripe-pay-by-bank-payment-${payment.id}`}>
          <div><p className="font-medium">Payment #{payment.id} · USD obligation {new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(payment.paymentAmount)}</p>
            <p className="text-xs text-slate-500">{payment.periodStart} to {payment.periodEnd}</p>
            {status ? <div className="mt-2 flex flex-wrap gap-2"><Badge variant={status.availableForPackage ? "default" : "outline"}>{status.status.replaceAll("_", " ")}</Badge>
              <span className="text-xs text-slate-500">{statusDescription(status)}</span></div> : null}</div>
          <Button variant="outline" disabled={!termsAcknowledged || loadingId !== null || !resumable} onClick={() => void create(payment)} data-testid={`stripe-pay-by-bank-create-${payment.id}`}>
            {loadingId === payment.id ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Landmark className="mr-2 h-4 w-4"/>}{!resumable ? "New payment required" : status ? "Resume Pay by Bank" : "Open Pay by Bank Checkout"}
          </Button>
        </div>
      })}</div>}
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
    </CardContent>
  </Card>
}
