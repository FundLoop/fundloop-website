import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

// TODO(Session 03 IA): keep this public temporarily, but merge its canonical content into `/documentation` once developer, MCP, and protocol docs are real.

const surfaces = [
  {
    title: "Data access",
    body: "Project, user, and contribution data are the core integration surface developers expect from FundLoop.",
  },
  {
    title: "Identity-aware workflows",
    body: "Proof-of-humanity and attribution are most useful when they are available as product primitives, not one-off exports.",
  },
  {
    title: "Events and notifications",
    body: "Webhooks and real-time updates matter once payouts, onboarding, and network activity need to move across systems.",
  },
] as const

const examples = [
  {
    label: "REST style",
    snippet: `GET /projects\nGET /users/:id\nGET /contributions/stats`,
  },
  {
    label: "Graph style",
    snippet: `query {\n  projects {\n    id\n    name\n    users { id }\n  }\n}`,
  },
  {
    label: "Event style",
    snippet: `project.created\npayment.sent\nanalytics.updated`,
  },
] as const

export default function APIPage() {
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
            <SectionEyebrow>Developer preview</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">
              The FundLoop API is a product surface in progress, not yet a finished public platform.
            </SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">
              This page describes the integration shape FundLoop is growing toward: data access, identity-aware
              workflows, and event-driven coordination for projects building inside the loop.
            </SectionBody>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/52 p-6 dark:bg-white/[0.03]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                Current state
              </p>
              <p className="mt-4 text-base leading-7 text-[var(--marketing-muted-strong)]">
                Developer-facing APIs, SDKs, and webhooks are still being shaped. Today, the clearest next step is to
                review the documentation or contact support about your intended integration.
              </p>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-10 lg:grid-cols-3">
          {surfaces.map((surface, index) => (
            <Reveal key={surface.title} delay={index * 90}>
              <div className="border-t border-[color:var(--marketing-line)] pt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em]">{surface.title}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{surface.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-8 lg:grid-cols-3">
          {examples.map((example, index) => (
            <Reveal key={example.label} delay={index * 80}>
              <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-[rgba(12,20,20,0.94)] p-5 text-[var(--marketing-paper)] shadow-[0_20px_60px_rgba(15,23,23,0.12)]">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-accent-soft)]">
                  {example.label}
                </p>
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-6 text-[var(--marketing-paper)]/90">
                  {example.snippet}
                </pre>
              </div>
            </Reveal>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-10">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
            <SectionEyebrow>Need a technical path?</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-3xl text-5xl sm:text-6xl">Start with the docs, then tell us what you need your integration to do.</SectionTitle>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/documentation">Open documentation</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/support">
                  Contact support
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
