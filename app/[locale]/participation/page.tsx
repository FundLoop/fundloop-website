import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react"
import { Link as LocaleLink } from "@/i18n/navigation"
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
  const participationBeats = t.raw("howItWorks.steps") as ParticipationItem[]
  const controlPoints = t.raw("proof.points") as ParticipationItem[]

  return (
    <MarketingPage>
      <MarketingSection className="pb-10 pt-10">
        <Reveal>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-0 text-[var(--marketing-muted-strong)] hover:bg-transparent hover:text-[var(--marketing-accent)]"
          >
            <LocaleLink href="/">
              <ArrowLeft className="h-4 w-4" />
              {t("backToHome")}
            </LocaleLink>
          </Button>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pt-0">
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
                <LocaleLink href="/?onboarding=user">
                  {t("hero.participantCta")}
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
                  {t("hero.browseProjectsCta")}
                  <ArrowRight className="h-4 w-4" />
                </LocaleLink>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.8),rgba(244,203,141,0.24))] p-6 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.9),rgba(239,139,87,0.1))] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("rhythm.eyebrow")}
              </p>
              <div className="mt-6 space-y-5">
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{t("rhythm.joinTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("rhythm.joinBody")}</p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{t("rhythm.engageTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("rhythm.engageBody")}</p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{t("rhythm.returnTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">{t("rhythm.returnBody")}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("howItWorks.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("howItWorks.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("howItWorks.body")}</SectionBody>
          </Reveal>

          <div className="space-y-10">
            {participationBeats.map((beat, index) => (
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

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal>
            <SectionEyebrow>{t("proof.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("proof.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("proof.body")}</SectionBody>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="mt-8 rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <Link href="https://passport.cubid.me" target="_blank" rel="noreferrer">
                {t("proof.cubidCta")}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </Reveal>

          <div className="space-y-8">
            {controlPoints.map((point, index) => (
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
                <LocaleLink href="/?onboarding=user">
                  {t("closing.createProfile")}
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
