"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "@/i18n/navigation"
import { invokeEpochFundedAllocationBrowser } from "@/lib/edge-functions/epoch-funded-allocation"

export function EpochFundedAllocationActions({ cycleKey }: { cycleKey: string }) {
  const router=useRouter()
  const {toast}=useToast()
  const [busy,setBusy]=useState<"preview"|"lock"|"calculate"|null>(null)
  const [capMultiple,setCapMultiple]=useState("3.00")
  const [preview,setPreview]=useState<{hash:string;totals:Record<string,string>}|null>(null)

  async function run(action:"preview"|"lock"|"calculate") {
    setBusy(action)
    const result=await invokeEpochFundedAllocationBrowser(action==="preview"
      ? {action,cycleKey,capMultiple}
      : action==="lock"
        ? {action,cycleKey,capMultiple,selectedPreviewHash:preview?.hash ?? ""}
        : {action,cycleKey})
    setBusy(null)
    if(!result.ok){toast({title:"Settled allocation failed",description:result.error.message,variant:"destructive"});return}
    if(result.data.action==="read"){toast({title:"Settled allocation failed",description:"Unexpected read response.",variant:"destructive"});return}
    if(result.data.action==="preview"){
      setPreview({hash:result.data.previewHash,totals:result.data.artifact.totals})
      toast({title:"Cap scenario previewed",description:`${result.data.artifact.capMultiple}× leaves ${result.data.artifact.totals.carryOutResidueMinor ?? "0"} minor units to carry forward.`})
      return
    }
    const description=result.data.action==="calculate"
      ? `Run ${result.data.runId} recorded with result ${result.data.artifact.resultHash.slice(0,12)}…`
      : `Manifest ${result.data.manifestHash.slice(0,12)}… locked without creating a payable.`
    toast({title:result.data.action==="calculate"?"Provisional allocation calculated":"Funded inputs locked",description})
    router.refresh()
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-soft)]">
        Redistribution ceiling multiple
        <input type="number" min="1" max="10" step="0.01" value={capMultiple}
          onChange={(event)=>{setCapMultiple(Number(event.target.value).toFixed(2));setPreview(null)}}
          className="h-10 w-32 rounded-[var(--radius-md)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-3 font-mono text-sm text-[var(--text-strong)]" />
      </label>
      <Button type="button" variant="outline" disabled={busy!==null} onClick={()=>run("preview")}>{busy==="preview"?"Previewing…":"Preview scenario"}</Button>
      <Button type="button" variant="outline" disabled={busy!==null||!preview} onClick={()=>run("lock")}>{busy==="lock"?"Locking…":"Lock selected scenario"}</Button>
      <Button type="button" disabled={busy!==null} onClick={()=>run("calculate")}>{busy==="calculate"?"Calculating…":"Calculate provisional redistribution"}</Button>
    </div>
    {preview ? <p className="text-sm text-[var(--text-muted)]">
      Selected preview <span className="font-mono">{preview.hash.slice(0,12)}…</span>: {preview.totals.finalAllocationMinor ?? "0"} allocated, {preview.totals.harvestedUnclaimedMinor ?? "0"} harvested, {preview.totals.carryOutResidueMinor ?? "0"} carried forward.
    </p> : null}
  </div>
}
