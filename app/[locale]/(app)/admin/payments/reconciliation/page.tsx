import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ReconciliationRunButton } from "@/components/admin/reconciliation-run-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listReconciliationQueue } from "@/lib/onchain/payment-reconciliation"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

function getSubmissionBadge(status: string) {
  switch (status) {
    case "submitted":
      return <Badge variant="outline">Submitted</Badge>
    case "confirming":
      return <Badge variant="secondary">Confirming</Badge>
    case "confirmed":
      return <Badge>Confirmed</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default async function AdminPaymentsReconciliationPage() {
  await requireInternalAdminActor()

  const queue = await listReconciliationQueue(50)
  const supabase = getAdminSupabaseClient()
  const projectIds = Array.from(new Set(queue.map((entry) => entry.project_id)))
  const paymentIds = Array.from(new Set(queue.map((entry) => entry.payment_id).filter((value): value is number => value !== null)))

  const [{ data: projects }, { data: payments }] = await Promise.all([
    projectIds.length > 0
      ? supabase.from("projects").select("id, name, slug").in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    paymentIds.length > 0
      ? supabase
          .from("payments")
          .select("id, period_end, ref_payment_statuses(name, code)")
          .in("id", paymentIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const projectById = new Map((projects ?? []).map((project) => [project.id, project]))
  const paymentById = new Map((payments ?? []).map((payment) => [payment.id, payment]))
  const unresolvedCount = queue.filter((entry) => entry.status === "submitted" || entry.status === "confirming").length

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/admin/payments">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Payments</span>
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Onchain Reconciliation</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Advance app-recorded crypto submissions from <code>awaiting_confirmation</code> to finalized payment states
            based on verified chain data and confirmation depth.
          </p>
        </div>
        <ReconciliationRunButton label="Run reconciliation now" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tracked submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queue.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unresolvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Latest scope</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Showing the 50 most recent tracked submissions.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submission Queue</CardTitle>
          <CardDescription>
            Replay all unresolved submissions or target a single receipt when operations need a focused backfill.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latest check</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No tracked onchain submissions yet.
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((entry) => {
                  const project = projectById.get(entry.project_id)
                  const payment = entry.payment_id ? paymentById.get(entry.payment_id) : null

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="font-medium">{project?.name ?? `Project #${entry.project_id}`}</div>
                        <div className="text-xs text-slate-500">{project?.slug ?? "No slug"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">Payment #{entry.payment_id ?? "Unknown"}</div>
                        <div className="text-xs text-slate-500">
                          {payment?.period_end ?? "No period"} · {payment?.ref_payment_statuses?.code ?? "unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {entry.chain.display_name} {entry.asset.symbol}
                        </div>
                        <div className="max-w-xs break-all text-xs text-slate-500">{entry.tx_hash}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getSubmissionBadge(entry.status)}
                          <p className="max-w-xs text-xs text-slate-500">
                            {entry.confirmation_count}/{entry.confirmation_depth} confirmations
                          </p>
                          {entry.failure_reason ? (
                            <p className="max-w-xs text-xs text-rose-600">{entry.failure_reason}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {entry.last_checked_at ?? "Not checked yet"}
                      </TableCell>
                      <TableCell className="text-right">
                        <ReconciliationRunButton
                          label="Replay"
                          submissionId={entry.id}
                          variant="outline"
                          size="sm"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
