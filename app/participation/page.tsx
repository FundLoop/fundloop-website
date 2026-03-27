import Link from "next/link"
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

const participationBeats = [
  {
    step: "01",
    title: "Start with one project, or better yet a few.",
    body: "Join participating projects you genuinely care about. If you are already active in one, you have already started creating signal.",
  },
  {
    step: "02",
    title: "Show up in a real way.",
    body: "FundLoop works best when participation looks like actual contribution, curiosity, support, and follow-through instead of click-farming or empty activity.",
  },
  {
    step: "03",
    title: "Come back and widen your orbit.",
    body: "When you have time, return to FundLoop, discover another aligned project, and keep building a fuller picture of how you participate across the network.",
  },
  {
    step: "04",
    title: "Check your total reward each month.",
    body: "FundLoop aggregates what the network has seen and turns it into a clearer monthly view of the value you have earned across participating projects.",
  },
] as const

const controlPoints = [
  {
    label: "Humanity proof",
    body: "The algorithm is designed to reward real humans. If you prove your humanity in one participating app, that can strengthen how the wider network understands your participation.",
  },
  {
    label: "Privacy controls",
    body: "You decide how much information to share with FundLoop and with each participating app. Stronger proof does not have to mean giving away more than you want to.",
  },
  {
    label: "Payout preferences",
    body: "Leave rewards in your FundLoop account, withdraw them when you want, and update your preferred currencies or tokens whenever your needs change.",
  },
] as const

export default function ParticipationPage() {
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
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.76fr)]">
          <Reveal>
            <SectionEyebrow>Participation</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">
              Participate across real projects, then come back monthly to see what the network says it was worth.
            </SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">
              FundLoop is for people who join aligned projects, engage with them sincerely, and want rewards to reflect
              real presence instead of shallow activity. You do not grind one app forever. You build a record of
              participation across the loop.
            </SectionBody>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/?onboarding=user">
                  Join as a participant
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/projects">
                  Browse participating projects
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.8),rgba(244,203,141,0.24))] p-6 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.9),rgba(239,139,87,0.1))] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                Participation rhythm
              </p>
              <div className="mt-6 space-y-5">
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">Join</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">
                    Start with one project or several that feel genuinely relevant to you.
                  </p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">Engage</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">
                    Participate in ways that create real context, not just noisy activity.
                  </p>
                </div>
                <div className="border-t border-[color:var(--marketing-line)] pt-4">
                  <p className="font-display text-4xl leading-none tracking-[-0.04em]">Return</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">
                    Come back monthly to review your total reward and decide what to do with it.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>How it works</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">A loop built around genuine participation.</SectionTitle>
            <SectionBody className="mt-5">
              The goal is simple: make it easier for people to move through an ecosystem of aligned projects and have
              their contribution recognized with more nuance than one app could see on its own.
            </SectionBody>
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
            <SectionEyebrow>Proof and privacy</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">FundLoop rewards humans, not just activity.</SectionTitle>
            <SectionBody className="mt-5">
              Humanity proof can come from participating apps you already use, and you can always strengthen it later.
              The important thing is that you stay in control of what gets shared and where.
            </SectionBody>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="mt-8 rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <Link href="https://passport.cubid.me" target="_blank" rel="noreferrer">
                Manage your Cubid Passport
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
            <SectionEyebrow>What you can do with rewards</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">
              Keep them in FundLoop, withdraw when it suits you, and change payout preferences whenever you want.
            </SectionTitle>
            <SectionBody className="mt-5 max-w-3xl">
              Rewards are not meant to trap you. Leave them in your FundLoop account if that is convenient, withdraw on
              your own timing, and update the currencies or tokens you prefer as your circumstances change.
            </SectionBody>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/?onboarding=user">
                  Create your profile
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/projects">Find another project</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
