"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "@/i18n/navigation"
import { invokeEpochAllocationCloseBrowser } from "@/lib/edge-functions/epoch-allocation-close"

export function EpochAllocationCloseActions({ cycleKey }: { cycleKey: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  async function approve() {
    setBusy(true)
    const result = await invokeEpochAllocationCloseBrowser({ action: "approve", cycleKey })
    setBusy(false)
    if (!result.ok) {
      toast({ title: "Close package failed", description: result.error.message, variant: "destructive" })
      return
    }
    if (result.data.action !== "approve") return
    toast({ title: "Provisional awards posted", description: `Root ${result.data.rootHash.slice(0, 12)}… · payout readying only` })
    router.refresh()
  }
  return <Button type="button" disabled={busy} onClick={approve}>{busy ? "Reproducing and posting…" : "Approve exact result and publish close package"}</Button>
}
