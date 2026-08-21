"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { invokeAdminOnchainPaymentReconciliationRunBrowser } from "@/lib/edge-functions/admin-payment-operations"

type ReconciliationRunButtonProps = {
  label: string
  limit?: number
  paymentId?: number
  submissionId?: number
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  className?: string
}

export function ReconciliationRunButton({
  label,
  limit,
  paymentId,
  submissionId,
  variant = "default",
  size = "default",
  className,
}: ReconciliationRunButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await invokeAdminOnchainPaymentReconciliationRunBrowser({
            limit,
            paymentId,
            submissionId,
          })

          if (!result.ok) {
            toast({
              title: "Reconciliation failed",
              description: result.error.message,
              variant: "destructive",
            })
            return
          }

          toast({
            title: "Reconciliation complete",
            description: `Processed ${result.data.processedCount} submissions (${result.data.confirmedCount} confirmed, ${result.data.failedCount} failed).`,
          })
          router.refresh()
        })
      }}
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  )
}
