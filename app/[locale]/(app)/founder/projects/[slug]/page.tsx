import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { findFounderWorkspaceProject, getFounderWorkspaceHome } from "@/lib/workspace/founder-workspace"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProjectInvitationPanel } from "@/components/founder/project-invitation-panel"

type FounderProjectHomePageProps = {
  params: Promise<{ locale: string; slug: string }>
}

function formatCurrency(locale: string, value: number | null) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

function formatCommitmentValue(value: number | null, fallback: string) {
  return value === null ? fallback : `${value}%`
}

export default async function FounderProjectHomePage({ params }: FounderProjectHomePageProps) {
  const { locale, slug } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("founderProjectHome")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const home = await getFounderWorkspaceHome(navigationContext)
  const project = findFounderWorkspaceProject(home, slug)

  if (!project) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">{project.name}</h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
              {project.description ?? t("fallbackDescription")}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              project.setup.isReady
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
            }
          >
            {project.setup.isReady ? t("badges.ready") : t("badges.needsSetup")}
          </Badge>
        </div>
      </section>

      {home.warnings.length > 0 ? (
        <section className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-100">
          <p className="font-semibold">{t("warnings.title")}</p>
          <p className="mt-2">{t("warnings.body")}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label={t("stats.revenue")} value={formatCurrency(locale, project.payments.totalRevenue)} />
        <Stat label={t("stats.contribution")} value={formatCurrency(locale, project.payments.totalContributionAmount)} />
        <Stat label={t("stats.datasets")} value={String(project.attribution.datasetCount)} />
        <Stat label={t("stats.members")} value={String(project.team.memberCount)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ProjectInvitationPanel projectSlug={project.slug ?? slug} projectName={project.name} locale={locale} />
        <Card className="bg-[var(--surface-panel-strong)]">
          <CardHeader>
            <CardTitle>{t("payments.title")}</CardTitle>
            <CardDescription>{t("payments.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Mini label={t("payments.pending")} value={String(project.payments.pendingCount + project.payments.awaitingConfirmationCount)} />
              <Mini label={t("payments.confirmed")} value={String(project.payments.confirmedCount)} />
              <Mini label={t("payments.latest")} value={project.payments.latestPeriodLabel ?? t("none")} />
            </div>
            <Link href={`/projects/${project.slug}/payments`} className="text-sm font-semibold text-[var(--interactive-primary)]">
              {t("payments.cta")}
            </Link>
            <Link href={`/founder/projects/${project.slug}/contributions`} className="ml-4 text-sm font-semibold text-[var(--interactive-primary)]">
              {t("payments.workflowCta")}
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)]">
          <CardHeader>
            <CardTitle>{t("setup.title")}</CardTitle>
            <CardDescription>{t("setup.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Mini label={t("setup.methods")} value={String(project.setup.enabledPaymentMethodCount)} />
              <Mini label={t("setup.rate")} value={formatCommitmentValue(project.setup.contributionPercentage, t("none"))} />
              <Mini label={t("setup.currency")} value={project.setup.defaultReportingCurrencyCode} />
              <Mini label={t("setup.defaultMethod")} value={project.setup.hasDefaultPaymentMethod ? t("yes") : t("no")} />
              <Mini label={t("setup.publicProfile")} value={project.isPublic ? t("yes") : t("no")} />
            </div>
            {!project.setup.isReady ? <p className="text-sm text-[var(--text-muted)]">{t("setup.needsWork")}</p> : null}
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)]">
          <CardHeader>
            <CardTitle>{t("attribution.title")}</CardTitle>
            <CardDescription>{t("attribution.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Mini label={t("attribution.latestDataset")} value={project.attribution.latestDatasetMonth ?? t("none")} />
              <Mini label={t("attribution.status")} value={project.attribution.latestDatasetStatus ?? t("none")} />
              <Mini label={t("attribution.rows")} value={String(project.attribution.latestDatasetRowCount ?? 0)} />
            </div>
            <Link href={`/founder/projects/${project.slug}/attribution`} className="text-sm font-semibold text-[var(--interactive-primary)]">
              {t("attribution.cta")}
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)]">
          <CardHeader>
            <CardTitle>{t("growth.title")}</CardTitle>
            <CardDescription>{t("growth.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Mini label={t("growth.latest")} value={project.growth.latestMonthLabel ?? t("none")} />
              <Mini label={t("growth.users")} value={String(project.growth.uniqueUserCount ?? 0)} />
              <Mini label={t("growth.revenue")} value={formatCurrency(locale, project.growth.monthlyRevenue)} />
              <Mini label={t("growth.payout")} value={formatCurrency(locale, project.reporting.attributedPayoutUsd)} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap gap-3 rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
        <Link href={`/projects/${project.slug}`} className="text-sm font-semibold text-[var(--interactive-primary)]">
          {t("links.public")}
        </Link>
        <Link href={`/projects/${project.slug}/payments`} className="text-sm font-semibold text-[var(--interactive-primary)]">
          {t("links.payments")}
        </Link>
        <Link href={`/founder/projects/${project.slug}/contributions`} className="text-sm font-semibold text-[var(--interactive-primary)]">
          {t("links.contributions")}
        </Link>
        <Link href={`/projects/${project.slug}/zkas`} className="text-sm font-semibold text-[var(--interactive-primary)]">
          {t("links.zkas")}
        </Link>
        <Link href={`/founder/projects/${project.slug}/attribution`} className="text-sm font-semibold text-[var(--interactive-primary)]">
          {t("links.attribution")}
        </Link>
        <Link href={`/founder/projects/${project.slug}/reporting`} className="text-sm font-semibold text-[var(--interactive-primary)]">
          {t("links.reporting")}
        </Link>
        <Link href={`/founder/projects/${project.slug}/settlement`} className="text-sm font-semibold text-[var(--interactive-primary)]">
          Settlement package
        </Link>
        <Link href="/founder/projects" className="text-sm font-semibold text-[var(--interactive-primary)]">
          {t("links.allProjects")}
        </Link>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{value}</p>
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
