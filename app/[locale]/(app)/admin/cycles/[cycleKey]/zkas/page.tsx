import { notFound } from "next/navigation"
import { ArrowLeft, FileCheck2, Sigma, UsersRound } from "lucide-react"
import { MonthlyCycleCalculationPackageButton } from "@/components/admin/monthly-cycle-calculation-package-button"
import { DatasetStatusBadge } from "@/components/zkas/dataset-status-badge"
import { RunStatusBadge } from "@/components/zkas/run-status-badge"
import { VerificationStatusBadge } from "@/components/zkas/verification-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Link } from "@/i18n/navigation"
import {
  loadMonthlyCycleZkasStage,
  type MonthlyCycleZkasIssue,
  type MonthlyCycleZkasPosture,
} from "@/lib/monthly-cycles/monthly-cycle-zkas"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

type PageProps = {
  params: Promise<{ cycleKey: string; locale: string }>
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function postureVariant(posture: MonthlyCycleZkasPosture) {
  if (posture === "published") return "default" as const
  if (posture === "ready_for_packaging" || posture === "calculation_started") return "secondary" as const
  if (posture === "missing_inputs" || posture === "not_locked") return "destructive" as const
  return "outline" as const
}

function IssueList({ issues }: { issues: MonthlyCycleZkasIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No cycle-specific zkAS exceptions are currently visible.</p>
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <div key={`${issue.code}-${issue.description}`} className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[var(--text-strong)]">{issue.title}</h3>
            <Badge variant={issue.severity === "blocker" ? "destructive" : issue.severity === "warning" ? "secondary" : "outline"}>
              {issue.severity}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{issue.description}</p>
          {issue.actionHref ? (
            <Button asChild variant="link" className="mt-2 h-auto p-0 text-sm">
              <Link href={issue.actionHref}>Open related surface</Link>
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default async function AdminCycleZkasPage({ params }: PageProps) {
  const { cycleKey, locale } = await params
  const stage = await (async () => {
    await requireInternalAdminActor()
    return loadMonthlyCycleZkasStage(cycleKey)
  })()

  if (!stage) {
    notFound()
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div>
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/admin/cycles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to monthly cycles
          </Link>
        </Button>
        <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
                Monthly cycle zkAS stage
              </p>
              <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
                {stage.cycle.cycleKey} zkAS
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
                This is the cycle-anchored view of attribution datasets, identity artifacts, runs, and published outputs.
                The older zkAS console still owns the operational actions while calculation packaging is built.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4 lg:min-w-64">
              <Badge variant={postureVariant(stage.posture)}>{stage.postureLabel}</Badge>
              <p className="text-sm text-[var(--text-muted)]">
                {stage.cycle.periodStart} to {stage.cycle.periodEnd}
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Status: {stage.cycle.status}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileCheck2 className="h-4 w-4" />
              Datasets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stage.datasets.approved}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              approved of {stage.datasets.total} · {stage.datasets.rowCount} rows
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <UsersRound className="h-4 w-4" />
              Identity Artifacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stage.identityArtifacts.approved}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              approved of {stage.identityArtifacts.total} · {stage.identityArtifacts.providers.join(", ") || "no providers"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Sigma className="h-4 w-4" />
              Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stage.runs.total}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              latest {stage.runs.latest?.status ?? "none"} · {stage.runs.failed} failed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Published Outputs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatCurrency(locale, stage.outputs.totalPublishedAllocationUsd)}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              {stage.outputs.publishedUserResultCount} users · {stage.outputs.projectSummaryCount} project summaries
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Cycle zkAS readiness</CardTitle>
            <CardDescription>
              These checks describe whether this cycle has the zkAS inputs and outputs expected after prep.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <IssueList issues={stage.issues} />
            {stage.warnings.length > 0 ? (
              <div>
                <h3 className="mb-3 font-semibold text-[var(--text-strong)]">Read warnings</h3>
                <IssueList issues={stage.warnings} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operator handoff</CardTitle>
            <CardDescription>The monthly cycle is the anchor; existing zkAS routes remain the action surfaces for now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MonthlyCycleCalculationPackageButton cycleKey={stage.cycle.cycleKey} disabled={stage.posture !== "ready_for_packaging"} />
            <Button asChild className="w-full">
              <Link href={`/admin/cycles/${stage.cycle.cycleKey}/prep`}>Open prep review</Link>
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link href="/admin/zkas/uploads">Review uploads</Link>
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link href="/admin/zkas/runs">Open run console</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent cycle datasets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stage.datasets.recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-[var(--text-muted)]">
                      No cycle-linked datasets yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  stage.datasets.recent.map((dataset) => (
                    <TableRow key={dataset.id}>
                      <TableCell>Project {dataset.project_id}</TableCell>
                      <TableCell>
                        <Link href={`/admin/zkas/uploads/${dataset.id}`} className="text-emerald-600 hover:underline">
                          {dataset.file_name}
                        </Link>
                      </TableCell>
                      <TableCell>{dataset.row_count}</TableCell>
                      <TableCell>
                        <DatasetStatusBadge status={dataset.status} />
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
            <CardTitle>Recent cycle runs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Allocated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stage.runs.recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-[var(--text-muted)]">
                      No cycle-linked runs yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  stage.runs.recent.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Link href={`/admin/zkas/runs/${run.id}`} className="text-emerald-600 hover:underline">
                          Run {run.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <RunStatusBadge status={run.status} />
                      </TableCell>
                      <TableCell>
                        <VerificationStatusBadge status={run.verification_status} />
                      </TableCell>
                      <TableCell>{formatCurrency(locale, Number(run.total_allocated_usd ?? 0))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
