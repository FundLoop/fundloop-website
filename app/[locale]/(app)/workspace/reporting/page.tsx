import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { FileText, History, ShieldCheck } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { loadUserReportingWorkspace, type MonthlyReportCard } from "@/lib/reporting/monthly-cycle-reports"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type PageProps = {
  params: Promise<{ locale: string }>
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function formatDate(locale: string, value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date)
}

function ReportCard({
  report,
  locale,
  artifactLabel,
  publicationPendingLabel,
}: {
  report: MonthlyReportCard
  locale: string
  artifactLabel: string
  publicationPendingLabel: string
}) {
  return (
    <Card className="bg-[var(--surface-panel)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{report.title}</CardTitle>
            <CardDescription>{report.cycleKey}</CardDescription>
          </div>
          <Badge variant="outline">{report.cycleStatus}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-[var(--text-muted)]">{report.summary}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-soft)]">
          <span>{formatDate(locale, report.publishedAt) ?? publicationPendingLabel}</span>
          {report.artifact?.path ? <span className="font-mono">{artifactLabel}: {report.artifact.path}</span> : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function WorkspaceReportingPage({ params }: PageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("workspaceReporting")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const reporting = await loadUserReportingWorkspace(navigationContext)

  return (
    <div className="space-y-8">
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="max-w-3xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
          <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">{t("title")}</h1>
          <p className="text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
        </div>
      </section>

      {reporting.warnings.length > 0 ? (
        <section className="rounded-3xl border border-amber-300/70 bg-amber-50/80 p-5 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
          <p className="font-semibold">{t("warnings.title")}</p>
          <p>{t("warnings.body")}</p>
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4" />{t("stats.results")}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{reporting.resultCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" />{t("stats.allocation")}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{formatCurrency(locale, reporting.totalAllocationUsd)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4" />{t("stats.reports")}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{reporting.reports.filter((report) => report.id).length}</CardContent>
        </Card>
      </section>

      <section className="grid gap-5">
        {reporting.reports.length > 0 ? (
          reporting.reports.map((report) => (
            <ReportCard
              key={`${report.cycleId}-${report.id ?? "placeholder"}`}
              report={report}
              locale={locale}
              artifactLabel={t("artifact")}
              publicationPendingLabel={t("publicationPending")}
            />
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("empty.title")}</CardTitle>
              <CardDescription>{t("empty.body")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild><Link href="/workspace/earnings">{t("empty.earningsCta")}</Link></Button>
              <Button asChild variant="outline"><Link href="/projects">{t("empty.projectsCta")}</Link></Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
