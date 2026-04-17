import Link from "next/link"
import { publishZkasRun, rejectZkasRunVerification, verifyZkasRun } from "@/app/actions/zkas-actions"
import { RunStatusBadge } from "@/components/zkas/run-status-badge"
import { VerificationStatusBadge } from "@/components/zkas/verification-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireZkasSuperadmin } from "@/lib/zkas/auth"

export default async function ZkasSuperadminRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await (async () => {
    await requireZkasSuperadmin()
    const { id } = await params
    const runId = Number.parseInt(id, 10)
    const supabase = getAdminSupabaseClient()
    const [
      { data: run, error: runError },
      { data: datasets },
      { data: payments },
      { data: attempts },
      { data: results },
      { data: projectSummaries },
      { count: publishedUserCount },
    ] = await Promise.all([
      supabase.from("zkas_runs").select("*").eq("id", runId).single(),
      supabase.from("zkas_run_datasets").select("*").eq("run_id", runId).order("project_id"),
      supabase.from("zkas_run_payments").select("*").eq("run_id", runId).order("payment_id"),
      supabase.from("zkas_run_attempts").select("*").eq("run_id", runId).order("created_at", { ascending: false }),
      supabase.from("zkas_run_results").select("*").eq("run_id", runId).order("allocation_usd", { ascending: false }).limit(25),
      supabase.from("zkas_run_project_summaries").select("*").eq("run_id", runId).order("project_id"),
      supabase.from("zkas_published_user_results").select("*", { count: "exact", head: true }).eq("run_id", runId),
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
      projectSummaries: projectSummaries ?? [],
      publishedUserCount: publishedUserCount ?? 0,
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

  const canVerify = data.run.status === "completed" && !data.run.published_at
  const canPublish = data.run.status === "completed" && data.run.verification_status === "verified" && !data.run.published_at
  const latestAttempt = data.attempts[0] ?? null

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Superadmin Review: Run #{data.run.id}</h1>
          <p className="text-slate-600 dark:text-slate-300">Month {data.run.month}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/superadmin/zkas">Back to zkAS Superadmin</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            Execution: <RunStatusBadge status={data.run.status} />
          </div>
          <div>
            Verification: <VerificationStatusBadge status={data.run.verification_status} />
          </div>
          <div>USD Pool: ${Number(data.run.usd_pool).toLocaleString()}</div>
          <div>Total Allocated: {data.run.total_allocated_usd !== null ? `$${Number(data.run.total_allocated_usd).toLocaleString()}` : "-"}</div>
          <div>Users in run: {data.run.user_count ?? "-"}</div>
          <div>Published users: {data.publishedUserCount}</div>
          <div className="md:col-span-2">Manifest Hash: {data.run.locked_manifest_hash ?? "Not locked yet"}</div>
          <div className="md:col-span-2">Result Hash: {data.run.result_artifact_hash ?? "No result artifact yet"}</div>
          <div className="md:col-span-2">TEE Hash: {data.run.attestation_artifact_hash ?? "No attestation artifact attached"}</div>
          <div className="md:col-span-2">
            Verification Note: {data.run.verification_note ?? "No verification note recorded."}
          </div>
          <div className="md:col-span-2">Publication Note: {data.run.publication_note ?? "No publication note recorded."}</div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Verification Controls</CardTitle>
            <CardDescription>Only completed runs can be verified. Only verified runs can be published.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <form action={verifyZkasRun} className="space-y-3 rounded-lg border p-4">
              <input type="hidden" name="runId" value={data.run.id} />
              <div className="font-semibold">Verify Run</div>
              <Textarea name="verificationNote" placeholder="Optional verification note" />
              <Button disabled={!canVerify}>Mark Verified</Button>
            </form>

            <form action={rejectZkasRunVerification} className="space-y-3 rounded-lg border p-4">
              <input type="hidden" name="runId" value={data.run.id} />
              <div className="font-semibold">Reject Verification</div>
              <Textarea name="verificationNote" placeholder="Explain why this run is rejected" />
              <Button variant="outline" disabled={!canVerify}>
                Mark Rejected
              </Button>
            </form>

            <form action={publishZkasRun} className="space-y-3 rounded-lg border p-4">
              <input type="hidden" name="runId" value={data.run.id} />
              <div className="font-semibold">Publish Verified Results</div>
              <Textarea name="publicationNote" placeholder="Optional publication note" />
              <Button disabled={!canPublish}>Publish to Users</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Artifacts</CardTitle>
            <CardDescription>Private run outputs available only to zkAS superadmins.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.run.result_artifact_path ? (
              <Button asChild className="w-full" variant="outline">
                <Link href={`/admin/superadmin/zkas/runs/${data.run.id}/artifacts/result`}>Download Result Artifact</Link>
              </Button>
            ) : (
              <Button className="w-full" variant="outline" disabled>
                Download Result Artifact
              </Button>
            )}
            {data.run.attestation_artifact_path ? (
              <Button asChild className="w-full" variant="outline">
                <Link href={`/admin/superadmin/zkas/runs/${data.run.id}/artifacts/attestation`}>Download TEE Artifact</Link>
              </Button>
            ) : (
              <Button className="w-full" variant="outline" disabled>
                Download TEE Artifact
              </Button>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Result and attestation downloads are served through a private superadmin route and never exposed publicly.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution Attempts</CardTitle>
          <CardDescription>Latest attempt logs are available inline for review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="rounded-lg border bg-slate-50 p-4 text-xs dark:bg-slate-950">
            <div className="mb-2 font-semibold">Latest Attempt Logs</div>
            <pre className="overflow-x-auto whitespace-pre-wrap">{latestAttempt?.logs ?? "No execution logs available yet."}</pre>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Funding Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.payment_id}</TableCell>
                    <TableCell>{payment.project_id}</TableCell>
                    <TableCell>{payment.period_end}</TableCell>
                    <TableCell>${Number(payment.amount_usd).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Rollups</CardTitle>
            <CardDescription>Aggregate-only project summaries generated at publication time.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Contribution</TableHead>
                  <TableHead>Active Users</TableHead>
                  <TableHead>Paid Users</TableHead>
                  <TableHead>Attributed Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.projectSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500">
                      Project rollups will appear after publication.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.projectSummaries.map((summary) => (
                    <TableRow key={summary.id}>
                      <TableCell>{summary.project_id}</TableCell>
                      <TableCell>${Number(summary.contributed_amount_usd).toLocaleString()}</TableCell>
                      <TableCell>{summary.active_user_count}</TableCell>
                      <TableCell>{summary.published_user_count}</TableCell>
                      <TableCell>${Number(summary.attributed_payout_usd).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Result Rows</CardTitle>
          <CardDescription>Private zkAS output preview for verification only.</CardDescription>
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
