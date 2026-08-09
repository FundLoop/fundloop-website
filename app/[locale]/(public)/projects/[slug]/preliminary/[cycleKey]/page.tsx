import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export default async function PublicPreliminaryPackagePage({params}:{params:Promise<{slug:string;cycleKey:string}>}){
  const {slug,cycleKey}=await params;const supabase=await createServerSupabaseClient()
  const {data:rows}=await supabase.rpc("get_public_epoch_project_package",{p_project_slug:slug,p_cycle_key:cycleKey})
  const data=rows?.[0]??null
  if(!data)notFound()
  return <main className="container mx-auto max-w-4xl space-y-8 px-4 py-16"><section><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">Preliminary project report</p><h1 className="mt-3 text-4xl font-semibold">{data.project_name} · {data.cycle_key}</h1><p className="mt-3 text-[var(--text-muted)]">Exact approved project totals and counts, without user identifiers or cross-project join keys.</p></section><Card><CardHeader><div className="flex justify-between gap-3"><div><CardTitle>${Number(data.preliminary_usd).toLocaleString(undefined,{maximumFractionDigits:2})} preliminary settled value</CardTitle><CardDescription>Manifest {String(data.manifest_hash).slice(0,16)}…</CardDescription></div><Badge variant="outline">{String(data.status).replaceAll("_"," ")}</Badge></div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-4"><Metric label="Cohort" value={data.cohort_count}/><Metric label="Eligible" value={data.eligible_user_count}/><Metric label="Held" value={data.held_user_count}/><Metric label="Funding sources" value={data.funding_source_count}/></CardContent></Card><p className="text-sm text-[var(--text-muted)]">Preliminary reporting is not a payout, payable, escrow balance, or promise of ownership.</p></main>
}
function Metric({label,value}:{label:string;value:number|null}){return <div><p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">{label}</p><p className="mt-1 text-2xl font-semibold">{value ?? 0}</p></div>}
