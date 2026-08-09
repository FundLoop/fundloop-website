"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "@/i18n/navigation"
import { invokeEpochFundedAllocationBrowser } from "@/lib/edge-functions/epoch-funded-allocation"

export function EpochFundedAllocationActions({ cycleKey }: { cycleKey: string }) {
  const router=useRouter()
  const {toast}=useToast()
  const [busy,setBusy]=useState<"lock"|"calculate"|null>(null)

  async function run(action:"lock"|"calculate") {
    setBusy(action)
    const result=await invokeEpochFundedAllocationBrowser({action,cycleKey})
    setBusy(null)
    if(!result.ok){toast({title:"Settled allocation failed",description:result.error.message,variant:"destructive"});return}
    if(result.data.action==="read"){toast({title:"Settled allocation failed",description:"Unexpected read response.",variant:"destructive"});return}
    const description=result.data.action==="calculate"
      ? `Run ${result.data.runId} recorded with result ${result.data.artifact.resultHash.slice(0,12)}…`
      : `Manifest ${result.data.manifestHash.slice(0,12)}… locked without creating a payable.`
    toast({title:result.data.action==="calculate"?"Provisional allocation calculated":"Funded inputs locked",description})
    router.refresh()
  }

  return <div className="flex flex-wrap gap-2">
    <Button type="button" variant="outline" disabled={busy!==null} onClick={()=>run("lock")}>{busy==="lock"?"Locking…":"Lock funded inputs"}</Button>
    <Button type="button" disabled={busy!==null} onClick={()=>run("calculate")}>{busy==="calculate"?"Calculating…":"Calculate provisional redistribution"}</Button>
  </div>
}
