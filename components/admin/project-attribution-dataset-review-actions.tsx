"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { invokeProjectAttributionDatasetReviewBrowser } from "@/lib/edge-functions/project-attribution-dataset-review"

type Props = {
  datasetId: number
  projectName: string
}

function newAttemptId() {
  return globalThis.crypto?.randomUUID?.() ?? `attribution-review-${Date.now()}`
}

export function ProjectAttributionDatasetReviewActions({ datasetId, projectName }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [reason, setReason] = useState("")
  const [isBusy, setIsBusy] = useState(false)
  const trimmedReason = reason.trim()

  async function review(decision: "approved" | "rejected") {
    setIsBusy(true)
    const result = await invokeProjectAttributionDatasetReviewBrowser({
      datasetId,
      decision,
      reason: decision === "rejected" ? trimmedReason : trimmedReason || undefined,
      attemptId: newAttemptId(),
    })
    setIsBusy(false)

    if (!result.ok) {
      toast({
        title: "Attribution review failed",
        description: result.error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: decision === "approved" ? "Attribution dataset approved" : "Attribution dataset rejected",
      description:
        decision === "approved"
          ? `${projectName} is approved for this cycle's MVP attribution inputs.`
          : `${projectName} was rejected and will not feed the cycle calculation.`,
    })
    setReason("")
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Optional approval note, or required rejection reason"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => review("approved")} disabled={isBusy}>
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => review("rejected")}
          disabled={isBusy || trimmedReason.length === 0}
        >
          Reject
        </Button>
      </div>
    </div>
  )
}
