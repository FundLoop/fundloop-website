import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Building2, HeartHandshake, ShieldCheck, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"
import { getUseCaseBySlug, useCases } from "@/lib/use-cases"

const iconMap = {
  fairdrops: Sparkles,
  "proof-of-humanity": ShieldCheck,
  "community-engagement": Users,
  "give-back": HeartHandshake,
  "viral-growth": Building2,
} as const

export function generateStaticParams() {
  return useCases.map((useCase) => ({ slug: useCase.slug }))
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const useCase = getUseCaseBySlug(slug)

  if (!useCase) {
    notFound()
  }

  const Icon = iconMap[useCase.slug]
  const relatedCases = useCases.filter((entry) => entry.slug !== useCase.slug).slice(0, 3)

  return (
    <MarketingPage>
      <MarketingSection className="pb-10 pt-10">
        <Reveal>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-0 text-[var(--marketing-muted-strong)] hover:bg-transparent hover:text-[var(--marketing-accent)]"
          >
            <Link href="/#use-cases">
              <ArrowLeft className="h-4 w-4" />
              Back to use cases
            </Link>
          </Button>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pt-0">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-white/55 dark:bg-white/[0.04]">
                <Icon className="h-4 w-4" />
              </span>
              <SectionEyebrow>{useCase.eyebrow}</SectionEyebrow>
            </div>
            <SectionTitle className="mt-6 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{useCase.label}</SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">{useCase.hero}</SectionBody>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/52 p-6 dark:bg-white/[0.03]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                What this unlocks
              </p>
              <ul className="mt-6 space-y-4">
                {useCase.outcomes.map((outcome) => (
                  <li key={outcome} className="border-t border-[color:var(--marketing-line)] pt-4 text-sm leading-6 text-[var(--marketing-muted-strong)]">
                    {outcome}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Reveal>
            <SectionEyebrow>How it works</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">Operational detail, not vague promise.</SectionTitle>
          </Reveal>
          <div className="space-y-8">
            {useCase.body.map((paragraph, index) => (
              <Reveal key={paragraph} delay={index * 70}>
                <p className="border-t border-[color:var(--marketing-line)] pt-5 text-base leading-7 text-[var(--marketing-muted-strong)]">
                  {paragraph}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Reveal>
            <SectionEyebrow>Why teams use it</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">What makes this useful in practice.</SectionTitle>
          </Reveal>
          <div className="space-y-5">
            {useCase.reasons.map((reason, index) => (
              <Reveal key={reason} delay={index * 70}>
                <p className="border-t border-[color:var(--marketing-line)] pt-5 text-base leading-7 text-[var(--marketing-muted-strong)]">
                  {reason}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <Reveal>
            <SectionEyebrow>Related use cases</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">Keep exploring the loop.</SectionTitle>
          </Reveal>
          <div className="space-y-4">
            {relatedCases.map((entry, index) => (
              <Reveal key={entry.slug} delay={index * 60}>
                <Link href={entry.href} className="group block border-t border-[color:var(--marketing-line)] py-5">
                  <p className="font-display text-3xl leading-none tracking-[-0.04em]">{entry.label}</p>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--marketing-muted-strong)]">{entry.description}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                    Read more
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-14">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
            <SectionEyebrow>Ready to apply it?</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-3xl text-5xl sm:text-6xl">Create a project profile and connect the right onboarding, identity, and payout workflows.</SectionTitle>
            <Button
              asChild
              size="lg"
              className="mt-8 rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
            >
              <Link href="/?onboarding=project">
                Start a project profile
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
