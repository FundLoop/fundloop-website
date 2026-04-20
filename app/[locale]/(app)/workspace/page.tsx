import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowUpRight, BadgeCheck, CircleDollarSign, Compass, ShieldAlert, ShieldCheck, Sparkles, UsersRound } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { isResolvedCubidIdentityStatus } from "@/lib/cubid/types"
import { getNavigationContext } from "@/lib/navigation-context"
import { getUserWorkspaceHome } from "@/lib/workspace/user-workspace"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type WorkspacePageProps = {
  params: Promise<{ locale: string }>
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(locale: string, value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("workspace")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const workspace = await getUserWorkspaceHome(navigationContext)
  const cubidStatus = workspace.profileStatus.cubidStatus
  const CubidStatusIcon = cubidStatus === "verified" ? BadgeCheck : cubidStatus === "linked" ? ShieldCheck : ShieldAlert
  const cubidToneClassName =
    cubidStatus === "verified"
      ? "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100"
      : cubidStatus === "linked"
        ? "border-cyan-200 bg-cyan-50/80 text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-100"
        : "border-amber-200 bg-amber-50/85 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
  const latestResultDate = formatDate(locale, workspace.results.latest?.publishedAt ?? null)
  const hasResolvedIdentity = isResolvedCubidIdentityStatus(cubidStatus)
  const cubidPassportHref = new URL("/", navigationContext.cubidPassportOrigin ?? "https://passport.cubid.me").toString()
  const primaryActions = [
    {
      href: "/workspace/account",
      label: t("actions.account"),
      description: t("actions.accountDescription"),
    },
    {
      href: "/projects",
      label: t("actions.discover"),
      description: t("actions.discoverDescription"),
    },
    {
      href: workspace.results.detailHref,
      label: t("actions.results"),
      description: t("actions.resultsDescription"),
    },
  ]

  if (navigationContext.hasFounderAccess) {
    primaryActions.push({
      href: "/founder",
      label: t("actions.founder"),
      description: t("actions.founderDescription"),
    })
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[calc(var(--radius-2xl)+0.35rem)] border border-[color:var(--surface-border)] bg-[radial-gradient(circle_at_top_left,var(--interactive-secondary),transparent_34%),linear-gradient(135deg,var(--surface-panel-strong),var(--surface-panel))] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="max-w-3xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
          <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)] md:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
            <p className="text-sm font-medium text-[var(--text-muted)]">{t("stats.projects")}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{workspace.participation.joinedProjectCount}</p>
          </div>
          <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
            <p className="text-sm font-medium text-[var(--text-muted)]">{t("stats.results")}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{workspace.results.resultCount}</p>
          </div>
          <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
            <p className="text-sm font-medium text-[var(--text-muted)]">{t("stats.totalAllocation")}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">
              {formatCurrency(locale, workspace.results.totalAllocationUsd)}
            </p>
          </div>
        </div>
      </section>

      {workspace.warnings.length > 0 ? (
        <section className="rounded-3xl border border-amber-300/70 bg-amber-50/80 p-5 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
          <p className="font-semibold">{t("warnings.title")}</p>
          <p>{t("warnings.body")}</p>
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className={`shadow-[var(--surface-shadow-panel)] ${cubidToneClassName}`}>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CubidStatusIcon className="h-5 w-5" />
                <CardTitle>{t("identity.title")}</CardTitle>
              </div>
              <Badge variant="outline" className="border-current/30 text-current">
                {t(`identity.status.${cubidStatus}`)}
              </Badge>
            </div>
            <CardDescription className="text-current/75">{t(`identity.body.${cubidStatus}`)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-current/15 bg-white/35 px-4 py-3 text-sm dark:bg-black/10">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-current/65">{t("identity.signedIn")}</p>
              <p className="mt-1 font-medium">{workspace.profileStatus.signedInEmail ?? t("identity.unknownEmail")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant={hasResolvedIdentity ? "outline" : "default"}>
                <Link href="/workspace/account">{t("identity.accountCta")}</Link>
              </Button>
              <Button asChild variant="outline">
                <a href={cubidPassportHref} target="_blank" rel="noreferrer">
                  {t("identity.passportCta")}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>{t("completion.title")}</CardTitle>
              <span className="text-2xl font-semibold text-[var(--text-strong)]">{workspace.profileStatus.completionPercent}%</span>
            </div>
            <CardDescription>{t("completion.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={workspace.profileStatus.completionPercent} className="h-2 bg-[var(--surface-border)]" />
            {workspace.profileStatus.missingItems.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {workspace.profileStatus.missingItems.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]"
                  >
                    {item.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">{t("completion.complete")}</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{t("participation.title")}</CardTitle>
            </div>
            <CardDescription>{t("participation.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("participation.joined")}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{workspace.participation.joinedProjectCount}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("participation.favorites")}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{workspace.participation.favoriteProjectCount}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("participation.admin")}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{workspace.participation.founderProjectCount}</p>
              </div>
            </div>
            {workspace.participation.recentProjects.length > 0 ? (
              <div className="space-y-3">
                {workspace.participation.recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={project.slug ? `/projects/${project.slug}` : "/projects"}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4 transition hover:border-[color:var(--surface-border-strong)]"
                  >
                    <span>
                      <span className="block font-semibold text-[var(--text-strong)]">{project.name}</span>
                      <span className="line-clamp-1 text-sm text-[var(--text-muted)]">
                        {project.description ?? t("participation.projectFallback")}
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-[var(--interactive-primary)]" />
                  </Link>
                ))}
              </div>
            ) : workspace.participation.joinedProjectCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--surface-border-strong)] bg-[var(--surface-panel)] p-5">
                <p className="font-semibold text-[var(--text-strong)]">{t("participation.emptyTitle")}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t("participation.emptyBody")}</p>
              </div>
            ) : (
              <p className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5 text-sm leading-6 text-[var(--text-muted)]">
                {t("participation.detailsUnavailable")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CircleDollarSign className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{t("results.title")}</CardTitle>
            </div>
            <CardDescription>{t("results.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {workspace.results.latest ? (
              <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
                <p className="text-sm font-medium text-[var(--text-muted)]">{workspace.results.latest.monthLabel}</p>
                <p className="mt-2 text-4xl font-semibold text-[var(--text-strong)]">
                  {formatCurrency(locale, workspace.results.latest.allocationUsd)}
                </p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {t("results.latestMeta", {
                    score: Math.round(workspace.results.latest.aggregateScore).toLocaleString(locale),
                    date: latestResultDate ?? t("results.pendingDate"),
                  })}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--surface-border-strong)] bg-[var(--surface-panel)] p-5">
                <p className="font-semibold text-[var(--text-strong)]">{t("results.emptyTitle")}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t("results.emptyBody")}</p>
              </div>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href={workspace.results.detailHref}>{t("results.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Compass className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{t("discovery.title")}</CardTitle>
            </div>
            <CardDescription>{t("discovery.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspace.discovery.recommendedProjects.length > 0 ? (
              workspace.discovery.recommendedProjects.map((project) => (
                <Link
                  key={project.id}
                  href={project.slug ? `/projects/${project.slug}` : "/projects"}
                  className="block rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4 transition hover:border-[color:var(--surface-border-strong)]"
                >
                  <span className="font-semibold text-[var(--text-strong)]">{project.name}</span>
                  <span className="mt-1 line-clamp-2 block text-sm leading-6 text-[var(--text-muted)]">
                    {project.description ?? t("discovery.projectFallback")}
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-[color:var(--surface-border-strong)] bg-[var(--surface-panel)] p-5 text-sm leading-6 text-[var(--text-muted)]">
                {t("discovery.empty")}
              </p>
            )}
            <Button asChild className="w-full">
              <Link href="/projects">{t("discovery.cta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{t("actions.title")}</CardTitle>
            </div>
            <CardDescription>{t("actions.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {primaryActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--surface-border-strong)]"
              >
                <span className="font-semibold text-[var(--text-strong)]">{action.label}</span>
                <span className="mt-1 block text-sm leading-6 text-[var(--text-muted)]">{action.description}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
