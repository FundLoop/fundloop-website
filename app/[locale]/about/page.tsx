import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

const principles = [
  {
    title: "Mutual prosperity",
    body: "Projects should be able to grow without extracting all of the upside from the people creating their momentum.",
  },
  {
    title: "Better signal",
    body: "Proof-of-humanity, participation, and payout logic get stronger when the ecosystem can share context instead of operating in silos.",
  },
  {
    title: "Operational alignment",
    body: "Values should show up as actual payment flows, contribution models, and onboarding behavior, not just brand language.",
  },
] as const

const timeline = [
  {
    step: "Origin",
    body: "FundLoop started from a simple frustration: the internet keeps generating value through communities, yet the value rarely loops back to those communities in a principled way.",
  },
  {
    step: "Model",
    body: "The answer is not another subscription moat. It is a network where projects can pledge a small share of upside, people can build signal through real use, and value can return with better context.",
  },
  {
    step: "Direction",
    body: "That means FundLoop acts as an application shell, funding layer, and coordination surface for a broader regenerative economy rather than a single standalone product.",
  },
] as const

export default function AboutPage() {
  return (
    <MarketingPage>
      <MarketingSection className="pb-10 pt-10">
        <Reveal>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-0 text-[var(--marketing-muted-strong)] hover:bg-transparent hover:text-[var(--marketing-accent)]"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </Button>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pt-0">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
          <Reveal>
            <SectionEyebrow>About FundLoop</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">
              FundLoop is building the operating logic for a network economy that shares value back out.
            </SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">
              The point is not to charge people to participate. The point is to help projects, communities, and funding
              flows align so contribution can be noticed, trusted, and rewarded more fairly.
            </SectionBody>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/52 p-6 dark:bg-white/[0.03]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                In plain language
              </p>
              <div className="mt-6 space-y-5">
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">Projects contribute</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">
                    Teams can pledge 1% or more back into the loop.
                  </p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">People build signal</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">
                    Real participation becomes legible across a wider ecosystem.
                  </p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">Value returns</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">
                    Shared upside can flow back to people, operators, and aligned new projects.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-10 lg:grid-cols-3">
          {principles.map((principle, index) => (
            <Reveal key={principle.title} delay={index * 90}>
              <div className="border-t border-[color:var(--marketing-line)] pt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em]">{principle.title}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{principle.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Reveal>
            <SectionEyebrow>Story</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">Why this exists.</SectionTitle>
          </Reveal>
          <div className="space-y-8">
            {timeline.map((item, index) => (
              <Reveal key={item.step} delay={index * 80}>
                <div className="grid gap-4 border-t border-[color:var(--marketing-line)] pt-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-muted)]">{item.step}</p>
                  <p className="text-base leading-7 text-[var(--marketing-muted-strong)]">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-10">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
            <SectionEyebrow>Next step</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-3xl text-5xl sm:text-6xl">If your project wants a better loop, start inside the system that is trying to build one.</SectionTitle>
            <SectionBody className="mt-5">
              Project onboarding already saves drafts automatically, so teams can start the process without losing
              their place.
            </SectionBody>
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
