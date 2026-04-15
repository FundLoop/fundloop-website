import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ArrowRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
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
}

type ReportStep = {
  step: string
  title: string
  body: string
}

type ReportCard = {
  title: string
  body: string
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.reports" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function ReportsPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "reportsPage" })
  const todayItems = t.raw("today.items") as ReportCard[]
  const futureSteps = t.raw("future.steps") as ReportStep[]

  return (
    <MarketingPage>
      <MarketingSection className="pt-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
          <Reveal>
            <SectionEyebrow>{t("hero.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{t("hero.title")}</SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">{t("hero.body")}</SectionBody>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.82),rgba(126,175,203,0.22))] p-6 dark:bg-[linear-gradient(135deg,rgba(14,22,22,0.92),rgba(126,175,203,0.08))] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("guardrails.eyebrow")}
              </p>
              <p className="mt-5 text-sm leading-7 text-[var(--marketing-muted-strong)]">{t("guardrails.body")}</p>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("today.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("today.title")}</SectionTitle>
          </Reveal>
          <div className="space-y-5">
            {todayItems.map((item, index) => (
              <Reveal key={item.title} delay={index * 70}>
                <div className="border-t border-[color:var(--marketing-line)] pt-5">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{item.title}</h2>
                  <p className="mt-3 text-base leading-7 text-[var(--marketing-muted-strong)]">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("future.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("future.title")}</SectionTitle>
          </Reveal>
          <div className="space-y-8">
            {futureSteps.map((step, index) => (
              <Reveal key={step.step} delay={index * 80}>
                <div className="grid gap-4 border-t border-[color:var(--marketing-line)] pt-5 sm:grid-cols-[5rem_minmax(0,1fr)]">
                  <p className="font-display text-4xl leading-none text-[var(--marketing-accent)]">{step.step}</p>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{step.title}</h2>
                    <p className="mt-3 text-base leading-7 text-[var(--marketing-muted-strong)]">{step.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-10">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
            <SectionEyebrow>{t("guardrails.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">{t("guardrails.title")}</SectionTitle>
            <SectionBody className="mt-5 max-w-3xl">{t("guardrails.body")}</SectionBody>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/documentation">
                  {t("cta.documentation")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/founders">
                  {t("cta.founderPath")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
