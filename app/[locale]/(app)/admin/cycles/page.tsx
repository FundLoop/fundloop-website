import { AlertTriangle, CalendarClock, DollarSign, FileText, Sigma } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { MonthlyCycleLockButton } from "@/components/admin/monthly-cycle-lock-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { loadMonthlyCycleAdminOverview, monthlyCycleStatusLabels, type MonthlyCycleStatus } from "@/lib/monthly-cycles"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

type PageProps = {
  params: Promise<{ locale: string }>
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function statusVariant(status: MonthlyCycleStatus) {
  if (status === "open") {
    return "secondary" as const
  }

  if (status === "completed" || status === "reporting") {
    return "default" as const
  }

  return "outline" as const
}

export default async function AdminMonthlyCyclesPage({ params }: PageProps) {
  const { locale } = await params
  const data = await (async () => {
    await requireInternalAdminActor()
    return loadMonthlyCycleAdminOverview()
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "You cannot access monthly cycle operations.",
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
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
              Monthly operating cadence
            </p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
              Monthly Cycles
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
              Operator overview of the economic month records that now anchor payments, onchain reconciliation, zkAS
              datasets, calculation outputs, and later payout/reporting steps.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/admin/payments">Payment console</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/zkas">zkAS console</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/cycles/observability">Cycle events</Link>
            </Button>
          </div>
        </div>
      </section>

      {data.warnings.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Some cycle-linked reads are temporarily unavailable
            </CardTitle>
            <CardDescription className="text-current/75">
              The page is showing safe partial data. Missing sections can be rechecked after the database read recovers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.warnings.map((warning) => (
              <p key={`${warning.scope}-${warning.message}`}>
                <span className="font-semibold">{warning.scope}:</span> {warning.message}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="h-4 w-4" />
              Cycles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.totals.cycleCount}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              {data.totals.openCycleCount} open · {data.totals.lockedOrLaterCycleCount} locked or later
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Contributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatCurrency(locale, data.totals.totalContributionAmount)}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              {data.totals.paymentCount} linked payment rows
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Sigma className="h-4 w-4" />
              zkAS Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.totals.zkasRunCount}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Attached through monthly cycles
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              Operating model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">Lock-ready</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Open cycles can be frozen into manifests
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent cycles</CardTitle>
          <CardDescription>
            One row per economic month. Empty counts are expected for months that have not reached that workflow stage yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Reconciliation</TableHead>
                <TableHead>zkAS</TableHead>
                <TableHead>Reporting</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.cycles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-[var(--text-muted)]">
                    No monthly cycles exist yet. The migration backfill will create cycles once month-bearing payment,
                    project stats, or zkAS rows are present.
                  </TableCell>
                </TableRow>
              ) : (
                data.cycles.map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell>
                      <div className="font-medium">{cycle.cycleKey}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {cycle.periodStart} to {cycle.periodEnd}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(cycle.status)}>{monthlyCycleStatusLabels[cycle.status]}</Badge>
                      {cycle.stageTimestamps.lockedAt ? (
                        <div className="mt-1 text-xs text-[var(--text-muted)]">Locked {new Date(cycle.stageTimestamps.lockedAt).toLocaleString()}</div>
                      ) : null}
                      {cycle.lock.lockedManifestHash ? (
                        <div className="mt-1 font-mono text-[0.68rem] text-[var(--text-soft)]">
                          {cycle.lock.lockedManifestHash.slice(0, 12)}...
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {cycle.contributionSubmissions.submittedCount} of {cycle.contributionSubmissions.expectedProjectCount}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {formatCurrency(locale, cycle.contributionSubmissions.totalCalculatedContributionAmount)} calculated ·{" "}
                        {cycle.contributionSubmissions.missingProjectCount} missing
                      </div>
                      {cycle.contributionSubmissions.missingProjectCount > 0 ? (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-200">
                          {cycle.contributionSubmissions.missingProjects.slice(0, 2).map((project) => project.name).join(", ")}
                          {cycle.contributionSubmissions.missingProjectCount > 2 ? "..." : ""}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatCurrency(locale, cycle.payments.totalContributionAmount)}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {cycle.payments.count} rows · {cycle.payments.confirmedCount} confirmed ·{" "}
                        {cycle.payments.awaitingConfirmationCount} awaiting
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{cycle.reconciliation.submissionCount} submissions</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {cycle.reconciliation.confirmedCount} confirmed · {cycle.reconciliation.unresolvedCount} unresolved ·{" "}
                        {cycle.reconciliation.failedCount} failed
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {cycle.zkas.datasetCount} datasets · {cycle.zkas.runCount} runs
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {cycle.zkas.identityArtifactCount} identity artifacts · latest run {cycle.zkas.latestRunStatus ?? "none"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatCurrency(locale, cycle.zkas.totalPublishedAllocationUsd)}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {cycle.zkas.publishedResultCount} user results · {cycle.zkas.projectSummaryCount} project summaries
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        {cycle.status === "open" ? (
                          <MonthlyCycleLockButton cycleKey={cycle.cycleKey} />
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/cycles/${cycle.cycleKey}/prep`}>Prep review</Link>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/cycles/${cycle.cycleKey}/zkas`}>zkAS stage</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/cycles/${cycle.cycleKey}/verification`}>Result review</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/cycles/${cycle.cycleKey}/payouts`}>Payout work</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/cycles/${cycle.cycleKey}/reporting`}>Reporting</Link>
                        </Button>
                      </div>
                    </TableCell>
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
