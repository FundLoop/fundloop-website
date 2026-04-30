"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { invokeMonthlyCycleCalculationPackageBrowser } from "@/lib/edge-functions/monthly-cycle-calculation-package"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type MonthlyCycleCalculationPackageButtonProps = {
  cycleKey: string
  disabled?: boolean
}

export function MonthlyCycleCalculationPackageButton({ cycleKey, disabled = false }: MonthlyCycleCalculationPackageButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPackaging, setIsPackaging] = useState(false)

  async function packageCalculationInputs() {
    setIsPackaging(true)
    const result = await invokeMonthlyCycleCalculationPackageBrowser({
      cycleKey,
      attemptId: globalThis.crypto.randomUUID(),
    })
    setIsPackaging(false)

    if (!result.ok) {
      toast({
        title: "Calculation package failed",
        description: result.error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Calculation package created",
      description: `${result.data.cycleKey} is ready as run ${result.data.runId} with manifest ${result.data.runManifestHash.slice(0, 12)}...`,
    })
    router.refresh()
  }

  return (
    <Button type="button" onClick={packageCalculationInputs} disabled={disabled || isPackaging} className="w-full">
      {isPackaging ? "Packaging..." : "Package calculation inputs"}
    </Button>
  )
}
