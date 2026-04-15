import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { getPublicUsersDirectoryData } from "@/lib/public-discovery"
import { getPublicUserCtaState, getPublicUserPrimaryHref } from "@/lib/public-user-journey"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  MarketingPage,
  MarketingSection,
  SectionBody,
  SectionEyebrow,
  SectionTitle,
} from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    q?: string
    project?: string
  }>
}

function parseProjectId(value: string | undefined) {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function getPrimaryLabel(state: ReturnType<typeof getPublicUserCtaState>, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (state === "workspace") {
    return t("hero.primaryCtaWorkspace")
  }

  if (state === "continue_onboarding") {
    return t("hero.primaryCtaContinue")
  }

  return t("hero.primaryCtaStart")
}

function formatJoinedDate(locale: string, createdAt: string | null) {
  if (!createdAt) {
    return null
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(new Date(createdAt))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.users" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function UsersPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { q, project } = await searchParams
  const t = await getTranslations({ locale, namespace: "usersDirectory" })
  const navigationContext = await getNavigationContext()
  const ctaState = getPublicUserCtaState(navigationContext)
  const { users, projects } = await getPublicUsersDirectoryData({
    search: q,
    projectId: parseProjectId(project),
  })

  return (
    <MarketingPage>
      <MarketingSection className="pt-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
          <Reveal>
            <SectionEyebrow>{t("hero.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{t("hero.title")}</SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">{t("hero.body")}</SectionBody>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href={getPublicUserPrimaryHref(navigationContext)}>
                  {getPrimaryLabel(ctaState, t)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/participation">
                  {t("hero.secondaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.82),rgba(126,175,203,0.22))] p-6 dark:bg-[linear-gradient(135deg,rgba(14,22,22,0.92),rgba(126,175,203,0.08))] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("context.eyebrow")}
              </p>
              <div className="mt-6 space-y-5">
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{t("context.discoveryTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("context.discoveryBody")}</p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{t("context.identityTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("context.identityBody")}</p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{t("context.resultsTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("context.resultsBody")}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <Reveal>
          <form className="grid gap-4 rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/70 p-5 shadow-[0_16px_50px_rgba(15,23,23,0.08)] dark:bg-white/[0.03] lg:grid-cols-[minmax(0,1fr)_16rem_auto]">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                <Search className="h-4 w-4" />
                {t("filters.searchLabel")}
              </span>
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder={t("filters.searchPlaceholder")}
                className="h-12 w-full rounded-full border border-[color:var(--marketing-line)] bg-transparent px-4 text-sm outline-none transition-colors focus:border-[color:var(--marketing-line-strong)]"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                <SlidersHorizontal className="h-4 w-4" />
                {t("filters.projectLabel")}
              </span>
              <select
                name="project"
                defaultValue={project ?? "all"}
                className="h-12 w-full rounded-full border border-[color:var(--marketing-line)] bg-transparent px-4 text-sm outline-none transition-colors focus:border-[color:var(--marketing-line-strong)]"
              >
                <option value="all">{t("filters.allProjects")}</option>
                {projects.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-3">
              <Button type="submit" className="h-12 rounded-full bg-[var(--marketing-accent)] px-6 text-white hover:bg-[color:var(--marketing-accent)]/92">
                {t("filters.apply")}
              </Button>
              <Button asChild type="button" variant="outline" className="h-12 rounded-full border-[color:var(--marketing-line)] px-6">
                <Link href="/users">{t("filters.clear")}</Link>
              </Button>
            </div>
          </form>
        </Reveal>
      </MarketingSection>

      <MarketingSection>
        <div className="flex flex-col gap-4 border-b border-[color:var(--marketing-line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionEyebrow>{t("directory.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-4xl sm:text-5xl">{t("directory.title")}</SectionTitle>
          </div>
          <p className="text-sm text-[var(--marketing-muted-strong)]">
            {t("directory.count", { count: users.length })}
          </p>
        </div>

        {users.length === 0 ? (
          <Reveal>
            <div className="py-16 text-center">
              <p className="text-lg text-[var(--marketing-muted-strong)]">{t("empty.title")}</p>
              <p className="mt-3 text-sm text-[var(--marketing-muted)]">{t("empty.body")}</p>
            </div>
          </Reveal>
        ) : (
          <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {users.map((user, index) => (
              <Reveal key={user.userId} delay={index * 35}>
                <article className="h-full rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/60 p-6 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border border-[color:var(--marketing-line)]">
                      <AvatarImage src={user.avatarUrl ?? "/placeholder.svg?height=64&width=64"} alt={user.fullName ?? t("card.unnamed")} />
                      <AvatarFallback>{(user.fullName ?? "U").slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                        {user.projectCount === 1 ? t("card.singleProject") : t("card.multiProject", { count: user.projectCount })}
                      </p>
                      <h2 className="mt-2 truncate font-display text-3xl tracking-[-0.04em]">{user.fullName ?? t("card.unnamed")}</h2>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-[var(--marketing-muted-strong)]">
                    {user.contributionDetails ?? t("card.defaultContribution")}
                  </p>

                  <div className="mt-6 grid gap-4 border-t border-[color:var(--marketing-line)] pt-5 sm:grid-cols-2">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                        {t("card.locationLabel")}
                      </p>
                      <p className="mt-2 text-base font-medium text-[var(--marketing-muted-strong)]">
                        {user.location ?? t("card.locationFallback")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                        {t("card.joinedLabel")}
                      </p>
                      <p className="mt-2 text-base font-medium text-[var(--marketing-muted-strong)]">
                        {formatJoinedDate(locale, user.createdAt) ?? t("card.joinedFallback")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button asChild className="rounded-full bg-[var(--marketing-accent)] px-6 text-white hover:bg-[color:var(--marketing-accent)]/92">
                      <Link href={`/users/${user.userId}`}>
                        {t("card.openProfile")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full border-[color:var(--marketing-line)] px-6">
                      <Link href={getPublicUserPrimaryHref(navigationContext)}>{getPrimaryLabel(ctaState, t)}</Link>
                    </Button>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </MarketingSection>
    </MarketingPage>
  )
}
