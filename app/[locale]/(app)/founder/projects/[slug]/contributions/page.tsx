import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import {
  findFounderWorkspaceProject,
  getFounderWorkspaceHome,
  type FounderContributionCycle,
  type FounderContributionCycleStatus,
} from "@/lib/workspace/founder-workspace"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type FounderProjectContributionsPageProps = {
  params: Promise<{ locale: string; slug: string }>
}

function formatCurrency(locale: string, value: number | null) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

function statusClass(status: FounderContributionCycleStatus) {
  if (status === "confirmed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
  }

  if (status === "awaiting_confirmation") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200"
  }

  if (status === "needs_submission") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
  }

  return "border-[color:var(--surface-border-strong)] bg-[var(--surface-panel)] text-[var(--text-muted)]"
}

export default async function FounderProjectContributionsPage({ params }: FounderProjectContributionsPageProps) {
  const { locale, slug } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("founderContributions")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const home = await getFounderWorkspaceHome(navigationContext)
  const project = findFounderWorkspaceProject(home, slug)

  if (!project) {
    notFound()
  }

  const projectSlug = project.slug ?? slug
  const latestCycle = project.contributionCycles[0] ?? null
  const hasActionableCycle = project.contributionCycles.some((cycle) => cycle.status !== "confirmed")

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow-panel)]">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.25fr_0.75fr] lg:p-10">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)] md:text-5xl">
              {t("title", { project: project.name })}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/projects/${projectSlug}/payments`}
                className="rounded-full bg-[var(--interactive-primary)] px-5 py-3 text-sm font-semibold text-[var(--interactive-primary-foreground)] shadow-[var(--surface-shadow-soft)]"
              >
                {t("primaryCta")}
              </Link>
              <Link href={`/founder/projects/${projectSlug}/attribution`} className="rounded-full border border-[color:var(--surface-border)] px-5 py-3 text-sm font-semibold text-[var(--text-strong)]">
                {t("secondaryCta")}
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <SummaryMetric label={t("summary.latest")} value={latestCycle?.cycleKey ?? t("none")} />
            <SummaryMetric label={t("summary.open")} value={String(project.contributionCycles.filter((cycle) => cycle.status !== "confirmed").length)} />
            <SummaryMetric label={t("summary.contribution")} value={formatCurrency(locale, project.payments.totalContributionAmount)} />
          </div>
        </div>
      </section>

      {home.warnings.length > 0 ? (
        <section className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-100">
          <p className="font-semibold">{t("warnings.title")}</p>
          <p className="mt-2">{t("warnings.body")}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <ReadinessCard
          title={t("readiness.setup.title")}
          description={project.setup.isReady ? t("readiness.setup.ready") : t("readiness.setup.needsWork")}
          state={project.setup.isReady ? t("ready") : t("needsWork")}
          ready={project.setup.isReady}
        />
        <ReadinessCard
          title={t("readiness.route.title")}
          description={project.setup.enabledPaymentMethodCount > 0 ? t("readiness.route.ready") : t("readiness.route.needsWork")}
          state={String(project.setup.enabledPaymentMethodCount)}
          ready={project.setup.enabledPaymentMethodCount > 0}
        />
        <ReadinessCard
          title={t("readiness.attribution.title")}
          description={project.attribution.datasetCount > 0 ? t("readiness.attribution.ready") : t("readiness.attribution.needsWork")}
          state={project.attribution.latestDatasetMonth ?? t("none")}
          ready={project.attribution.datasetCount > 0}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card className="bg-[var(--surface-panel-strong)]">
          <CardHeader>
            <CardTitle>{t("cycles.title")}</CardTitle>
            <CardDescription>{t("cycles.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {project.contributionCycles.length === 0 ? (
              <div className="rounded-[var(--radius-xl)] border border-dashed border-[color:var(--surface-border-strong)] p-6">
                <p className="text-sm font-semibold text-[var(--text-strong)]">{t("empty.title")}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t("empty.body")}</p>
                <Link href={`/projects/${projectSlug}/payments`} className="mt-4 inline-block text-sm font-semibold text-[var(--interactive-primary)]">
                  {t("empty.cta")}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {project.contributionCycles.map((cycle) => (
                  <CycleRow
                    key={cycle.cycleKey}
                    cycle={cycle}
                    locale={locale}
                    label={t(`status.${cycle.status}`)}
                    labels={{
                      draft: t("cycleMetrics.draft"),
                      pending: t("cycleMetrics.pending"),
                      awaiting: t("cycleMetrics.awaiting"),
                      confirmed: t("cycleMetrics.confirmed"),
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)]">
          <CardHeader>
            <CardTitle>{t("next.title")}</CardTitle>
            <CardDescription>{hasActionableCycle ? t("next.actionable") : t("next.clear")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[var(--text-muted)]">
            <Step number="1" title={t("next.steps.review")} />
            <Step number="2" title={t("next.steps.route")} />
            <Step number="3" title={t("next.steps.submit")} />
            <Step number="4" title={t("next.steps.verify")} />
            <div className="flex flex-col gap-3 pt-2">
              <Link href={`/projects/${projectSlug}/payments`} className="text-sm font-semibold text-[var(--interactive-primary)]">
                {t("links.payments")}
              </Link>
              <Link href={`/founder/projects/${projectSlug}/attribution`} className="text-sm font-semibold text-[var(--interactive-primary)]">
                {t("links.attribution")}
              </Link>
              <Link href={`/founder/projects/${projectSlug}`} className="text-sm font-semibold text-[var(--interactive-primary)]">
                {t("links.projectHome")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{value}</p>
    </div>
  )
}

function ReadinessCard({ title, description, state, ready }: { title: string; description: string; state: string; ready: boolean }) {
  return (
    <Card className="bg-[var(--surface-panel-strong)]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge
            variant="outline"
            className={
              ready
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
            }
          >
            {state}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function CycleRow({
  cycle,
  locale,
  label,
  labels,
}: {
  cycle: FounderContributionCycle
  locale: string
  label: string
  labels: { draft: string; pending: string; awaiting: string; confirmed: string }
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-[var(--text-strong)]">{cycle.cycleKey}</h3>
            <Badge variant="outline" className={cn("capitalize", statusClass(cycle.status))}>
              {label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{cycle.periodLabel}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-lg font-semibold text-[var(--text-strong)]">{formatCurrency(locale, cycle.contributionAmount)}</p>
          <p className="text-sm text-[var(--text-muted)]">{formatCurrency(locale, cycle.revenue)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Mini label={labels.draft} value={String(cycle.draftCount)} />
        <Mini label={labels.pending} value={String(cycle.pendingCount)} />
        <Mini label={labels.awaiting} value={String(cycle.awaitingConfirmationCount)} />
        <Mini label={labels.confirmed} value={String(cycle.confirmedCount)} />
      </div>
    </div>
  )
}

function Step({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--interactive-primary)]/10 text-xs font-semibold text-[var(--interactive-primary)]">
        {number}
      </span>
      <span className="pt-1">{title}</span>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{value}</p>
    </div>
  )
}
