import { EpochProjectPackageEmailButton, EpochProjectPackageValidator } from "@/components/admin/epoch-project-package-controls"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { invokeEpochProjectPackageWorkflowServer } from "@/lib/edge-functions/epoch-project-package-workflow-server"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

export default async function AdminSettlementPackagesPage(){
  const data=await (async()=>{await requireInternalAdminActor();return invokeEpochProjectPackageWorkflowServer({action:"read"})})().catch(error=>({ok:false as const,error:{code:"access_denied",message:error instanceof Error?error.message:"Access denied"}}))
  const packages=data.ok&&data.data.action==="read"?data.data.packages:[]
  return <div className="container mx-auto space-y-8 px-4 py-12">
    <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border bg-[var(--surface-panel)] p-8"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">Provisional settlement control</p><h1 className="mt-3 text-4xl font-semibold">Project package reconciliation</h1><p className="mt-3 max-w-3xl text-[var(--text-muted)]">Rerun package validation before cutoff, inspect immutable manifests, deliver local review email, and keep production value flow disabled.</p></section>
    <EpochProjectPackageValidator/>
    {!data.ok?<Card className="border-amber-300"><CardHeader><CardTitle>Package read unavailable</CardTitle><CardDescription>{data.error.message}</CardDescription></CardHeader></Card>:null}
    <Card><CardHeader><CardTitle>Package versions</CardTitle><CardDescription>Public reports omit all user and Cubid identifiers.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Cycle</TableHead><TableHead>Status</TableHead><TableHead>Pairing</TableHead><TableHead>Users</TableHead><TableHead>Preliminary</TableHead><TableHead>Delivery</TableHead></TableRow></TableHeader><TableBody>
      {packages.length===0?<TableRow><TableCell colSpan={7}>No package versions recorded.</TableCell></TableRow>:packages.map(row=><TableRow key={row.id}><TableCell>{row.projectName}<div className="text-xs text-[var(--text-muted)]">v{row.version} · {row.manifestHash.slice(0,10)}…</div></TableCell><TableCell>{row.intendedCycleKey} → {row.canonicalCycleKey??"pending"}</TableCell><TableCell><Badge variant="outline">{row.status.replaceAll("_"," ")}</Badge></TableCell><TableCell>{row.paymentCount} payment(s) / {row.fundingSourceCount} settled</TableCell><TableCell>{row.eligibleUserCount} eligible / {row.heldUserCount} held</TableCell><TableCell>${Number(row.preliminaryUsd).toLocaleString(undefined,{maximumFractionDigits:2})}</TableCell><TableCell>{row.reconciliationEmailDeliveredAt?new Date(row.reconciliationEmailDeliveredAt).toLocaleString():<EpochProjectPackageEmailButton packageRow={row}/>}</TableCell></TableRow>)}
    </TableBody></Table></CardContent></Card>
  </div>
}
