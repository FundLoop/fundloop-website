import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ArrowRight, ExternalLink } from "lucide-react"
import { Link as LocaleLink } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { getPublicUserCtaState, getPublicUserPrimaryHref } from "@/lib/public-user-journey"
import { Button } from "@/components/ui/button"
import {
  MarketingPage,
  MarketingSection,
  SectionBody,
  SectionEyebrow,
  SectionTitle,
} from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

type ParticipationItem = {
  step?: string
  title?: string
  body: string
  label?: string
}

type PageProps = {
  params: Promise<{ locale: string }>
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.participation" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function ParticipationPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "participation" })
  const navigationContext = await getNavigationContext()
  const ctaState = getPublicUserCtaState(navigationContext)
  const whyJoinItems = t.raw("whyJoin.items") as ParticipationItem[]
  const discoveryBeats = t.raw("discovery.steps") as ParticipationItem[]
  const identityPoints = t.raw("identity.points") as ParticipationItem[]
  const nextSteps = t.raw("nextSteps.steps") as ParticipationItem[]

  return (
    <MarketingPage>
      <MarketingSection className="pt-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.76fr)]">
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
                <LocaleLink href={getPublicUserPrimaryHref(navigationContext)}>
                  {getPrimaryLabel(ctaState, t)}
                  <ArrowRight className="h-4 w-4" />
                </LocaleLink>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <LocaleLink href="/projects">
                  {t("hero.secondaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </LocaleLink>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.82),rgba(126,175,203,0.22))] p-6 dark:bg-[linear-gradient(135deg,rgba(14,22,22,0.92),rgba(126,175,203,0.08))] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("journey.eyebrow")}
              </p>
              <div className="mt-6 space-y-5">
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{t("journey.profileTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("journey.profileBody")}</p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{t("journey.signalTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("journey.signalBody")}</p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{t("journey.resultsTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("journey.resultsBody")}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("whyJoin.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("whyJoin.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("whyJoin.body")}</SectionBody>
          </Reveal>

          <div className="space-y-8">
            {whyJoinItems.map((item, index) => (
              <Reveal key={item.label} delay={index * 90}>
                <div className="border-t border-[color:var(--marketing-line)] pt-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">{item.label}</p>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--marketing-muted-strong)]">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("discovery.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("discovery.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("discovery.body")}</SectionBody>
          </Reveal>

          <div className="space-y-10">
            {discoveryBeats.map((beat, index) => (
              <Reveal key={beat.step} delay={index * 80}>
                <div className="grid gap-5 border-t border-[color:var(--marketing-line)] pt-6 sm:grid-cols-[5rem_minmax(0,1fr)]">
                  <p className="font-display text-4xl leading-none text-[var(--marketing-accent)]">{beat.step}</p>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{beat.title}</h2>
                    <p className="mt-3 max-w-xl text-base leading-7 text-[var(--marketing-muted-strong)]">{beat.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal>
            <SectionEyebrow>{t("identity.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("identity.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("identity.body")}</SectionBody>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="https://passport.cubid.me" target="_blank" rel="noreferrer">
                  {t("identity.cubidCta")}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                <LocaleLink href="/workspace/reporting">{t("identity.resultsCta")}</LocaleLink>
              </Button>
            </div>
          </Reveal>

          <div className="space-y-8">
            {identityPoints.map((point, index) => (
              <Reveal key={point.label} delay={index * 90}>
                <div className="border-t border-[color:var(--marketing-line)] pt-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">{point.label}</p>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--marketing-muted-strong)]">{point.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("nextSteps.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("nextSteps.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("nextSteps.body")}</SectionBody>
          </Reveal>

          <div className="space-y-10">
            {nextSteps.map((step, index) => (
              <Reveal key={step.step} delay={index * 80}>
                <div className="grid gap-5 border-t border-[color:var(--marketing-line)] pt-6 sm:grid-cols-[5rem_minmax(0,1fr)]">
                  <p className="font-display text-4xl leading-none text-[var(--marketing-accent)]">{step.step}</p>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{step.title}</h2>
                    <p className="mt-3 max-w-xl text-base leading-7 text-[var(--marketing-muted-strong)]">{step.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal>
          <div className="mt-12 rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(126,175,203,0.18))] p-8 dark:bg-[linear-gradient(135deg,rgba(14,22,22,0.94),rgba(126,175,203,0.08))] sm:p-10">
            <SectionEyebrow>{t("closing.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">{t("closing.title")}</SectionTitle>
            <SectionBody className="mt-5 max-w-3xl">{t("closing.body")}</SectionBody>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <LocaleLink href={getPublicUserPrimaryHref(navigationContext)}>
                  {getPrimaryLabel(ctaState, t)}
                  <ArrowRight className="h-4 w-4" />
                </LocaleLink>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <LocaleLink href="/projects">{t("closing.findProject")}</LocaleLink>
              </Button>
            </div>
          </div>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
