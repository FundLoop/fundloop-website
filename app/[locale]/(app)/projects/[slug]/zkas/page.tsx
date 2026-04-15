import Link from "next/link"
import { assignProjectZkasAccess, revokeProjectZkasAccess, uploadZkasDataset } from "@/app/actions/zkas-actions"
import { DatasetStatusBadge } from "@/components/zkas/dataset-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  ZKAS_DATASET_CHECKLIST,
  ZKAS_DATASET_DERIVATION_STEPS,
  ZKAS_DATASET_TEMPLATE_CSV,
  ZKAS_DATASET_TEMPLATE_JSON,
  ZKAS_IDENTITY_ARTIFACT_FIELDS,
} from "@/lib/zkas/guide"
import { getProjectAdmins, requireProjectAdmin } from "@/lib/zkas/auth"

function asValidationCounts(summary: unknown) {
  if (!summary || typeof summary !== "object") {
    return { errors: 0, warnings: 0 }
  }

  const issueCounts = (summary as { issueCounts?: { errors?: number; warnings?: number } }).issueCounts
  return {
    errors: issueCounts?.errors ?? 0,
    warnings: issueCounts?.warnings ?? 0,
  }
}

const csvTemplateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(ZKAS_DATASET_TEMPLATE_CSV)}`
const jsonTemplateHref = `data:application/json;charset=utf-8,${encodeURIComponent(ZKAS_DATASET_TEMPLATE_JSON)}`

export const dynamic = "force-dynamic"

export default async function ProjectZkasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { slug } = await params
  const { month: requestedMonth } = await searchParams

  const data = await (async () => {
    const { actor, membership } = await requireProjectAdmin(slug)
    const supabase = getAdminSupabaseClient()
    const [{ project, admins }, { data: datasets }, { data: summaries }] = await Promise.all([
      getProjectAdmins(slug),
      supabase
        .from("zkas_datasets")
        .select("id, month, file_name, row_count, status, created_at, validation_summary")
        .eq("project_id", membership.projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("zkas_run_project_summaries")
        .select("*")
        .eq("project_id", membership.projectId)
        .order("run_id", { ascending: false }),
    ])

    const runIds = Array.from(new Set((summaries ?? []).map((summary) => summary.run_id)))
    let runs: Array<{ id: number; month: string; published_at: string | null }> = []
    if (runIds.length > 0) {
      const { data: runRows, error: runError } = await supabase
        .from("zkas_runs")
        .select("id, month, published_at")
        .in("id", runIds)
        .not("published_at", "is", null)

      if (runError) {
        throw new Error(runError.message)
      }

      runs = runRows ?? []
    }

    const runById = new Map(runs.map((run) => [run.id, run]))
    const publishedSummaries = (summaries ?? []).filter((summary) => runById.has(summary.run_id))
    const availableMonths = publishedSummaries
      .map((summary) => runById.get(summary.run_id)?.month)
      .filter((month): month is string => Boolean(month))
    const selectedMonth = requestedMonth && availableMonths.includes(requestedMonth) ? requestedMonth : availableMonths[0] ?? null
    const selectedSummary =
      publishedSummaries.find((summary) => runById.get(summary.run_id)?.month === selectedMonth) ?? null

    let buckets: Array<{ run_id: number; project_id: number; bucket_key: string; bucket_label: string; user_count: number }> = []
    if (selectedSummary) {
      const { data: bucketRows, error: bucketError } = await supabase
        .from("zkas_run_project_cubid_buckets")
        .select("*")
        .eq("run_id", selectedSummary.run_id)
        .eq("project_id", membership.projectId)
        .order("bucket_key")

      if (bucketError) {
        throw new Error(bucketError.message)
      }

      buckets = bucketRows ?? []
    }

    return {
      actor,
      membership,
      project,
      admins,
      datasets: datasets ?? [],
      canManage: membership.hasZkasAccess,
      availableMonths,
      selectedMonth,
      selectedSummary,
      selectedRun: selectedSummary ? runById.get(selectedSummary.run_id) ?? null : null,
      buckets,
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
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">zkActivitySum</h1>
          <p className="text-slate-600 dark:text-slate-300">
            Manage zkAS managers, dataset submissions, and published outcomes for {data.project.name}.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/projects/${slug}`}>Back to Project</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">zkAS Managers</CardTitle>
          <CardDescription>Only project admins can be elevated to manage zkAS for this project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Manager Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.admins.map((admin) => (
                <TableRow key={admin.participantId}>
                  <TableCell>{admin.name}</TableCell>
                  <TableCell>{admin.email ?? "No email"}</TableCell>
                  <TableCell>{admin.hasZkasAccess ? "zkAS manager" : "Project admin only"}</TableCell>
                  <TableCell className="text-right">
                    <form action={admin.hasZkasAccess ? revokeProjectZkasAccess : assignProjectZkasAccess}>
                      <input type="hidden" name="projectSlug" value={slug} />
                      <input type="hidden" name="participantId" value={admin.participantId} />
                      <Button size="sm" variant={admin.hasZkasAccess ? "outline" : "default"}>
                        {admin.hasZkasAccess ? "Remove Manager" : "Grant Manager"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Dataset Guide</CardTitle>
          <CardDescription>
            This is the canonical derivation and formatting guide. Use these exact field names and derivation rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">How to derive the monthly dataset</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
                {ZKAS_DATASET_DERIVATION_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Submission checklist</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
                {ZKAS_DATASET_CHECKLIST.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Identity artifact compatibility</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Your uploaded app user IDs must match the monthly confidential identity artifact fields below:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                {ZKAS_IDENTITY_ARTIFACT_FIELDS.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Allowed fields</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Required: <code>month</code>, <code>project_id</code>, <code>app_user_id</code>
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Optional: <code>activity_score</code>, <code>activity_count</code>, <code>confidence_weight</code>
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                If you use any optional column, every row in the file must include a numeric value for that column.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href={csvTemplateHref} download="zkas-template.csv">
                  Download CSV Template
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={jsonTemplateHref} download="zkas-template.json">
                  Download JSON Example
                </a>
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="rounded-lg border bg-slate-50 p-4 text-xs dark:bg-slate-950">
                <div className="mb-2 font-semibold">CSV example</div>
                <pre className="overflow-x-auto whitespace-pre-wrap">{ZKAS_DATASET_TEMPLATE_CSV}</pre>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4 text-xs dark:bg-slate-950">
                <div className="mb-2 font-semibold">JSON example</div>
                <pre className="overflow-x-auto whitespace-pre-wrap">{ZKAS_DATASET_TEMPLATE_JSON}</pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Dataset Upload</CardTitle>
          <CardDescription>
            {data.canManage
              ? `Upload one validated dataset per month. Signed in as ${data.actor.email ?? data.actor.userId}.`
              : "This page is visible to project admins, but only assigned zkAS managers can upload datasets or view analytics."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.canManage ? (
            <form action={uploadZkasDataset} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="projectSlug" value={slug} />
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="month">
                  Month
                </label>
                <Input id="month" name="month" type="month" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="format">
                  Format
                </label>
                <select
                  id="format"
                  name="format"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="csv"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="file">
                  Dataset file
                </label>
                <Input id="file" name="file" type="file" required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="note">
                  Note
                </label>
                <Textarea id="note" name="note" placeholder="Optional operator note" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Upload Dataset</Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ask another project admin to grant you zkAS manager access first, then return here to upload and review published analytics.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Submission History</CardTitle>
          <CardDescription>Track validation results, operator approval state, and replacements over time.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.datasets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No datasets uploaded yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.datasets.map((dataset) => {
                  const issueCounts = asValidationCounts(dataset.validation_summary)
                  return (
                    <TableRow key={dataset.id}>
                      <TableCell>{dataset.month}</TableCell>
                      <TableCell>
                        <Link href={`/projects/${slug}/zkas/uploads/${dataset.id}`} className="text-emerald-600 hover:underline">
                          {dataset.file_name}
                        </Link>
                      </TableCell>
                      <TableCell>{dataset.row_count}</TableCell>
                      <TableCell>
                        {issueCounts.errors} errors / {issueCounts.warnings} warnings
                      </TableCell>
                      <TableCell>
                        <DatasetStatusBadge status={dataset.status} />
                      </TableCell>
                      <TableCell>{new Date(dataset.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Published Analytics</CardTitle>
          <CardDescription>
            Aggregate-only project analytics for published runs. Raw TEE outputs and user-level identities stay restricted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!data.canManage ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Project admins without zkAS manager access cannot view published zkAS analytics.
            </p>
          ) : data.availableMonths.length === 0 || !data.selectedSummary || !data.selectedRun ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No published zkAS analytics are available for this project yet.
            </p>
          ) : (
            <>
              <form className="flex flex-wrap items-end gap-3" action={`/projects/${slug}/zkas`} method="get">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="analytics-month">
                    Published month
                  </label>
                  <select
                    id="analytics-month"
                    name="month"
                    defaultValue={data.selectedMonth ?? ""}
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {data.availableMonths.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="outline">
                  View Month
                </Button>
              </form>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Contribution</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    ${Number(data.selectedSummary.contributed_amount_usd).toLocaleString()}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">{data.selectedSummary.active_user_count}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Contribution / Active User</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    ${Number(data.selectedSummary.avg_contribution_per_active_user_usd).toFixed(2)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Users Paid</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">{data.selectedSummary.published_user_count}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Attributed Payout</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    ${Number(data.selectedSummary.attributed_payout_usd).toLocaleString()}
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg border p-4 text-sm text-slate-600 dark:text-slate-300">
                Published on {new Date(data.selectedRun.published_at ?? "").toLocaleString()}.
                Average attributed payout per published user:{" "}
                <span className="font-semibold text-foreground">
                  ${Number(data.selectedSummary.avg_attributed_payout_per_published_user_usd).toFixed(2)}
                </span>
                .
              </div>

              <div>
                <h3 className="mb-3 font-semibold">Cubid Score Buckets</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bucket</TableHead>
                      <TableHead>User Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.buckets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-slate-500">
                          No bucketed Cubid data is available for this month.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.buckets.map((bucket) => (
                        <TableRow key={`${bucket.run_id}-${bucket.bucket_key}`}>
                          <TableCell>{bucket.bucket_label}</TableCell>
                          <TableCell>{bucket.user_count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
