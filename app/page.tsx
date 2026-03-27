import Link from "next/link"
import { ArrowRight, ExternalLink, HeartHandshake, ShieldCheck, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { OpenUseCasesCta } from "@/components/marketing/open-use-cases-cta"
import { Reveal } from "@/components/marketing/reveal"
import { NetworkConstellation } from "@/components/marketing/network-constellation"
import { ecosystemSites, resourceLinks } from "@/lib/public-site"
import { useCases } from "@/lib/use-cases"

const loopSteps = [
  {
    step: "01",
    title: "Projects pledge part of the upside.",
    body: "Teams route a small share of revenue, treasury, or distribution value back into the loop instead of treating community support as free extraction.",
  },
  {
    step: "02",
    title: "People create signal through real participation.",
    body: "FundLoop tracks meaningful engagement, identity confidence, and project context so the network can see more than a single wallet snapshot.",
  },
  {
    step: "03",
    title: "Value returns with more context and less guesswork.",
    body: "Payout, proof, and growth programs can be grounded in actual contribution rather than vanity metrics, bot noise, or flat one-size-fits-all rewards.",
  },
] as const

type EntryPath =
  | {
      eyebrow: string
      title: string
      body: string
      cta: string
      ctaAction: "open-use-cases-menu"
    }
  | {
      eyebrow: string
      title: string
      body: string
      cta: string
      href: string
    }

const entryPaths: EntryPath[] = [
  {
    eyebrow: "For founders and operators",
    title: "Turn participation into a fair distribution engine.",
    body: "Use FundLoop for fAirdrops, proof-of-humanity confidence, community incentives, and the kind of give-back mechanics that make your product feel aligned instead of extractive.",
    cta: "See founder use cases",
    ctaAction: "open-use-cases-menu",
  },
  {
    eyebrow: "For people in the network",
    title: "Join early, show up consistently, and get counted.",
    body: "FundLoop is designed so people can create a profile, accumulate reputation through real usage, and eventually withdraw value from a system built to notice contribution.",
    href: "/participation",
    cta: "Read how participation works",
  },
] as const

const iconMap = {
  fairdrops: Sparkles,
  "proof-of-humanity": ShieldCheck,
  "community-engagement": Users,
  "give-back": HeartHandshake,
} as const

const ecosystemPreviewNames = ["ChainCrew", "ClearPass", "Cubid", "SmarTrust", "TCOIN", "Solar Village"] as const

const ecosystemPreviewSites = ecosystemPreviewNames
  .map((name) => ecosystemSites.find((site) => site.name === name))
  .filter((site): site is (typeof ecosystemSites)[number] => Boolean(site))

export default function Home() {
  return (
    <MarketingPage>
      <section className="relative min-h-[calc(100svh-5.5rem)]">
        <div className="mx-auto grid min-h-[calc(100svh-5.5rem)] max-w-7xl items-end gap-12 px-6 pb-14 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(22rem,0.98fr)] lg:px-12">
          <Reveal className="max-w-3xl pb-4">
            <SectionEyebrow>Mutual prosperity, made operational</SectionEyebrow>
            <p className="mt-6 font-display text-[clamp(4rem,12vw,8.5rem)] leading-none tracking-[-0.07em]">FundLoop</p>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              A networked economy where projects feed the loop and people share in the upside.
            </h1>
            <SectionBody className="mt-6 max-w-xl">
              FundLoop helps teams reward real contribution, grow with stronger proof-of-humanity signal, and route
              part of success back to the communities that make the whole system work.
            </SectionBody>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/?onboarding=project">
                  Start a project profile
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 text-[var(--marketing-ink)] hover:bg-black/[0.04] dark:text-[var(--marketing-paper)] dark:hover:bg-white/[0.06]"
              >
                <Link href="/?onboarding=user">
                  Join as a participant
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-10 grid gap-3 text-sm text-[var(--marketing-muted-strong)] sm:grid-cols-3">
              <p className="border-t border-[color:var(--marketing-line)] pt-3">Projects pledge 1%+ into the loop.</p>
              <p className="border-t border-[color:var(--marketing-line)] pt-3">People create signal through use.</p>
              <p className="border-t border-[color:var(--marketing-line)] pt-3">Value returns with more context.</p>
            </div>
          </Reveal>

          <Reveal delay={120} className="lg:pb-6">
            <NetworkConstellation />
          </Reveal>
        </div>
      </section>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>How the loop works</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-xl text-5xl sm:text-6xl">A funding model built to compound alignment.</SectionTitle>
            <SectionBody className="mt-5">
              Each layer has one job: projects contribute, people participate, and FundLoop turns the resulting signal
              into fairer flows of proof, payouts, and growth.
            </SectionBody>
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
                {"ctaAction" in path ? (
                  <OpenUseCasesCta className="group mt-10 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                    {path.cta}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </OpenUseCasesCta>
                ) : (
                  <Link
                    href={path.href}
                    className="group mt-10 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]"
                  >
                    {path.cta}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="use-cases" className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>Use cases</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">Five concrete ways to put FundLoop to work.</SectionTitle>
            <SectionBody className="mt-5">
              FundLoop is not a vague ecosystem story. It is a practical layer for better distributions, stronger
              anti-bot confidence, more durable community incentives, and shared upside.
            </SectionBody>
          </Reveal>

          <div className="space-y-5">
            {useCases.map((useCase, index) => {
              const Icon = iconMap[useCase.slug as keyof typeof iconMap] ?? Sparkles

              return (
                <Reveal key={useCase.slug} delay={index * 80}>
                  <Link
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
                            {useCase.eyebrow}
                          </p>
                        </div>
                        <h2 className="mt-4 font-display text-4xl leading-none tracking-[-0.04em]">{useCase.label}</h2>
                        <p className="mt-4 text-base leading-7 text-[var(--marketing-muted-strong)]">{useCase.description}</p>
                      </div>
                      <span className="mt-1 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]">
                        Explore
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
          <Reveal>
            <SectionEyebrow>Ecosystem preview</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">FundLoop grows stronger inside an aligned orbit.</SectionTitle>
            <SectionBody className="mt-5">
              Identity, coordination, local economies, voting, escrow, and regenerative finance are already taking
              shape around the loop. FundLoop is designed to sit inside that network, not above it.
            </SectionBody>
            <Link
              href="/ecosystem"
              className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]"
            >
              View the full ecosystem
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
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
                    <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{site.desc}</p>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                    Visit site
                    <ExternalLink className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <Reveal>
            <SectionEyebrow>Resources</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">Keep going.</SectionTitle>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {resourceLinks.map((resource, index) => (
              <Reveal key={resource.href} delay={index * 70}>
                <Link href={resource.href} className="group block border-t border-[color:var(--marketing-line)] pt-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">{resource.label}</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{resource.description}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                    Open page
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-20">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.86),rgba(244,203,141,0.26))] p-8 shadow-[0_30px_90px_rgba(15,23,23,0.08)] dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-12">
            <SectionEyebrow>Start where you are</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-3xl text-5xl sm:text-6xl">
              FundLoop already saves onboarding drafts, supports project profiles, and is ready for the next wave of
              aligned builders.
            </SectionTitle>
            <SectionBody className="mt-5">
              If you are building a project, join the loop. If you are a participant, create your profile and be ready
              when value starts moving through the network.
            </SectionBody>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/?onboarding=project">
                  Join as a project
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/?onboarding=user">
                  Join as a participant
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
