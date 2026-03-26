import Link from "next/link"
import { createZkasRunDraft } from "@/app/actions/zkas-actions"
import { RunStatusBadge } from "@/components/zkas/run-status-badge"
import { VerificationStatusBadge } from "@/components/zkas/verification-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalZkasOperator } from "@/lib/zkas/auth"

export default async function ZkasRunsPage() {
  const data = await (async () => {
    await requireInternalZkasOperator()
    const supabase = getAdminSupabaseClient()
    const [{ data: runs }, { data: datasets }, { data: projects }] = await Promise.all([
      supabase
        .from("zkas_runs")
        .select("id, month, status, verification_status, usd_pool, user_count, created_at, published_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("zkas_datasets")
        .select("id, project_id, month, file_name, row_count")
        .eq("status", "approved")
        .order("month", { ascending: false })
        .order("project_id", { ascending: true }),
      supabase.from("projects").select("id, name"),
    ])

    return {
      runs: runs ?? [],
      datasets: datasets ?? [],
      projectNameById: new Map((projects ?? []).map((project) => [project.id, project.name])),
    }
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "You cannot access this page.",
  }))

  if ("error" in data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
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
            <h1 className="text-3xl font-bold">zkAS Runs</h1>
            <p className="text-slate-600 dark:text-slate-300">Draft, lock, and execute monthly allocation runs for superadmin review.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/zkas">Back to zkAS</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create Draft Run</CardTitle>
            <CardDescription>Select approved datasets for one month.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createZkasRunDraft} className="space-y-4">
              <div className="max-w-sm space-y-2">
                <label className="text-sm font-medium" htmlFor="month">
                  Month
                </label>
                <Input id="month" name="month" type="month" required />
              </div>
              <div className="space-y-3">
                {data.datasets.length === 0 ? (
                  <p className="text-sm text-slate-500">No approved datasets are available.</p>
                ) : (
                  data.datasets.map((dataset) => (
                    <label key={dataset.id} className="flex items-center gap-3 rounded-md border p-3">
                      <input type="checkbox" name="datasetIds" value={dataset.id} />
                      <div>
                        <div className="font-medium">
                          {data.projectNameById.get(dataset.project_id) ?? `Project ${dataset.project_id}`} · {dataset.month}
                        </div>
                        <div className="text-sm text-slate-500">
                          {dataset.file_name} · {dataset.row_count} rows
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
              <Button type="submit" disabled={data.datasets.length === 0}>
                Create Draft Run
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Run History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>USD Pool</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Published</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      No runs created yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Link href={`/admin/zkas/runs/${run.id}`} className="text-emerald-600 hover:underline">
                          {run.id}
                        </Link>
                      </TableCell>
                      <TableCell>{run.month}</TableCell>
                      <TableCell>
                        <RunStatusBadge status={run.status} />
                      </TableCell>
                      <TableCell>
                        <VerificationStatusBadge status={run.verification_status} />
                      </TableCell>
                      <TableCell>${Number(run.usd_pool).toLocaleString()}</TableCell>
                      <TableCell>{run.user_count ?? "-"}</TableCell>
                      <TableCell>{run.published_at ? new Date(run.published_at).toLocaleString() : "-"}</TableCell>
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
