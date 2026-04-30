import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { getFounderWorkspaceHome, type FounderWorkspaceProject } from "@/lib/workspace/founder-workspace"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type FounderPageProps = {
  params: Promise<{ locale: string }>
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function readinessVariant(project: FounderWorkspaceProject) {
  if (project.setup.isReady) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
}

export default async function FounderPage({ params }: FounderPageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("founderWorkspace")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const home = await getFounderWorkspaceHome(navigationContext)

  if (!home.hasProjects) {
    return (
      <section className="overflow-hidden rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow-panel)]">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.3fr_0.7fr] lg:p-10">
          <div className="max-w-2xl space-y-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)] md:text-5xl">
              {t("empty.title")}
            </h1>
            <p className="text-base leading-7 text-[var(--text-muted)]">{t("empty.body")}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/founders"
                className="rounded-full bg-[var(--interactive-primary)] px-5 py-3 text-sm font-semibold text-[var(--interactive-primary-foreground)] shadow-[var(--surface-shadow-soft)]"
              >
                {t("empty.cta")}
              </Link>
              <Link href="/founder/account" className="rounded-full border border-[color:var(--surface-border)] px-5 py-3 text-sm font-semibold text-[var(--text-strong)]">
                {t("empty.accountCta")}
              </Link>
            </div>
          </div>
          <div className="rounded-[var(--radius-xl)] border border-dashed border-[color:var(--surface-border-strong)] bg-[var(--surface-panel-strong)] p-6">
            <p className="text-sm font-semibold text-[var(--text-strong)]">{t("empty.panelTitle")}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{t("empty.panelBody")}</p>
          </div>
        </div>
      </section>
    )
  }

  const firstProjectWithSlug = home.projects.find((project) => project.slug)
  const identityNeedsAttention = navigationContext.user?.cubidIdentityStatus !== "verified" || (navigationContext.user?.profileCompletionPercent ?? 0) < 100
  const nextActions = [
    {
      title: t("actions.projects.title"),
      description: t("actions.projects.description"),
      href: "/founder/projects",
    },
    {
      title: t("actions.contributions.title"),
      description: t("actions.contributions.description"),
      href: firstProjectWithSlug?.slug ? `/founder/projects/${firstProjectWithSlug.slug}/contributions` : "/founder/projects",
    },
    {
      title: t("actions.attribution.title"),
      description: t("actions.attribution.description"),
      href: firstProjectWithSlug?.slug ? `/projects/${firstProjectWithSlug.slug}/zkas` : "/founder/projects",
    },
  ]

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow-panel)]">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div className="max-w-3xl space-y-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)] md:text-5xl">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile label={t("stats.projects")} value={String(home.totals.projectCount)} />
            <StatTile label={t("stats.ready")} value={String(home.totals.readyProjectCount)} />
            <StatTile label={t("stats.pending")} value={String(home.totals.pendingPaymentCount)} />
            <StatTile label={t("stats.contributed")} value={formatCurrency(locale, home.totals.totalContributionAmount)} />
          </div>
        </div>
      </section>

      {home.warnings.length > 0 ? (
        <section className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-100">
          <p className="font-semibold">{t("warnings.title")}</p>
          <p className="mt-2">{t("warnings.body")}</p>
        </section>
      ) : null}

      {identityNeedsAttention ? (
        <section className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-strong)]">{t("identity.title")}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{t("identity.body")}</p>
            </div>
            <Link href="/founder/account" className="text-sm font-semibold text-[var(--interactive-primary)]">
              {t("identity.cta")}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {nextActions.map((action) => (
          <Link key={action.title} href={action.href} className="group block">
            <Card className="h-full bg-[var(--surface-panel-strong)] transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[color:var(--surface-border-strong)] group-hover:shadow-[var(--surface-shadow-panel)]">
              <CardHeader>
                <CardTitle>{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-semibold text-[var(--interactive-primary)]">{t("open")}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">{t("projectList.eyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{t("projectList.title")}</h2>
          </div>
          <Link href="/founder/projects" className="text-sm font-semibold text-[var(--interactive-primary)]">
            {t("projectList.cta")}
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {home.projects.slice(0, 4).map((project) => (
            <Link
              key={project.id}
              href={project.slug ? `/founder/projects/${project.slug}` : "/founder/projects"}
              className="group rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--surface-border-strong)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-strong)]">{project.name}</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{project.slug ? `/${project.slug}` : t("projectList.slugPending")}</p>
                </div>
                <Badge variant="outline" className={readinessVariant(project)}>
                  {project.setup.isReady ? t("badges.ready") : t("badges.needsSetup")}
                </Badge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MiniMetric label={t("projectList.methods")} value={String(project.setup.enabledPaymentMethodCount)} />
                <MiniMetric label={t("projectList.datasets")} value={String(project.attribution.datasetCount)} />
                <MiniMetric label={t("projectList.members")} value={String(project.team.memberCount)} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-5">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">{value}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{value}</p>
    </div>
  )
}
