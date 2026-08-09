"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { invokeEpochProjectPackageWorkflowBrowser } from "@/lib/edge-functions/epoch-project-package-workflow"
import type { EpochProjectPackageSummary } from "@/lib/edge-functions/epoch-project-package-contract"

export function EpochProjectPackageValidator() {
  const router = useRouter(); const {toast}=useToast()
  const [projectSlug,setProjectSlug]=useState(""); const [cycleKey,setCycleKey]=useState(""); const [busy,setBusy]=useState(false)
  const [kybStatus,setKybStatus]=useState<"pending"|"passed"|"failed">("pending")
  const [kycStatus,setKycStatus]=useState<"pending"|"passed"|"failed">("pending")
  const [sanctionsStatus,setSanctionsStatus]=useState<"pending"|"passed"|"failed">("pending")
  const [complianceEvidenceHash,setComplianceEvidenceHash]=useState("")
  const [complianceValidUntil,setComplianceValidUntil]=useState("")
  const complianceReady=[kybStatus,kycStatus,sanctionsStatus].every(status=>status==="passed")
    && /^[0-9a-f]{64}$/.test(complianceEvidenceHash) && Boolean(complianceValidUntil)
  async function validate() {
    setBusy(true)
    const result=await invokeEpochProjectPackageWorkflowBrowser({action:"validate",projectSlug:projectSlug.trim(),cycleKey:cycleKey.trim(),
      kybStatus,kycStatus,sanctionsStatus,complianceEvidenceHash,
      complianceValidUntil:new Date(complianceValidUntil).toISOString(),maximumCubidScore:"20",cubidTtlHours:24})
    setBusy(false)
    if(!result.ok){toast({title:"Package validation failed",description:result.error.message,variant:"destructive"});return}
    toast({title:"Package version recorded",description:"The paired list, settled funding, compliance, and Cubid snapshot were revalidated."});router.refresh()
  }
  async function finalize(){setBusy(true);const result=await invokeEpochProjectPackageWorkflowBrowser({action:"finalize_silent"});setBusy(false)
    if(!result.ok){toast({title:"Silent approval failed",description:result.error.message,variant:"destructive"});return}
    toast({title:"Deadlines checked",description:`${result.data.action==="finalize_silent"?result.data.finalizedCount:0} package(s) silently approved.`});router.refresh()}
  return <div className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-3">
    <label className="grid gap-1 text-sm">Project slug<Input value={projectSlug} onChange={event=>setProjectSlug(event.target.value)} placeholder="civic-mesh" /></label>
    <label className="grid gap-1 text-sm">Cycle<Input value={cycleKey} onChange={event=>setCycleKey(event.target.value)} placeholder="2026-08" /></label>
    <label className="grid gap-1 text-sm">Compliance valid until<Input type="datetime-local" value={complianceValidUntil} onChange={event=>setComplianceValidUntil(event.target.value)} /></label>
    <ComplianceSelect label="KYB" value={kybStatus} onChange={setKybStatus} />
    <ComplianceSelect label="KYC" value={kycStatus} onChange={setKycStatus} />
    <ComplianceSelect label="Sanctions" value={sanctionsStatus} onChange={setSanctionsStatus} />
    <label className="grid gap-1 text-sm lg:col-span-3">Compliance evidence SHA-256<Input value={complianceEvidenceHash} onChange={event=>setComplianceEvidenceHash(event.target.value.trim().toLowerCase())} placeholder="64 lowercase hexadecimal characters" /></label>
    <p className="text-xs text-[var(--text-muted)] lg:col-span-3">No compliance gate is assumed. An operator must record all three passed results and bind them to reviewed evidence before validation can run.</p>
    <div className="flex flex-wrap gap-2 lg:col-span-3"><Button disabled={busy || !projectSlug.trim() || !/^\d{4}-\d{2}$/.test(cycleKey) || !complianceReady} onClick={validate}>Validate or freeze package</Button>
    <Button disabled={busy} variant="outline" onClick={finalize}>Finalize elapsed deadlines</Button></div>
  </div>
}

function ComplianceSelect({label,value,onChange}:{label:string;value:"pending"|"passed"|"failed";onChange:(value:"pending"|"passed"|"failed")=>void}) {
  return <label className="grid gap-1 text-sm">{label}<select className="h-10 rounded-md border bg-transparent px-3" value={value} onChange={event=>onChange(event.target.value as "pending"|"passed"|"failed")}>
    <option value="pending">Pending</option><option value="passed">Passed</option><option value="failed">Failed</option>
  </select></label>
}

export function EpochProjectPackageEmailButton({packageRow}:{packageRow:EpochProjectPackageSummary}) {
  const router=useRouter();const {toast}=useToast();const [busy,setBusy]=useState(false)
  async function send(){setBusy(true);const result=await invokeEpochProjectPackageWorkflowBrowser({action:"send_reconciliation_email",packageId:packageRow.id,attemptId:crypto.randomUUID()});setBusy(false)
    if(!result.ok){toast({title:"Email delivery failed",description:result.error.message,variant:"destructive"});return}
    toast({title:"Reconciliation email delivered",description:"The accepted delivery timestamp now anchors the project deadline."});router.refresh()}
  return <Button size="sm" variant="outline" disabled={busy || !["review_ready","frozen"].includes(packageRow.status)} onClick={send}>Send local reconciliation email</Button>
}
