import Link from "next/link"
import { RunStatusBadge } from "@/components/zkas/run-status-badge"
import { VerificationStatusBadge } from "@/components/zkas/verification-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireZkasSuperadmin } from "@/lib/zkas/auth"

export default async function ZkasSuperadminPage() {
  const data = await (async () => {
    await requireZkasSuperadmin()
    const supabase = getAdminSupabaseClient()
    const { data: runs, error } = await supabase
      .from("zkas_runs")
      .select("id, month, status, verification_status, published_at, result_artifact_hash, attestation_artifact_hash, user_count, total_allocated_usd")
      .order("created_at", { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    const pendingVerification = (runs ?? []).filter((run) => run.status === "completed" && run.verification_status === "pending")
    const verifiedReadyToPublish = (runs ?? []).filter(
      (run) => run.status === "completed" && run.verification_status === "verified" && !run.published_at,
    )
    const publishedRuns = (runs ?? []).filter((run) => Boolean(run.published_at))

    return {
      runs: runs ?? [],
      pendingVerification,
      verifiedReadyToPublish,
      publishedRuns,
    }
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "You cannot access zkAS superadmin.",
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
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">zkAS Superadmin</h1>
          <p className="text-slate-600 dark:text-slate-300">
            Review private run outputs, verify completed runs, and publish verified results to users.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/superadmin">Back to Super Admin</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/zkas">Operator Console</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.pendingVerification.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Verified, Awaiting Publication</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.verifiedReadyToPublish.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Published Runs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.publishedRuns.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run Review Queue</CardTitle>
          <CardDescription>Completed runs that still require superadmin verification or publication.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Execution</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Artifacts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.runs.filter((run) => run.status === "completed" || run.published_at).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    No completed runs are waiting for superadmin review.
                  </TableCell>
                </TableRow>
              ) : (
                data.runs
                  .filter((run) => run.status === "completed" || Boolean(run.published_at))
                  .map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Link href={`/admin/superadmin/zkas/runs/${run.id}`} className="text-emerald-600 hover:underline">
                          Run #{run.id}
                        </Link>
                      </TableCell>
                      <TableCell>{run.month}</TableCell>
                      <TableCell>
                        <RunStatusBadge status={run.status} />
                      </TableCell>
                      <TableCell>
                        <VerificationStatusBadge status={run.verification_status} />
                      </TableCell>
                      <TableCell>{run.user_count ?? "-"}</TableCell>
                      <TableCell>{run.total_allocated_usd !== null ? `$${Number(run.total_allocated_usd).toLocaleString()}` : "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          <div>Result: {run.result_artifact_hash ? "available" : "missing"}</div>
                          <div>TEE: {run.attestation_artifact_hash ? "available" : "not attached"}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publication History</CardTitle>
          <CardDescription>Published runs remain available to users in-app at `/settings/zkas`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>Superadmin access is currently enforced through the `FUNDLOOP_ZKAS_SUPERADMIN_EMAILS` allowlist.</p>
          <p>Routine dataset review and local/Nitro execution remain in the operator console at `/admin/zkas`.</p>
        </CardContent>
      </Card>
    </div>
  )
}
