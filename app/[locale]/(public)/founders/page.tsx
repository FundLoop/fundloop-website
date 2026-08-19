import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowRight, BadgeCheck, CalendarRange, Wallet, Waypoints } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/marketing/reveal"
import { JourneyConfidenceBand, type JourneyConfidenceItem } from "@/components/marketing/journey-confidence-band"
import { FounderGrowthMathPanel } from "@/components/marketing/founder-growth-math"
import { FounderRuntimeMoatMathPanel } from "@/components/marketing/founder-runtime-moat-math"
import { FounderCalculatorProvider } from "@/components/marketing/founder-calculator-context"
import {
  MarketingPage,
  MarketingSection,
  SectionBody,
  SectionEyebrow,
  SectionTitle,
} from "@/components/marketing/page-chrome"
import { isValidLocale } from "@/i18n/routing"

type PageProps = {
  params: Promise<{ locale: string }>
}

type Highlight = {
  label: string
  body: string
}

type Pillar = {
  title: string
  body: string
}

type Step = {
  step: string
  title: string
  body: string
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.founders" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function FoundersPage({ params }: PageProps) {
  const { locale } = await params

  if (!isValidLocale(locale)) {
    notFound()
  }

  const t = await getTranslations({ locale, namespace: "founders" })
  const polishT = await getTranslations({ locale, namespace: "journeyPolish.founders" })
  const heroHighlights = t.raw("hero.highlights") as Highlight[]
  const commitmentPillars = t.raw("commitment.pillars") as Pillar[]
  const supportPrinciples = t.raw("supportModel.principles") as Pillar[]
  const supportFlows = t.raw("supportModel.flows") as Pillar[]
  const cadenceSteps = t.raw("cadence.steps") as Step[]
  const identityItems = t.raw("identity.items") as Pillar[]
  const workspaceCards = t.raw("insideFundLoop.cards") as Pillar[]
  const nextSteps = t.raw("start.nextSteps") as Step[]

  return (
    <MarketingPage>
      <FounderCalculatorProvider>
        <MarketingSection className="pb-12 pt-10 sm:pb-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.06fr)_minmax(22rem,0.94fr)]">
          <Reveal>
            <SectionEyebrow>{t("hero.eyebrow")}</SectionEyebrow>
            <h1 className="mt-5 max-w-5xl font-display text-[clamp(3.6rem,9vw,7rem)] leading-[0.92] tracking-[var(--tracking-display)] text-[var(--marketing-ink)]">
              {t("hero.title")}
            </h1>
            <SectionBody className="mt-6 max-w-2xl text-lg">{t("hero.body")}</SectionBody>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/?onboarding=project">
                  {t("hero.primaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/documentation">{t("hero.secondaryCta")}</Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(145deg,rgba(255,248,238,0.86),rgba(244,203,141,0.14))] p-7 shadow-[0_28px_80px_rgba(15,23,23,0.1)] dark:bg-[linear-gradient(145deg,rgba(14,24,23,0.94),rgba(239,139,87,0.08))]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("hero.panelEyebrow")}
              </p>
              <p className="mt-4 max-w-sm font-display text-4xl leading-none tracking-[var(--tracking-display)]">
                {t("hero.panelTitle")}
              </p>
              <div className="mt-8 space-y-5">
                {heroHighlights.map((item, index) => {
                  const Icon = [Waypoints, Wallet, CalendarRange, BadgeCheck][index] ?? BadgeCheck

                  return (
                    <div key={item.label} className="border-t border-[color:var(--marketing-line)] pt-5">
                      <div className="flex items-start gap-4">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-white/55 text-[var(--marketing-accent)] dark:bg-white/[0.03]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em]">{item.label}</p>
                          <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <JourneyConfidenceBand
        eyebrow={polishT("eyebrow")}
        title={polishT("title")}
        body={polishT("body")}
        primaryCta={polishT("primaryCta")}
        primaryHref="/?onboarding=project"
        secondaryCta={polishT("secondaryCta")}
        secondaryHref="/documentation"
        items={polishT.raw("items") as JourneyConfidenceItem[]}
      />

      {/* 3D Founder Dashboard Showcase */}
      <MarketingSection className="pt-8 pb-4">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] border border-[color:var(--marketing-line)] bg-white/70 p-4 shadow-xl dark:border-white/[0.1] dark:bg-white/[0.03] sm:p-6 lg:p-8">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[2rem] bg-neutral-100 dark:bg-neutral-900">
              <Image
                src="/images/marketing/founder-dashboard-dark.jpg"
                alt="FundLoop Founder Shared-Upside Dashboard Mockup"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
            </div>
            <div className="mt-6 flex flex-col justify-between gap-4 px-2 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--marketing-accent)]">Real-Time Allocation & Settlement</p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-[var(--marketing-ink)]">The Founder Shared-Upside Control Plane</h3>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
                Track revenue pledge splits, active user retention surges, dynamic competitor moats, and Base L2 on-chain settlements in one unified operational interface.
              </p>
            </div>
          </div>
        </Reveal>
      </MarketingSection>

      <MarketingSection id="growth-math" className="py-8 sm:py-12">
        <Reveal>
          <FounderGrowthMathPanel />
        </Reveal>
      </MarketingSection>

      <MarketingSection
        id="commitment"
        className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]"
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("commitment.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("commitment.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("commitment.body")}</SectionBody>
          </Reveal>

          <div className="space-y-8">
            <Reveal delay={80}>
              <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.9)] p-8 dark:bg-[rgba(13,21,21,0.9)]">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                  {t("commitment.quoteEyebrow")}
                </p>
                <blockquote className="mt-5 max-w-3xl font-display text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">
                  {t("commitment.quote")}
                </blockquote>
              </div>
            </Reveal>

            <div className="grid gap-5 sm:grid-cols-3">
              {commitmentPillars.map((item, index) => (
                <Reveal key={item.title} delay={index * 80}>
                  <div className="h-full rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.9)] p-6 dark:bg-[rgba(13,21,21,0.9)]">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                      {item.title}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection id="support-model">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal>
            <SectionEyebrow>{t("supportModel.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("supportModel.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("supportModel.body")}</SectionBody>
            <p className="mt-8 max-w-xl border-t border-[color:var(--marketing-line)] pt-5 text-sm leading-6 text-[var(--marketing-muted-strong)]">
              {t("supportModel.note")}
            </p>
          </Reveal>

          <div className="space-y-8">
            <div className="grid gap-5 md:grid-cols-3">
              {supportPrinciples.map((item, index) => (
                <Reveal key={item.title} delay={index * 70}>
                  <div className="border-t border-[color:var(--marketing-line)] pt-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em]">{item.title}</p>
                    <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {supportFlows.map((item, index) => (
                <Reveal key={item.title} delay={120 + index * 80}>
                  <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/55 p-6 dark:bg-white/[0.03]">
                    <p className="font-display text-4xl leading-none tracking-[var(--tracking-display)]">{item.title}</p>
                    <p className="mt-4 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection id="runtime-moat" className="py-8 sm:py-12">
        <Reveal>
          <FounderRuntimeMoatMathPanel />
        </Reveal>
      </MarketingSection>

      <MarketingSection
        id="cadence"
        className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]"
      >
        <Reveal>
          <SectionEyebrow>{t("cadence.eyebrow")}</SectionEyebrow>
          <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">{t("cadence.title")}</SectionTitle>
          <SectionBody className="mt-5 max-w-3xl">{t("cadence.body")}</SectionBody>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {cadenceSteps.map((item, index) => (
            <Reveal key={item.step} delay={index * 90}>
              <div className="h-full rounded-[1.9rem] border border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.9)] p-6 dark:bg-[rgba(13,21,21,0.9)]">
                <p className="font-display text-4xl leading-none text-[var(--marketing-accent)]">{item.step}</p>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">{item.title}</h2>
                <p className="mt-4 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="identity">
        <div className="grid gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionEyebrow>{t("identity.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("identity.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("identity.body")}</SectionBody>
            <div className="mt-8 space-y-5">
              {identityItems.map((item) => (
                <div key={item.title} className="border-t border-[color:var(--marketing-line)] pt-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div
              id="inside-fundloop"
              className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(145deg,rgba(255,248,238,0.86),rgba(244,203,141,0.14))] p-8 dark:bg-[linear-gradient(145deg,rgba(14,24,23,0.94),rgba(239,139,87,0.08))]"
            >
              <SectionEyebrow>{t("insideFundLoop.eyebrow")}</SectionEyebrow>
              <SectionTitle className="mt-4 text-4xl sm:text-5xl">{t("insideFundLoop.title")}</SectionTitle>
              <SectionBody className="mt-5">{t("insideFundLoop.body")}</SectionBody>
              <div className="mt-8 space-y-5">
                {workspaceCards.map((item) => (
                  <div key={item.title} className="border-t border-[color:var(--marketing-line)] pt-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em]">{item.title}</p>
                    <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection id="start" className="pb-24 pt-10">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
            <SectionEyebrow>{t("start.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">{t("start.title")}</SectionTitle>
            <SectionBody className="mt-5 max-w-3xl">{t("start.body")}</SectionBody>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {nextSteps.map((item, index) => (
                <div key={item.step} className="rounded-[1.6rem] border border-[color:var(--marketing-line)] bg-white/55 p-5 dark:bg-white/[0.04]">
                  <p className="font-display text-3xl leading-none text-[var(--marketing-accent)]">{item.step}</p>
                  <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em]">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/?onboarding=project">
                  {t("start.primaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/documentation">{t("start.secondaryCta")}</Link>
              </Button>
            </div>
          </div>
        </Reveal>
        </MarketingSection>
      </FounderCalculatorProvider>
    </MarketingPage>
  )
}
