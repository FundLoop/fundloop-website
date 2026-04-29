"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { invokeMonthlyCycleApprovalBrowser } from "@/lib/edge-functions/monthly-cycle-approval"
import { invokeMonthlyCycleVerificationReviewBrowser } from "@/lib/edge-functions/monthly-cycle-verification-review"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

type Props = {
  cycleKey: string
  canMarkVerified: boolean
  canApprove: boolean
}

export function MonthlyCycleVerificationActions({ cycleKey, canMarkVerified, canApprove }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [note, setNote] = useState("")
  const [isBusy, setIsBusy] = useState(false)

  async function runAction(action: "verified" | "needs_cleanup" | "approval") {
    setIsBusy(true)
    const attemptId = globalThis.crypto.randomUUID()
    const result =
      action === "approval"
        ? await invokeMonthlyCycleApprovalBrowser({ cycleKey, note, attemptId })
        : await invokeMonthlyCycleVerificationReviewBrowser({ cycleKey, decision: action, note, attemptId })
    setIsBusy(false)

    if (!result.ok) {
      toast({ title: "Cycle review failed", description: result.error.message, variant: "destructive" })
      return
    }

    toast({
      title: action === "approval" ? "Cycle approved" : action === "verified" ? "Cycle verified" : "Cleanup requested",
      description: action === "approval" ? "The cycle is approved for distribution." : "The cycle review state was updated.",
    })
    setNote("")
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required review note" />
      <div className="grid gap-3">
        <Button type="button" onClick={() => runAction("verified")} disabled={!canMarkVerified || isBusy || !note.trim()}>
          Mark cycle verified
        </Button>
        <Button type="button" variant="outline" onClick={() => runAction("needs_cleanup")} disabled={isBusy || !note.trim()}>
          Mark cleanup needed
        </Button>
        <Button type="button" variant="secondary" onClick={() => runAction("approval")} disabled={!canApprove || isBusy || !note.trim()}>
          Approve for distribution
        </Button>
      </div>
    </div>
  )
}
