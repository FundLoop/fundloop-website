"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { invokeMonthlyCyclePayoutIntentsCreateBrowser } from "@/lib/edge-functions/monthly-cycle-payout-intents-create"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type Props = {
  cycleKey: string
  disabled?: boolean
}

export function MonthlyCyclePayoutIntentsButton({ cycleKey, disabled }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isBusy, setIsBusy] = useState(false)

  async function createIntents() {
    setIsBusy(true)
    const result = await invokeMonthlyCyclePayoutIntentsCreateBrowser({
      cycleKey,
      attemptId: globalThis.crypto.randomUUID(),
    })
    setIsBusy(false)

    if (!result.ok) {
      toast({ title: "Payout intent creation failed", description: result.error.message, variant: "destructive" })
      return
    }

    toast({
      title: "Payout intents created",
      description: `${result.data.readyCount} ready and ${result.data.draftCount} missing payout routes.`,
    })
    router.refresh()
  }

  return (
    <Button type="button" onClick={createIntents} disabled={disabled || isBusy}>
      {isBusy ? "Creating payout intents..." : "Create payout intents"}
    </Button>
  )
}
