"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { AlertTriangle, Loader2, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { invokeMonthlyCycleLockBrowser } from "@/lib/edge-functions/monthly-cycle-lock"

type MonthlyCycleLockButtonProps = {
  cycleKey: string
}

export function MonthlyCycleLockButton({ cycleKey }: MonthlyCycleLockButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const trimmedReason = overrideReason.trim()

  function runLock(options?: { overrideUnresolvedOnchain?: boolean; overrideReason?: string }) {
    startTransition(async () => {
      const result = await invokeMonthlyCycleLockBrowser({
        cycleKey,
        overrideUnresolvedOnchain: options?.overrideUnresolvedOnchain,
        overrideReason: options?.overrideReason,
      })

      if (!result.ok) {
        if (result.error.code === "unresolved_onchain_submissions") {
          setOverrideOpen(true)
          toast({
            title: "Cycle lock blocked",
            description: result.error.message,
            variant: "destructive",
          })
          return
        }

        toast({
          title: "Monthly cycle lock failed",
          description: result.error.message,
          variant: "destructive",
        })
        return
      }

      setOverrideOpen(false)
      setOverrideReason("")
      toast({
        title: "Monthly cycle locked",
        description: `${result.data.cycleKey} is locked with manifest ${result.data.lockedManifestHash.slice(0, 12)}...`,
      })
      router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" disabled={pending} onClick={() => runLock()}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
        Lock
      </Button>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Override unresolved onchain submissions?
            </DialogTitle>
            <DialogDescription>
              This locks the economic month even though one or more onchain submissions are not fully reconciled. The
              override reason is written into the immutable lock manifest and audit log. Use this only when an operator
              has reviewed the risk and accepts that later reconciliation may need an explicit correction path.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor={`override-reason-${cycleKey}`} className="text-sm font-medium text-[var(--text-strong)]">
              Required override reason
            </label>
            <Textarea
              id={`override-reason-${cycleKey}`}
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Explain why this month can be locked before every onchain submission is resolved."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOverrideOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || trimmedReason.length === 0}
              onClick={() => runLock({ overrideUnresolvedOnchain: true, overrideReason: trimmedReason })}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              Lock with override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
