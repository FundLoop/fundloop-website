import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowRight, ExternalLink, Eye } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { getPublicProjectDetail } from "@/lib/public-discovery"
import { getPublicUserCtaState, getPublicUserPrimaryHref } from "@/lib/public-user-journey"
import { ProjectVisibilityToggle } from "@/components/project-visibility-toggle"
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
  params: Promise<{ locale: string; slug: string }>
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
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: "metadata.projectDetail" })
  const detail = await getPublicProjectDetail(slug)

  return {
    title: detail ? t("title", { name: detail.project.name }) : t("missingTitle"),
    description: detail ? t("description", { name: detail.project.name }) : t("missingDescription"),
  }
}

export default async function ProjectPage({ params }: PageProps) {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: "projectProfile" })
  const navigationContext = await getNavigationContext()
  const ctaState = getPublicUserCtaState(navigationContext)
  const detail = await getPublicProjectDetail(slug)

  if (!detail) {
    notFound()
  }

  const { project, participants, hasAccess, userRole } = detail

  return (
    <MarketingPage>
      <MarketingSection className="pt-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
          <Reveal>
            <SectionEyebrow>{t("hero.eyebrow")}</SectionEyebrow>
            <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
              <Avatar className="h-24 w-24 border border-[color:var(--marketing-line)]">
                <AvatarImage src={project.logoUrl ?? "/placeholder.svg?height=96&width=96"} alt={project.name} />
                <AvatarFallback>{project.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                  {project.categoryName ?? t("hero.uncategorized")}
                </p>
                <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.05em] sm:text-6xl">
                  {project.name}
                </h1>
                <SectionBody className="mt-6 max-w-3xl">{project.description}</SectionBody>
              </div>
            </div>

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
              {project.website ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <a href={project.website} target="_blank" rel="noreferrer">
                    {t("cta.visitWebsite")}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.82),rgba(182,221,214,0.22))] p-6 dark:bg-[linear-gradient(135deg,rgba(14,22,22,0.92),rgba(182,221,214,0.08))] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("snapshot.eyebrow")}
              </p>
              <div className="mt-6 space-y-5">
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">{t("snapshot.joinedLabel")}</p>
                  <p className="mt-2 text-2xl font-semibold">{formatJoinedDate(locale, project.createdAt) ?? t("snapshot.joinedFallback")}</p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">{t("snapshot.participantsLabel")}</p>
                  <p className="mt-2 text-2xl font-semibold">{participants.length}</p>
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
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("story.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("story.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("story.body")}</SectionBody>
          </Reveal>

          <Reveal>
            <div className="border-t border-[color:var(--marketing-line)] pt-6">
              <p className="max-w-3xl text-base leading-7 text-[var(--marketing-muted-strong)]">
                {project.detailedDescription || t("story.fallbackBody")}
              </p>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.76fr)_minmax(0,1.24fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("people.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("people.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("people.body")}</SectionBody>
          </Reveal>

          <div className="space-y-6">
            {participants.length === 0 ? (
              <Reveal>
                <div className="border-t border-[color:var(--marketing-line)] py-8">
                  <p className="text-base text-[var(--marketing-muted-strong)]">{t("people.empty")}</p>
                </div>
              </Reveal>
            ) : (
              participants.map((participant: (typeof participants)[number], index: number) => (
                <Reveal key={participant.id} delay={index * 40}>
                  <article className="flex flex-col gap-4 border-t border-[color:var(--marketing-line)] py-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border border-[color:var(--marketing-line)]">
                        <AvatarImage src={participant.avatarUrl ?? "/placeholder.svg?height=56&width=56"} alt={participant.name} />
                        <AvatarFallback>{participant.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="font-display text-3xl tracking-[-0.04em]">{participant.name}</h2>
                        <p className="mt-2 text-sm text-[var(--marketing-muted-strong)]">
                          {participant.role === "admin" ? t("people.adminRole") : t("people.memberRole")}
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="outline" className="rounded-full border-[color:var(--marketing-line)] px-6">
                      <Link href={`/users/${participant.id}`}>
                        {t("people.openProfile")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </article>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </MarketingSection>

      {hasAccess && userRole === "admin" ? (
        <MarketingSection className="pt-0">
          <Reveal>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/64 p-6 dark:bg-white/[0.03] sm:p-8">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)]">
                  <Eye className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                    {t("admin.eyebrow")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{t("admin.title")}</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                <ProjectVisibilityToggle projectId={project.id} isPublic={project.isPublic} />
                <Button asChild variant="outline" className="rounded-full border-[color:var(--marketing-line)] px-6">
                  <Link href={`/projects/${project.slug}/payments`}>{t("admin.payments")}</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-[color:var(--marketing-line)] px-6">
                  <Link href={`/projects/${project.slug}/zkas`}>{t("admin.zkas")}</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </MarketingSection>
      ) : null}
    </MarketingPage>
  )
}
