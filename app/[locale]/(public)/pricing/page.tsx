import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

const principles = [
  {
    title: "Users pay nothing to participate.",
    body: "Profiles, exploration, and eventual eligibility should not come with a platform subscription.",
  },
  {
    title: "Projects support the loop voluntarily.",
    body: "FundLoop asks aligned projects to contribute when they can instead of gating entry behind SaaS pricing.",
  },
  {
    title: "Payment rails carry their own execution costs.",
    body: "Fiat processor fees and crypto gas costs come out of money movement, not out of a separate recurring platform charge.",
  },
] as const

const fundingFlows = [
  {
    label: "1%+ to operators",
    body: "Supports the people, infrastructure, and review flows required to operate FundLoop reliably.",
  },
  {
    label: "1%+ to the treasury",
    body: "Helps aligned new projects get far enough to eventually contribute back into the loop.",
  },
] as const

export default function PricingPage() {
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
            <SectionEyebrow>Pricing</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">
              Free for people. Supported by aligned projects. Honest about transfer costs.
            </SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">
              FundLoop is the place people come to receive value, not another product that charges them for access. The
              model is designed to keep participation open while letting projects support the system in a principled way.
            </SectionBody>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/52 p-6 dark:bg-white/[0.03]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                Core rule
              </p>
              <p className="mt-4 font-display text-4xl leading-none tracking-[-0.04em]">Users should never have to pay just to be in the loop.</p>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-10 lg:grid-cols-3">
          {principles.map((item, index) => (
            <Reveal key={item.title} delay={index * 90}>
              <div className="border-t border-[color:var(--marketing-line)] pt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em]">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Reveal>
            <SectionEyebrow>How project support works</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">Voluntary support keeps the platform sustainable without turning it into a paywall.</SectionTitle>
            <SectionBody className="mt-5">
              FundLoop recommends a simple split for teams that want to help keep the loop healthy today while also
              helping new aligned projects survive long enough to join it.
            </SectionBody>
          </Reveal>

          <div className="space-y-8">
            {fundingFlows.map((flow, index) => (
              <Reveal key={flow.label} delay={index * 90}>
                <div className="border-t border-[color:var(--marketing-line)] pt-5">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">{flow.label}</p>
                  <p className="mt-4 max-w-xl text-base leading-7 text-[var(--marketing-muted-strong)]">{flow.body}</p>
                </div>
              </Reveal>
            ))}

            <Reveal delay={180}>
              <div className="border-t border-[color:var(--marketing-line)] pt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em]">Transfer fees</p>
                <p className="mt-3 max-w-xl text-base leading-7 text-[var(--marketing-muted-strong)]">
                  When money actually moves, there are direct network costs. Payment processor fees apply to fiat rails
                  and gas fees apply to crypto rails. Those costs come out of the transferred funds themselves.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-10">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
            <SectionEyebrow>Join the loop</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-3xl text-5xl sm:text-6xl">If your team wants to support shared prosperity, start with a project profile.</SectionTitle>
            <SectionBody className="mt-5">
              FundLoop already supports resumable onboarding drafts, so you can begin now and finish when your team is
              ready.
            </SectionBody>
            <Button
              asChild
              size="lg"
              className="mt-8 rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
            >
              <Link href="/?onboarding=project">
                Join as a project
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
