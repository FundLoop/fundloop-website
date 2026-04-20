import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { getFounderWorkspaceHome, type FounderWorkspaceProject } from "@/lib/workspace/founder-workspace"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type FounderProjectsPageProps = {
  params: Promise<{ locale: string }>
}

function setupBadgeClass(project: FounderWorkspaceProject) {
  return project.setup.isReady
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
}

export default async function FounderProjectsPage({ params }: FounderProjectsPageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("founderProjects")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const home = await getFounderWorkspaceHome(navigationContext)

  if (!home.hasProjects) {
    return (
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="max-w-2xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
          <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">{t("empty.title")}</h1>
          <p className="text-base leading-7 text-[var(--text-muted)]">{t("empty.body")}</p>
          <Link href="/founders" className="text-sm font-semibold text-[var(--interactive-primary)]">
            {t("empty.cta")}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="max-w-3xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
          <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">{t("title")}</h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
        </div>
      </section>

      {home.warnings.length > 0 ? (
        <section className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-100">
          <p className="font-semibold">{t("warnings.title")}</p>
          <p className="mt-2">{t("warnings.body")}</p>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        {home.projects.map((project) => (
          <Card key={project.id} className="h-full overflow-hidden bg-[var(--surface-panel-strong)]">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.slug ? `/${project.slug}` : t("missingSlug")}</CardDescription>
                </div>
                <Badge variant="outline" className={setupBadgeClass(project)}>
                  {project.setup.isReady ? t("badges.ready") : t("badges.needsSetup")}
                </Badge>
              </div>
              {project.description ? <p className="text-sm leading-6 text-[var(--text-muted)]">{project.description}</p> : null}
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label={t("metrics.methods")} value={String(project.setup.enabledPaymentMethodCount)} />
                <Metric label={t("metrics.pending")} value={String(project.payments.pendingCount + project.payments.awaitingConfirmationCount)} />
                <Metric label={t("metrics.datasets")} value={String(project.attribution.datasetCount)} />
                <Metric label={t("metrics.members")} value={String(project.team.memberCount)} />
              </div>

              {!project.setup.isReady ? (
                <div className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--surface-border-strong)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-strong)]">{t("setup.title")}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {project.setup.missingItems.map((item) => t(`setup.missing.${item}`)).join(", ")}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {project.slug ? (
                  <>
                    <Link href={`/founder/projects/${project.slug}`} className="text-sm font-semibold text-[var(--interactive-primary)]">
                      {t("links.workspace")}
                    </Link>
                    <Link href={`/projects/${project.slug}`} className="text-sm font-semibold text-[var(--interactive-primary)]">
                      {t("links.project")}
                    </Link>
                    <Link href={`/projects/${project.slug}/payments`} className="text-sm font-semibold text-[var(--interactive-primary)]">
                      {t("links.payments")}
                    </Link>
                    <Link href={`/projects/${project.slug}/zkas`} className="text-sm font-semibold text-[var(--interactive-primary)]">
                      {t("links.zkas")}
                    </Link>
                  </>
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">{t("missingSlugAction")}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--text-strong)]">{value}</p>
    </div>
  )
}
