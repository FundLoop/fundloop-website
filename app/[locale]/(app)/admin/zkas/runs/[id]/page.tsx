import Link from "next/link"
import { dispatchZkasRun, lockZkasRun } from "@/app/actions/zkas-actions"
import { RunStatusBadge } from "@/components/zkas/run-status-badge"
import { VerificationStatusBadge } from "@/components/zkas/verification-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalZkasOperator } from "@/lib/zkas/auth"

export default async function ZkasRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await (async () => {
    await requireInternalZkasOperator()
    const { id } = await params
    const runId = Number.parseInt(id, 10)
    const supabase = getAdminSupabaseClient()
    const [
      { data: run, error: runError },
      { data: datasets },
      { data: payments },
      { data: attempts },
      { data: results },
    ] = await Promise.all([
      supabase.from("zkas_runs").select("*").eq("id", runId).single(),
      supabase.from("zkas_run_datasets").select("*").eq("run_id", runId).order("project_id"),
      supabase.from("zkas_run_payments").select("*").eq("run_id", runId).order("payment_id"),
      supabase.from("zkas_run_attempts").select("*").eq("run_id", runId).order("created_at", { ascending: false }),
      supabase.from("zkas_run_results").select("*").eq("run_id", runId).order("allocation_usd", { ascending: false }).limit(25),
    ])

    if (runError || !run) {
      throw new Error(runError?.message ?? "Run not found")
    }

    return {
      run,
      datasets: datasets ?? [],
      payments: payments ?? [],
      attempts: attempts ?? [],
      results: results ?? [],
    }
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "Could not load this run.",
  }))

  if ("error" in data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Run Not Available</CardTitle>
            <CardDescription>{data.error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Run #{data.run.id}</h1>
            <p className="text-slate-600 dark:text-slate-300">Month {data.run.month}</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/zkas/runs">Back to Runs</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Run Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              Status: <RunStatusBadge status={data.run.status} />
            </div>
            <div>
              Verification: <VerificationStatusBadge status={data.run.verification_status} />
            </div>
            <div>USD Pool: ${Number(data.run.usd_pool).toLocaleString()}</div>
            <div>Users: {data.run.user_count ?? "-"}</div>
            <div>Total Allocated: {data.run.total_allocated_usd !== null ? `$${Number(data.run.total_allocated_usd).toLocaleString()}` : "-"}</div>
            <div>Published At: {data.run.published_at ? new Date(data.run.published_at).toLocaleString() : "Not published"}</div>
            <div className="md:col-span-2">Manifest Hash: {data.run.locked_manifest_hash ?? "Not locked yet"}</div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <form action={lockZkasRun}>
            <input type="hidden" name="runId" value={data.run.id} />
            <Button disabled={data.run.status !== "draft"}>Lock Run</Button>
          </form>
          <form action={dispatchZkasRun}>
            <input type="hidden" name="runId" value={data.run.id} />
            <Button disabled={!["locked", "failed"].includes(data.run.status)}>Run Local Engine</Button>
          </form>
          <Button asChild variant="outline">
            <Link href={`/admin/superadmin/zkas/runs/${data.run.id}`}>Open Superadmin Review</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Datasets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.datasets.map((dataset) => (
                  <TableRow key={dataset.id}>
                    <TableCell>{dataset.dataset_id}</TableCell>
                    <TableCell>{dataset.project_id}</TableCell>
                    <TableCell>{dataset.row_count}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{dataset.file_hash}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Funding Pool Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-slate-500">
                      No confirmed payments were captured for this run.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.payment_id}</TableCell>
                      <TableCell>{payment.period_end}</TableCell>
                      <TableCell>${Number(payment.amount_usd).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Execution Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Failure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.attempts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500">
                      No attempts recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.attempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>{attempt.id}</TableCell>
                      <TableCell>{attempt.mode}</TableCell>
                      <TableCell>{attempt.status}</TableCell>
                      <TableCell>{attempt.started_at ? new Date(attempt.started_at).toLocaleString() : "-"}</TableCell>
                      <TableCell>{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : "-"}</TableCell>
                      <TableCell>{attempt.failure_reason ?? "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Top Result Rows</CardTitle>
            <CardDescription>Showing the highest allocations for quick review.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>zkAS User</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Allocation</TableHead>
                  <TableHead>Apps</TableHead>
                  <TableHead>Projects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500">
                      No run results available yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.results.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.zkas_user_id}</TableCell>
                      <TableCell>{row.eligibility ? "Yes" : "No"}</TableCell>
                      <TableCell>{Number(row.aggregate_score).toLocaleString()}</TableCell>
                      <TableCell>${Number(row.allocation_usd).toLocaleString()}</TableCell>
                      <TableCell>{row.app_count}</TableCell>
                      <TableCell>{row.project_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
  )
}
