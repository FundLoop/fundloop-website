import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { PaymentsConsole } from "@/components/admin/payments-console"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatPaymentFailureSummary,
  loadAdminPaymentOperationsWorkspace,
} from "@/lib/operator/payment-workspaces"

export default async function AdminPaymentsPage() {
  const workspace = await loadAdminPaymentOperationsWorkspace().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "You cannot access internal payment operations.",
  }))

  if ("error" in workspace) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{workspace.error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="container mx-auto flex gap-2 justify-end px-4 pt-12">
        <Button asChild variant="outline">
          <Link href="/admin/payments/observability">Observability</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/payments/reconciliation">Reconciliation</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/payments/deployments">Wallet deployments</Link>
        </Button>
      </div>
      <div className="container mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent payment-flow failures</CardTitle>
            <CardDescription>
              Latest wallet, payment-save, receipt-recording, and admin-confirmation failures captured for operations.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            {workspace.warnings.length > 0 ? (
              <div className="mb-4 space-y-2">
                {workspace.warnings.map((warning) => (
                  <Card
                    key={warning.code}
                    className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                  >
                    <CardContent className="p-3 text-sm">{warning.message}</CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
            {workspace.recentFailures.length === 0 ? (
              <p className="text-sm text-slate-500">No recent failures were captured in the last 7 days.</p>
            ) : (
              <div className="space-y-3">
                {workspace.recentFailures.map((event) => {
                  const summary = formatPaymentFailureSummary(event)

                  return (
                    <div key={event.id} className="rounded-2xl border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium capitalize">{summary.title}</div>
                        <div className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <p className="mt-1 text-slate-700">{summary.message}</p>
                      <p className="mt-1 text-xs text-slate-500">{summary.context}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
      <PaymentsConsole initialPayments={workspace.payments} />
    </div>
  )
}
