"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "@/i18n/navigation"
import { invokeEpochAllocationCloseBrowser } from "@/lib/edge-functions/epoch-allocation-close"

export function EpochAllocationCloseActions({ cycleKey, initialRootReview = null }: {
  cycleKey: string
  initialRootReview?: { closePackageId: number; rootHash: string } | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [rootReview, setRootReview] = useState<{ closePackageId: number; rootHash: string } | null>(initialRootReview)
  async function approve() {
    setBusy(true)
    const result = await invokeEpochAllocationCloseBrowser({ action: "approve", cycleKey })
    setBusy(false)
    if (!result.ok) {
      toast({ title: "Close package failed", description: result.error.message, variant: "destructive" })
      return
    }
    if (result.data.action !== "approve") return
    setRootReview({ closePackageId: result.data.closePackageId, rootHash: result.data.rootHash })
    toast({ title: "Exact root ready for approval", description: `Review ${result.data.rootHash.slice(0, 12)}… before payout readying.` })
  }
  async function confirmRoot() {
    if (!rootReview) return
    setBusy(true)
    const result = await invokeEpochAllocationCloseBrowser({ action: "confirm_root", cycleKey, ...rootReview })
    setBusy(false)
    if (!result.ok) {
      toast({ title: "Root approval failed", description: result.error.message, variant: "destructive" })
      return
    }
    if (result.data.action !== "confirm_root") return
    toast({ title: "Provisional awards posted", description: `Approved root ${result.data.rootHash.slice(0, 12)}… · payout readying only` })
    setRootReview(null)
    router.refresh()
  }
  if (rootReview) return <div className="space-y-3">
    <p className="break-all rounded-xl border border-[color:var(--surface-border)] p-3 font-mono text-xs" data-testid="epoch-close-root-review">
      Exact close root: {rootReview.rootHash}
    </p>
    <Button type="button" disabled={busy} onClick={confirmRoot}>{busy ? "Approving exact root…" : "Approve exact root and enter payout readying"}</Button>
  </div>
  return <Button type="button" disabled={busy} onClick={approve}>{busy ? "Reproducing and preparing…" : "Reproduce result and prepare close root"}</Button>
}
