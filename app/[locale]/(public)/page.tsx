import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowRight, Bot, Building2, Eye, FlaskConical, LockKeyhole, UserRound } from "lucide-react"
import { Link as LocaleLink } from "@/i18n/navigation"
import { isValidLocale } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"
import { MonthlyLoopVisual } from "@/components/marketing/monthly-loop-visual"

type MonthlyStage = { step: string; title: string; body: string }
type Audience = { id: "people" | "projects" | "research" | "operators"; label: string; title: string; body: string; href: string; cta: string }
type Principle = { title: string; body: string }

const audienceIcons = {
  people: UserRound,
  projects: Building2,
  research: FlaskConical,
  operators: Bot,
} as const

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.home" })
  return { title: t("title"), description: t("description") }
}

export default async function Home({ params }: PageProps) {
  const { locale } = await params
  if (!isValidLocale(locale)) notFound()

  const t = await getTranslations({ locale, namespace: "home" })
  const stages = t.raw("monthlyLoop.stages") as MonthlyStage[]
  const audiences = t.raw("audiences.items") as Audience[]
  const principles = t.raw("trust.items") as Principle[]

  return (
    <MarketingPage className="[--marketing-accent:#d45f35]">
      <section className="relative min-h-[calc(100svh-5.5rem)] overflow-hidden border-b border-[color:var(--marketing-line)] bg-[#101b1a] text-[#fff9ef]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(212,95,53,0.24),transparent_30%),radial-gradient(circle_at_10%_82%,rgba(126,175,203,0.16),transparent_33%)]" />
        <div className="relative mx-auto grid min-h-[calc(100svh-5.5rem)] max-w-[100rem] items-center gap-10 px-6 py-12 sm:px-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(34rem,1.18fr)] lg:px-12">
          <Reveal className="z-10 max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#f5b195]">{t("eyebrow")}</p>
            <p className="mt-6 font-display text-[clamp(4.25rem,10vw,8.5rem)] leading-[0.8] tracking-[-0.075em]">FundLoop</p>
            <h1 className="mt-8 max-w-3xl text-[clamp(2.15rem,5vw,4.65rem)] font-semibold leading-[0.95] tracking-[-0.055em]">
              {t("heroTitle")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#dbe3df]">{t("heroBody")}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-[#e06b40] px-7 text-white hover:bg-[#ef7950]">
                <LocaleLink href="/?onboarding=user">{t("ctas.participant")}<ArrowRight className="h-4 w-4" /></LocaleLink>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/28 bg-white/[0.04] px-7 text-white hover:bg-white/10 hover:text-white">
                <LocaleLink href="/?onboarding=project">{t("ctas.project")}<ArrowRight className="h-4 w-4" /></LocaleLink>
              </Button>
            </div>
          </Reveal>

          <Reveal
            delay={120}
            className="pointer-events-none absolute -right-[19rem] top-20 w-[34rem] min-w-0 opacity-55 sm:-right-64 sm:top-16 lg:pointer-events-auto lg:static lg:w-auto lg:opacity-100"
          >
            <MonthlyLoopVisual
              monthLabel={t("monthlyLoop.visual.month")}
              centerLabel={t("monthlyLoop.visual.center")}
              stages={stages.map(({ title }) => title)}
            />
          </Reveal>
        </div>
      </section>

      {/* 3D Value Loop Illustration Showcase */}
      <MarketingSection className="border-b border-[color:var(--marketing-line)] bg-neutral-900/5 py-12 dark:bg-white/[0.01]">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] border border-[color:var(--marketing-line)] bg-white/70 p-4 shadow-xl dark:border-white/[0.1] dark:bg-white/[0.03] sm:p-6 lg:p-8">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[2rem] bg-neutral-100 dark:bg-neutral-900">
              <Image
                src="/images/marketing/hero-loop-light.jpg"
                alt="FundLoop Mutual Prosperity Value Loop"
                fill
                className="object-cover object-center block dark:hidden"
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
              <Image
                src="/images/marketing/hero-loop-dark.jpg"
                alt="FundLoop Mutual Prosperity Value Loop"
                fill
                className="object-cover object-center hidden dark:block"
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
            </div>
            <div className="mt-6 flex flex-col justify-between gap-4 px-2 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--marketing-accent)]">Continuous Value Circulation</p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-[var(--marketing-ink)]">A Closed Loop Where Participation Yields Shared Prosperity</h3>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
                Projects pool recurring revenue each monthly epoch. Verified human participants generate usage signal, and value returns directly with cryptographic auditability.
              </p>
            </div>
          </div>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="border-b border-[color:var(--marketing-line)] bg-white/35 dark:bg-white/[0.02]">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-24">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("monthlyLoop.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-5 max-w-xl text-5xl sm:text-6xl">{t("monthlyLoop.title")}</SectionTitle>
            <SectionBody className="mt-6">{t("monthlyLoop.body")}</SectionBody>
          </Reveal>
          <ol>
            {stages.map((stage, index) => (
              <Reveal key={stage.step} delay={index * 55}>
                <li className="group grid gap-5 border-t border-[color:var(--marketing-line)] py-7 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:py-9">
                  <span className="font-display text-4xl leading-none text-[var(--marketing-accent)] transition-transform duration-300 group-hover:translate-x-1">{stage.step}</span>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{stage.title}</h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--marketing-muted-strong)]">{stage.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </MarketingSection>

      <MarketingSection>
        <Reveal>
          <SectionEyebrow>{t("audiences.eyebrow")}</SectionEyebrow>
          <SectionTitle className="mt-5 max-w-4xl text-5xl sm:text-7xl">{t("audiences.title")}</SectionTitle>
          <SectionBody className="mt-6">{t("audiences.body")}</SectionBody>
        </Reveal>
        <div className="mt-14 grid border-t border-[color:var(--marketing-line)] lg:grid-cols-2">
          {audiences.map((audience, index) => {
            const Icon = audienceIcons[audience.id]
            return (
              <Reveal key={audience.id} delay={index * 70}>
                <LocaleLink href={audience.href} className="group block min-h-full border-b border-[color:var(--marketing-line)] py-9 lg:odd:border-r lg:odd:pr-10 lg:even:pl-10">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]"><Icon className="h-4 w-4 text-[var(--marketing-accent)]" />{audience.label}</span>
                    <ArrowRight className="h-5 w-5 text-[var(--marketing-accent)] transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                  <h2 className="mt-7 max-w-xl font-display text-4xl leading-[0.98] tracking-[-0.045em] sm:text-5xl">{audience.title}</h2>
                  <p className="mt-5 max-w-xl text-base leading-7 text-[var(--marketing-muted-strong)]">{audience.body}</p>
                  <span className="mt-7 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-accent)]">{audience.cta}</span>
                </LocaleLink>
              </Reveal>
            )
          })}
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-[#101b1a] text-[#fff9ef]">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-24">
          <Reveal>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/18 text-[#f5b195]"><LockKeyhole className="h-6 w-6" /></span>
            <p className="mt-7 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#f5b195]">{t("trust.eyebrow")}</p>
            <h2 className="mt-5 max-w-2xl font-display text-5xl leading-[0.94] tracking-[-0.05em] sm:text-6xl">{t("trust.title")}</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#cbd8d3]">{t("trust.body")}</p>
          </Reveal>
          <div>
            {principles.map((principle, index) => (
              <Reveal key={principle.title} delay={index * 80}>
                <div className="grid gap-4 border-t border-white/14 py-7 sm:grid-cols-[3rem_minmax(0,1fr)]">
                  <Eye className="mt-1 h-5 w-5 text-[#f5b195]" />
                  <div><h3 className="text-xl font-semibold tracking-[-0.025em]">{principle.title}</h3><p className="mt-2 max-w-2xl leading-7 text-[#b9cac4]">{principle.body}</p></div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="py-20 sm:py-28">
        <Reveal>
          <p className="font-display text-[clamp(3.5rem,9vw,8rem)] leading-[0.83] tracking-[-0.07em] text-[var(--marketing-accent)]">{t("closing.kicker")}</p>
          <SectionTitle className="mt-7 max-w-5xl text-5xl sm:text-7xl">{t("closing.title")}</SectionTitle>
          <SectionBody className="mt-6 max-w-3xl">{t("closing.body")}</SectionBody>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/90"><LocaleLink href="/participation">{t("closing.participant")}<ArrowRight className="h-4 w-4" /></LocaleLink></Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7"><LocaleLink href="/documentation">{t("closing.documentation")}</LocaleLink></Button>
          </div>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
