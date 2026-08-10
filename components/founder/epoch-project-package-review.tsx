"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { invokeEpochProjectPackageWorkflowBrowser } from "@/lib/edge-functions/epoch-project-package-workflow"
import type { EpochProjectPackageSummary } from "@/lib/edge-functions/epoch-project-package-contract"

async function evidenceHash(packageRow: EpochProjectPackageSummary, decision: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${packageRow.manifestHash}:${decision}`))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("")
}

export function EpochProjectPackageReview({ packages }: { packages: EpochProjectPackageSummary[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [reason, setReason] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)

  async function decide(packageRow: EpochProjectPackageSummary, action: "approve" | "opt_out") {
    setBusyId(packageRow.id)
    const result = await invokeEpochProjectPackageWorkflowBrowser(action === "approve"
      ? { action, packageId: packageRow.id, evidenceHash: await evidenceHash(packageRow, action) }
      : { action, packageId: packageRow.id, evidenceHash: await evidenceHash(packageRow, action), reason: reason.trim() })
    setBusyId(null)
    if (!result.ok) {
      toast({ title: "Package decision failed", description: result.error.message, variant: "destructive" })
      return
    }
    toast({ title: action === "approve" ? "Package approved" : "Package rolled forward",
      description: action === "approve" ? "The settled package can proceed to lock preparation." : "The project fee remains assessed once; base-fee processing is deferred." })
    setReason("")
    router.refresh()
  }

  if (packages.length === 0) return <p className="rounded-2xl border border-dashed p-6 text-sm text-[var(--text-muted)]">No package versions are available yet.</p>
  return <div className="space-y-5">{packages.map((packageRow) => {
    const decidable = packageRow.status === "frozen" && Boolean(packageRow.reconciliationEmailDeliveredAt)
    return <Card key={packageRow.id}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>{packageRow.canonicalCycleKey ?? packageRow.intendedCycleKey} · version {packageRow.version}</CardTitle>
            <CardDescription>Manifest {packageRow.manifestHash.slice(0, 12)}…</CardDescription></div>
          <Badge variant="outline">{packageRow.status.replaceAll("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Preliminary USD" value={`$${Number(packageRow.preliminaryUsd).toLocaleString(undefined,{maximumFractionDigits:2})}`} />
          <Metric label="Payments" value={String(packageRow.paymentCount)} />
          <Metric label="Settled sources" value={String(packageRow.fundingSourceCount)} />
          <Metric label="Eligible users" value={String(packageRow.eligibleUserCount)} />
          <Metric label="Held users" value={String(packageRow.heldUserCount)} />
          <Metric label="Deadline" value={packageRow.reconciliationDeadlineAt ? new Date(packageRow.reconciliationDeadlineAt).toLocaleDateString() : "Awaiting email"} />
        </div>
        <p className="text-sm text-[var(--text-muted)]">List {packageRow.listStatus}; funding {packageRow.fundingStatus}; compliance {packageRow.complianceStatus}; Cubid {packageRow.cubidStatus}. Preliminary review does not transfer ownership or open payouts.</p>
        {decidable ? <div className="space-y-3 rounded-2xl border p-4">
          <Textarea aria-label="Opt-out reason" value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Required only when opting out and rolling the package forward" />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busyId===packageRow.id} onClick={()=>decide(packageRow,"approve")}>Approve frozen package</Button>
            <Button variant="outline" disabled={busyId===packageRow.id || reason.trim().length===0} onClick={()=>decide(packageRow,"opt_out")}>Opt out and roll forward</Button>
          </div>
        </div> : null}
      </CardContent>
    </Card>
  })}</div>
}

function Metric({label,value}:{label:string;value:string}) {
  return <div><p className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">{label}</p><p className="mt-1 font-semibold">{value}</p></div>
}
