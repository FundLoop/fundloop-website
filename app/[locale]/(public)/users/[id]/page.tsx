import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowRight, ExternalLink } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { getPublicUserProfile } from "@/lib/public-discovery"
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
  params: Promise<{ locale: string; id: string }>
}

function formatJoinedDate(locale: string, createdAt: string | null) {
  if (!createdAt) {
    return null
  }

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(createdAt))
}

function getPrimaryLabel(state: ReturnType<typeof getPublicUserCtaState>, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (state === "workspace") {
    return t("cta.openWorkspace")
  }

  if (state === "continue_onboarding") {
    return t("cta.continueOnboarding")
  }

  return t("cta.startProfile")
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: "metadata.userDetail" })
  const profile = await getPublicUserProfile(id)

  return {
    title: profile ? t("title", { name: profile.user.fullName ?? t("fallbackName") }) : t("missingTitle"),
    description: profile ? t("description", { name: profile.user.fullName ?? t("fallbackName") }) : t("missingDescription"),
  }
}

export default async function UserProfilePage({ params }: PageProps) {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: "userProfile" })
  const navigationContext = await getNavigationContext()
  const ctaState = getPublicUserCtaState(navigationContext)
  const profile = await getPublicUserProfile(id)

  if (!profile) {
    notFound()
  }

  return (
    <MarketingPage>
      <MarketingSection className="pt-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
          <Reveal>
            <SectionEyebrow>{t("hero.eyebrow")}</SectionEyebrow>
            <div className="mt-6 flex items-center gap-5">
              <Avatar className="h-24 w-24 border border-[color:var(--marketing-line)]">
                <AvatarImage src={profile.user.avatarUrl ?? "/placeholder.svg?height=96&width=96"} alt={profile.user.fullName ?? t("fallbackName")} />
                <AvatarFallback>{(profile.user.fullName ?? "U").slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-display text-5xl leading-none tracking-[-0.05em] sm:text-6xl">
                  {profile.user.fullName ?? t("fallbackName")}
                </h1>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--marketing-muted)]">
                  {profile.user.projectCount === 1 ? t("hero.singleProject") : t("hero.multiProject", { count: profile.user.projectCount })}
                </p>
              </div>
            </div>
            <SectionBody className="mt-8 max-w-2xl">
              {profile.user.contributionDetails ?? t("hero.defaultContribution")}
            </SectionBody>
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
                  {t("cta.readParticipation")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.82),rgba(126,175,203,0.22))] p-6 dark:bg-[linear-gradient(135deg,rgba(14,22,22,0.92),rgba(126,175,203,0.08))] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("snapshot.eyebrow")}
              </p>
              <div className="mt-6 space-y-5">
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">{t("snapshot.locationLabel")}</p>
                  <p className="mt-2 text-2xl font-semibold">{profile.user.location ?? t("snapshot.locationFallback")}</p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">{t("snapshot.joinedLabel")}</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatJoinedDate(locale, profile.user.createdAt) ?? t("snapshot.joinedFallback")}
                  </p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">{t("snapshot.resultsLabel")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("snapshot.resultsBody")}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("projects.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("projects.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("projects.body")}</SectionBody>
          </Reveal>

          <div className="space-y-6">
            {profile.projects.length === 0 ? (
              <Reveal>
                <div className="border-t border-[color:var(--marketing-line)] py-8">
                  <p className="text-base text-[var(--marketing-muted-strong)]">{t("projects.empty")}</p>
                </div>
              </Reveal>
            ) : (
              profile.projects.map((project, index) => (
                <Reveal key={project.id} delay={index * 45}>
                  <article className="flex flex-col gap-5 border-t border-[color:var(--marketing-line)] py-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border border-[color:var(--marketing-line)]">
                        <AvatarImage src={project.logoUrl ?? "/placeholder.svg?height=56&width=56"} alt={project.name} />
                        <AvatarFallback>{project.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="font-display text-3xl tracking-[-0.04em]">{project.name}</h2>
                        <p className="mt-2 text-sm text-[var(--marketing-muted-strong)]">{t("projects.projectBody")}</p>
                      </div>
                    </div>
                    {project.slug ? (
                      <Button asChild variant="outline" className="rounded-full border-[color:var(--marketing-line)] px-6">
                        <Link href={`/projects/${project.slug}`}>
                          {t("projects.openProject")}
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </article>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </MarketingSection>
    </MarketingPage>
  )
}
