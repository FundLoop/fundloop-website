import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowRight, ExternalLink, HeartHandshake, ShieldCheck, Sparkles, Users } from "lucide-react"
import { Link as LocaleLink } from "@/i18n/navigation"
import { isValidLocale } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import {
  MarketingPage,
  MarketingSection,
  SectionBody,
  SectionEyebrow,
  SectionTitle,
} from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"
import { NetworkConstellation } from "@/components/marketing/network-constellation"
import { JourneyConfidenceBand, type JourneyConfidenceItem } from "@/components/marketing/journey-confidence-band"
import { RotatingHeroTitle } from "@/components/marketing/rotating-hero-title"
import { ecosystemSites, resourceLinks } from "@/lib/public-site"
import { useCases } from "@/lib/use-cases"

const iconMap = {
  fairdrops: Sparkles,
  "proof-of-humanity": ShieldCheck,
  "community-engagement": Users,
  "give-back": HeartHandshake,
  "viral-growth": Sparkles,
} as const

const ecosystemPreviewNames = ["ChainCrew", "ClearPass", "Cubid", "SmarTrust", "TCOIN", "Solar Village"] as const

type HomeStep = {
  step: string
  title: string
  body: string
}

type EntryPath =
  {
    eyebrow: string
    title: string
    body: string
    cta: string
    href: string
  }

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.home" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function Home({ params }: PageProps) {
  const { locale } = await params

  if (!isValidLocale(locale)) {
    notFound()
  }

  const t = await getTranslations({ locale, namespace: "home" })
  const polishT = await getTranslations({ locale, namespace: "journeyPolish.home" })
  const shellT = await getTranslations({ locale, namespace: "shell" })
  const loopSteps = t.raw("howItWorks.steps") as HomeStep[]
  const entryPaths = t.raw("entryPaths") as EntryPath[]
  const heroPrefixes = t.raw("heroPrefixes") as string[]
  const exploreResourceLinks = resourceLinks.map((link) => ({
    ...link,
    label: shellT(`nav.resourceLinks.${link.id}.label`),
    description: shellT(`nav.resourceLinks.${link.id}.description`),
  }))
  const ecosystemPreviewSites = ecosystemPreviewNames
    .map((name) => ecosystemSites.find((site) => site.name === name))
    .filter((site): site is (typeof ecosystemSites)[number] => Boolean(site))

  return (
    <MarketingPage>
      <section className="relative min-h-[calc(100svh-5.5rem)]">
        <div className="mx-auto grid min-h-[calc(100svh-5.5rem)] max-w-7xl grid-cols-[minmax(0,1fr)] items-end gap-12 px-6 pb-14 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(22rem,0.98fr)] lg:px-12">
          <Reveal className="min-w-0 max-w-3xl pb-4">
            <SectionEyebrow>{t("eyebrow")}</SectionEyebrow>
            <p className="mt-6 font-display text-[clamp(4rem,12vw,8.5rem)] leading-none tracking-[-0.07em]">FundLoop</p>
            <RotatingHeroTitle prefixes={heroPrefixes} suffix={t("heroSuffix")} />
            <SectionBody className="mt-6 max-w-xl font-medium text-[var(--marketing-ink)]">
              {t("heroThesis")}
            </SectionBody>
            <SectionBody className="mt-3 max-w-xl">{t("heroBody")}</SectionBody>
            <div id="project-signup" className="mt-10 flex scroll-mt-28 flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <LocaleLink href="/?onboarding=project">
                  {t("ctas.project")}
                  <ArrowRight className="h-4 w-4" />
                </LocaleLink>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 text-[var(--marketing-ink)] hover:bg-black/[0.04] dark:text-[var(--marketing-paper)] dark:hover:bg-white/[0.06]"
              >
                <LocaleLink href="/?onboarding=user">
                  {t("ctas.participant")}
                  <ArrowRight className="h-4 w-4" />
                </LocaleLink>
              </Button>
            </div>
            <div className="mt-10 grid gap-3 text-sm text-[var(--marketing-muted-strong)] sm:grid-cols-3">
              <p className="border-t border-[color:var(--marketing-line)] pt-3">{t("statLines.projects")}</p>
              <p className="border-t border-[color:var(--marketing-line)] pt-3">{t("statLines.people")}</p>
              <p className="border-t border-[color:var(--marketing-line)] pt-3">{t("statLines.value")}</p>
            </div>
          </Reveal>

          <Reveal delay={120} className="lg:pb-6">
            <NetworkConstellation />
          </Reveal>
        </div>
      </section>

      <JourneyConfidenceBand
        eyebrow={polishT("eyebrow")}
        title={polishT("title")}
        body={polishT("body")}
        primaryCta={polishT("primaryCta")}
        primaryHref="/participation"
        secondaryCta={polishT("secondaryCta")}
        secondaryHref="/founders"
        items={polishT.raw("items") as JourneyConfidenceItem[]}
      />

      <MarketingSection className="border-b border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("theoryOfChange.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-lg text-5xl sm:text-6xl">
              {t("theoryOfChange.title")}
            </SectionTitle>
            <SectionBody className="mt-5">{t("theoryOfChange.body")}</SectionBody>
          </Reveal>

          <div>
            {["capitalism", "basicIncome", "pluralism"].map((idea, index) => (
              <Reveal key={idea} delay={index * 90}>
                <article className="grid gap-5 border-t border-[color:var(--marketing-line)] py-8 sm:grid-cols-[4rem_minmax(0,1fr)] sm:py-10">
                  <p className="font-display text-3xl leading-none text-[var(--marketing-accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <div>
                    <h2 className="max-w-2xl font-display text-3xl leading-[1.02] tracking-[-0.04em] sm:text-4xl">
                      {t(`theoryOfChange.ideas.${idea}.title`)}
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--marketing-muted-strong)]">
                      {t(`theoryOfChange.ideas.${idea}.body`)}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("howItWorks.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-xl text-5xl sm:text-6xl">{t("howItWorks.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("howItWorks.body")}</SectionBody>
          </Reveal>

          <div className="space-y-10">
            {loopSteps.map((item, index) => (
              <Reveal key={item.step} delay={index * 90}>
                <div className="grid gap-5 border-t border-[color:var(--marketing-line)] pt-6 sm:grid-cols-[5rem_minmax(0,1fr)]">
                  <p className="font-display text-4xl leading-none text-[var(--marketing-accent)]">{item.step}</p>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{item.title}</h2>
                    <p className="mt-3 max-w-xl text-base leading-7 text-[var(--marketing-muted-strong)]">{item.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-2">
          {entryPaths.map((path, index) => (
            <Reveal key={path.title} delay={index * 120}>
              <div className="flex h-full flex-col justify-between border-t border-[color:var(--marketing-line)] pt-6">
                <div>
                  <SectionEyebrow>{path.eyebrow}</SectionEyebrow>
                  <h2 className="mt-4 max-w-lg font-display text-4xl leading-none tracking-[-0.04em] sm:text-5xl">
                    {path.title}
                  </h2>
                  <p className="mt-5 max-w-xl text-base leading-7 text-[var(--marketing-muted-strong)]">{path.body}</p>
                </div>
                <LocaleLink
                  href={path.href}
                  className="group mt-10 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]"
                >
                  {path.cta}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </LocaleLink>
              </div>
            </Reveal>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="use-cases" className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("useCases.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("useCases.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("useCases.body")}</SectionBody>
          </Reveal>

          <div className="space-y-5">
            {useCases.map((useCase, index) => {
              const Icon = iconMap[useCase.slug as keyof typeof iconMap] ?? Sparkles

              return (
                <Reveal key={useCase.slug} delay={index * 80}>
                  <LocaleLink
                    href={useCase.href}
                    className="group block border-t border-[color:var(--marketing-line)] px-1 py-6 transition-colors hover:text-[var(--marketing-accent)]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-2xl">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-white/55 dark:bg-white/[0.04]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                            {t(`useCases.items.${useCase.slug}.eyebrow`)}
                          </p>
                        </div>
                        <h2 className="mt-4 font-display text-4xl leading-none tracking-[-0.04em]">
                          {t(`useCases.items.${useCase.slug}.label`)}
                        </h2>
                        <p className="mt-4 text-base leading-7 text-[var(--marketing-muted-strong)]">
                          {t(`useCases.items.${useCase.slug}.description`)}
                        </p>
                      </div>
                      <span className="mt-1 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]">
                        {t("useCases.explore")}
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </LocaleLink>
                </Reveal>
              )
            })}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
          <Reveal>
            <SectionEyebrow>{t("ecosystem.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("ecosystem.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("ecosystem.body")}</SectionBody>
            <LocaleLink
              href="/ecosystem"
              className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]"
            >
              {t("ecosystem.cta")}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </LocaleLink>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {ecosystemPreviewSites.map((site, index) => (
              <Reveal key={site.url} delay={index * 70}>
                <Link
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex h-full flex-col justify-between rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/58 p-5 transition-transform duration-200 hover:-translate-y-1 dark:bg-white/[0.03]"
                >
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em]">{site.name}</p>
                    <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">
                      {t(`ecosystem.sites.${site.name}`)}
                    </p>
                  </div>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-accent)]">
                    {t("ecosystem.visitSite")}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("resources.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("resources.title")}</SectionTitle>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {exploreResourceLinks.map((resource, index) => (
              <Reveal key={resource.href} delay={index * 70}>
                <LocaleLink
                  href={resource.href}
                  className="group flex min-h-48 flex-col justify-between rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/58 p-5 transition-transform duration-200 hover:-translate-y-1 dark:bg-white/[0.03]"
                >
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                      {resource.label}
                    </p>
                    <p className="mt-4 text-base leading-7 text-[var(--marketing-muted-strong)]">{resource.description}</p>
                  </div>
                  <span className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                    {t("resources.openPage")}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </LocaleLink>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-10">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
            <SectionEyebrow>{t("closing.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">{t("closing.title")}</SectionTitle>
            <SectionBody className="mt-5 max-w-3xl">{t("closing.body")}</SectionBody>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <LocaleLink href="/?onboarding=project">
                  {t("closing.project")}
                  <ArrowRight className="h-4 w-4" />
                </LocaleLink>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <LocaleLink href="/?onboarding=user">{t("closing.participant")}</LocaleLink>
              </Button>
            </div>
          </div>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
