import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { BarChart3, FileText, PiggyBank, UsersRound } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { loadFounderProjectReportingWorkspace } from "@/lib/reporting/monthly-cycle-reports"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EpochCloseSummaryCard } from "@/components/epoch-close-summary-card"
import { loadLatestProjectEpochClose } from "@/lib/monthly-cycles/epoch-close-review"

type PageProps = {
  params: Promise<{ locale: string; slug: string }>
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export default async function FounderProjectReportingPage({ params }: PageProps) {
  const { locale, slug } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("founderReporting")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const managedProject = navigationContext.managedProjects.find((project) => project.slug === slug)
  if (!managedProject) {
    notFound()
  }

  const [reporting, epochClose] = await Promise.all([
    loadFounderProjectReportingWorkspace(managedProject.id, slug),
    loadLatestProjectEpochClose(managedProject.id),
  ])
  if (!reporting) {
    notFound()
  }

  const latestSummary = reporting.summaries[0] ?? null

  return (
    <div className="space-y-8">
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
              {t("title", { project: reporting.project.name })}
            </h1>
            <p className="text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link href={`/founder/projects/${slug}/attribution`}>{t("actions.attribution")}</Link></Button>
            <Button asChild><Link href={`/founder/projects/${slug}/contributions`}>{t("actions.contributions")}</Link></Button>
          </div>
        </div>
      </section>

      {epochClose ? <EpochCloseSummaryCard
        eyebrow="Privacy-safe project close"
        title="Approved funded project totals"
        description="This project-only aggregate contains no user identifiers, Cubid scores, or cross-project membership. The close remains provisional, non-payable, and production-disabled."
        cycleKey={epochClose.cycleKey}
        rootHash={epochClose.rootHash}
        values={[
          {label:"Funded minor",value:epochClose.fundedMinor},{label:"Eligible cohort",value:String(epochClose.cohortCount)},
          {label:"Initial claim USD",value:epochClose.initialClaimExactUsd},{label:"Score-pool contribution USD",value:epochClose.scorePoolContributionExactUsd},
        ]}
      /> : null}

      {reporting.warnings.length > 0 ? (
        <section className="rounded-3xl border border-amber-300/70 bg-amber-50/80 p-5 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
          <p className="font-semibold">{t("warnings.title")}</p>
          <p>{t("warnings.body")}</p>
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4" />{t("stats.reports")}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{reporting.reports.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><UsersRound className="h-4 w-4" />{t("stats.users")}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{latestSummary?.publishedUserCount ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4" />{t("stats.payout")}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{formatCurrency(locale, latestSummary?.attributedPayoutUsd ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><PiggyBank className="h-4 w-4" />{t("stats.credited")}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {formatCurrency(locale, reporting.bookkeeping.reduce((sum, row) => sum + row.creditedUsd, 0))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">{t("stats.notPaid")}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.title")}</CardTitle>
          <CardDescription>{t("reports.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reporting.reports.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--surface-border-strong)] p-5 text-sm text-[var(--text-muted)]">{t("reports.empty")}</p>
          ) : (
            reporting.reports.map((report) => (
              <div key={report.id ?? report.cycleId} className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--text-strong)]">{report.title}</p>
                    <p className="text-sm text-[var(--text-muted)]">{report.summary}</p>
                  </div>
                  <Badge variant="outline">{report.cycleKey}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("summaries.title")}</CardTitle>
          <CardDescription>{t("summaries.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.cycle")}</TableHead>
                <TableHead>{t("table.users")}</TableHead>
                <TableHead>{t("table.contributed")}</TableHead>
                <TableHead>{t("table.payout")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reporting.summaries.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-[var(--text-muted)]">{t("summaries.empty")}</TableCell></TableRow>
              ) : (
                reporting.summaries.map((summary) => (
                  <TableRow key={summary.cycleKey}>
                    <TableCell>{summary.cycleKey}</TableCell>
                    <TableCell>{summary.publishedUserCount} / {summary.activeUserCount}</TableCell>
                    <TableCell>{formatCurrency(locale, summary.contributedAmountUsd)}</TableCell>
                    <TableCell>{formatCurrency(locale, summary.attributedPayoutUsd)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("bookkeeping.title")}</CardTitle>
          <CardDescription>{t("bookkeeping.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.cycle")}</TableHead>
                <TableHead>{t("bookkeeping.credited")}</TableHead>
                <TableHead>{t("bookkeeping.returned")}</TableHead>
                <TableHead>{t("bookkeeping.rows")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reporting.bookkeeping.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-[var(--text-muted)]">{t("bookkeeping.empty")}</TableCell></TableRow>
              ) : (
                reporting.bookkeeping.map((summary) => (
                  <TableRow key={summary.cycleKey}>
                    <TableCell>{summary.cycleKey}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-[var(--text-strong)]">{formatCurrency(locale, summary.creditedUsd)}</div>
                      <div className="text-xs text-[var(--text-muted)]">{t("bookkeeping.notPaid")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-[var(--text-strong)]">{formatCurrency(locale, summary.returnedFuturePoolUsd)}</div>
                      <div className="text-xs text-[var(--text-muted)]">{t("bookkeeping.futurePool")}</div>
                    </TableCell>
                    <TableCell>{t("bookkeeping.rowCounts", { fills: summary.assetFillCount, returned: summary.returnedPoolCount })}</TableCell>
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
