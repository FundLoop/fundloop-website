"use client"

import { useCallback,useEffect,useState } from "react"
import { AlertTriangle,ExternalLink,Landmark,RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { invokeStripeBankTransferIntentCreateBrowser } from "@/lib/edge-functions/stripe-bank-transfer-intent-create"
import { invokeStripeBankTransferStatusBrowser } from "@/lib/edge-functions/stripe-bank-transfer-status"
import type { StripeBankTransferStatus } from "@/lib/stripe/stripe-bank-transfer-contract"

type PaymentOption={id:number;paymentAmount:number;statusCode:string;periodStart:string;periodEnd:string}

export function StripeBankTransferPanel({projectSlug,payments,termsAcknowledged}:{projectSlug:string;payments:PaymentOption[];termsAcknowledged:boolean}) {
  const [statuses,setStatuses]=useState<StripeBankTransferStatus[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [instructions,setInstructions]=useState<{paymentId:number;url:string|null;providerPaymentIntentId:string}|null>(null)
  const refresh=useCallback(async()=>{
    const result=await invokeStripeBankTransferStatusBrowser(projectSlug)
    if(result.ok)setStatuses(result.data)
  },[projectSlug])
  useEffect(()=>{
    let active=true
    void invokeStripeBankTransferStatusBrowser(projectSlug).then((result)=>{
      if(active&&result.ok)setStatuses(result.data)
    })
    return()=>{active=false}
  },[projectSlug])
  const create=async(payment:PaymentOption)=>{
    if(!termsAcknowledged)return
    setLoading(true);setError(null)
    const result=await invokeStripeBankTransferIntentCreateBrowser({projectSlug,paymentId:payment.id,currencyCode:"USD",expectedAmountMinor:String(Math.round(payment.paymentAmount*100))})
    if(result.ok){setInstructions({paymentId:payment.id,url:result.data.hostedInstructionsUrl,providerPaymentIntentId:result.data.providerPaymentIntentId});await refresh()}
    else setError(result.error.message)
    setLoading(false)
  }
  const eligible=payments.filter(payment=>["draft","pending","failed"].includes(payment.statusCode))
  return <Card data-testid="stripe-bank-transfer-panel" className="border-violet-200 dark:border-violet-900">
    <CardHeader><div className="flex items-start gap-3"><div className="rounded-full bg-violet-100 p-2 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Landmark className="h-5 w-5"/></div><div>
      <CardTitle>Stripe bank transfer sandbox</CardTitle>
      <CardDescription>Generate USD push-transfer instructions and track signed settlement evidence. Review-only; no live funds or production posting.</CardDescription>
    </div></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p><strong>CAD remains unavailable.</strong> Stripe currently exposes USD bank-transfer instructions for this integration family, not CAD. CAD fails closed pending provider support.</p></div>
      </div>
      {eligible.length===0?<p className="text-sm text-slate-500">No draft payment is ready for sandbox instructions.</p>:<div className="space-y-2">
        {eligible.map(payment=>{const status=statuses.find(row=>row.paymentId===payment.id);return <div key={payment.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`stripe-payment-${payment.id}`}>
          <div><p className="font-medium">Payment #{payment.id} · {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(payment.paymentAmount)}</p>
            <p className="text-xs text-slate-500">{payment.periodStart} to {payment.periodEnd}</p>
            {status?<div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant={status.availableForShadowClose?"default":"outline"}>{status.status.replaceAll("_"," ")}</Badge><span className="text-xs text-slate-500">{status.availableForShadowClose?"Signed availability is shadow-journaled.":"Pending signed availability evidence."}</span>{status.sweepEvidencePending?<Badge variant="secondary">sweep evidence pending</Badge>:null}</div>:null}
          </div>
          <Button variant="outline" onClick={()=>void create(payment)} disabled={!termsAcknowledged||loading||Boolean(status)} data-testid={`stripe-create-instructions-${payment.id}`}>{loading?<RefreshCw className="mr-2 h-4 w-4 animate-spin"/>:<Landmark className="mr-2 h-4 w-4"/>}{status?"Instructions recorded":"Create USD sandbox instructions"}</Button>
        </div>})}
      </div>}
      {instructions?<div className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900" data-testid="stripe-instructions-result"><p className="font-medium">Sandbox instructions created for payment #{instructions.paymentId}</p><p className="text-xs text-slate-500">Provider intent {instructions.providerPaymentIntentId}; routing details are never stored by FundLoop.</p>{instructions.url?<Button asChild variant="link" className="h-auto px-0"><a href={instructions.url} target="_blank" rel="noreferrer">Open Stripe-hosted instructions <ExternalLink className="ml-1 h-3 w-3"/></a></Button>:<p className="mt-1 text-xs text-amber-700">Stripe did not return a hosted instruction URL. The sandbox payment method may still require Dashboard activation.</p>}</div>:null}
      {error?<p role="alert" className="text-sm text-rose-600">{error}</p>:null}
    </CardContent>
  </Card>
}
