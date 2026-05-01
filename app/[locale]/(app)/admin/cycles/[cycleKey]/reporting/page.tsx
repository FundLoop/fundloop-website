import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { FileArchive, FileText, UsersRound } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { loadOperatorCycleReportingWorkspace } from "@/lib/reporting/monthly-cycle-reports"
import { requireInternalAdminActor } from "@/lib/zkas/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type PageProps = {
  params: Promise<{ locale: string; cycleKey: string }>
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export default async function AdminCycleReportingPage({ params }: PageProps) {
  const { locale, cycleKey } = await params
  const t = await getTranslations("adminCycleReporting")
  const data = await (async () => {
    await requireInternalAdminActor()
    return loadOperatorCycleReportingWorkspace(cycleKey)
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "You cannot access cycle reporting.",
  }))

  if (!data) {
    notFound()
  }

  if ("error" in data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>{t("denied.title")}</CardTitle>
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
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">{t("title", { cycle: data.cycle.cycleKey })}</h1>
            <p className="text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link href={`/admin/cycles/${cycleKey}/payouts`}>{t("actions.payouts")}</Link></Button>
            <Button asChild><Link href={`/admin/cycles/${cycleKey}/verification`}>{t("actions.verification")}</Link></Button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><UsersRound className="h-4 w-4" />{t("stats.users")}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{data.metrics.publishedUserResultCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4" />{t("stats.projects")}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{data.metrics.projectSummaryCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><FileArchive className="h-4 w-4" />{t("stats.artifacts")}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{data.reports.artifactCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("stats.allocation")}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{formatCurrency(locale, data.metrics.totalPublishedAllocationUsd)}</CardContent></Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("canonical.title")}</CardTitle>
            <CardDescription>{t("canonical.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[data.reports.public, data.reports.operator].map((report) =>
              report ? (
                <div key={report.audience} className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{report.title}</p>
                    <Badge>{report.audience}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{report.summary}</p>
                  {report.artifact?.path ? <p className="mt-2 font-mono text-xs text-[var(--text-soft)]">{report.artifact.path}</p> : null}
                </div>
              ) : null,
            )}
            {!data.reports.public && !data.reports.operator ? (
              <p className="rounded-2xl border border-dashed border-[color:var(--surface-border-strong)] p-5 text-sm text-[var(--text-muted)]">{t("canonical.empty")}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("coverage.title")}</CardTitle>
            <CardDescription>{t("coverage.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--surface-border)] p-4">
              <p className="text-sm text-[var(--text-muted)]">{t("coverage.userReports")}</p>
              <p className="mt-2 text-3xl font-semibold">{data.reports.userCount}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--surface-border)] p-4">
              <p className="text-sm text-[var(--text-muted)]">{t("coverage.founderReports")}</p>
              <p className="mt-2 text-3xl font-semibold">{data.reports.founderCount}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
