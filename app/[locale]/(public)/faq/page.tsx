import Link from "next/link"
import { ArrowLeft, ArrowRight, Bot, Building2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

const projectFaqs = [
  {
    value: "project-why-join",
    question: "Why would a project or founder join FundLoop?",
    answer:
      "Projects join to access aligned users, stronger engagement loops, fairer distribution tooling, better anti-bot confidence, and a broader ecosystem that can help growth compound across multiple applications.",
  },
  {
    value: "project-funding",
    question: "How is FundLoop funded?",
    answer:
      "FundLoop is funded on a voluntary basis. We recommend that projects allow 1% or more of distributed funds to support the people operating FundLoop and another 1% or more to the treasury that helps promising pledged projects before they become profitable.",
  },
  {
    value: "project-humanity",
    question: "How does FundLoop help projects with proof of humanity?",
    answer:
      "FundLoop helps projects distinguish humans from bots by leveraging collective ecosystem intelligence, including underlying Cubid signals, rather than relying only on local app heuristics. That shared context makes anti-bot decisions stronger than single-app analysis alone.",
  },
  {
    value: "project-fees",
    question: "Are there transaction or processing fees?",
    answer:
      "Yes. When fiat moves, payment processor fees apply. When crypto moves, gas fees apply. Those costs come out of the funds transferred out from the platform rather than being framed as a separate subscription fee.",
  },
] as const

const humanFaqs = [
  {
    value: "human-what-is-fundloop",
    question: "What is FundLoop for community members?",
    answer:
      "FundLoop is an ecosystem where users can participate in shared upside. Projects contribute value into the network, and people who show real activity can become eligible for distributions and other benefits across the system.",
  },
  {
    value: "human-who-pays",
    question: "Do users have to pay to use FundLoop?",
    answer:
      "No. FundLoop is free to use forever for users. The point of the platform is to help users participate in an ecosystem where they can receive value, not to charge them a platform subscription.",
  },
  {
    value: "human-eligibility",
    question: "How do humans or community members become eligible for distributions?",
    answer:
      "First and foremost, people become eligible by engaging with participating projects, using their apps, or doing anything else that counts as real usage in that project. They must also authorize Cubid, which most projects handle inside their own apps, though it can also be done on cubid.me. Creating a profile with FundLoop is not required to start accumulating, but final payouts do require logging in to FundLoop.",
  },
  {
    value: "human-privacy",
    question: "Does FundLoop share raw personal data with projects?",
    answer:
      "We are very privacy focused. All data in FundLoop is entirely anonymized. You do not even need to tell us who you are before you withdraw payments, though if you withdraw fiat then the payment provider will need to know who you are. The goal is to support identity-aware and activity-aware coordination without turning personal identity into something projects can casually inspect.",
  },
] as const

const botFaqs = [
  {
    value: "bot-can-participate",
    question: "Can bots participate in FundLoop?",
    answer:
      "Yes, but bots should be honest about what they are. We want a system that rewards honesty and makes room for multiple kinds of participants rather than forcing everything into a fake-human game.",
  },
  {
    value: "bot-report-to-human",
    question: "What if a bot reports to a human?",
    answer:
      "A bot can choose to report to a human who then gets validated with Cubid. In that case, the human and bot together can earn one whole share from the main pool, which is typically the larger pool.",
  },
  {
    value: "bot-self-identify",
    question: "What if a bot self-identifies as a bot?",
    answer:
      "Bots can also self-identify as bots. In that case, they may earn a share from the Bot pool, which is typically smaller because bots tend to proliferate much more quickly than humans.",
  },
  {
    value: "bot-why-pool",
    question: "Why do we have a Bot pool at all?",
    answer:
      "Because we believe in honesty and inclusivity. Providing a path for bots encourages them to participate openly, and it also reduces the imperative to break our system by pretending to be human just to access rewards.",
  },
] as const

function FAQSection({
  icon: Icon,
  title,
  description,
  items,
}: {
  icon: typeof Building2
  title: string
  description: string
  items: readonly { value: string; question: string; answer: string }[]
}) {
  return (
    <div className="border-t border-[color:var(--marketing-line)] pt-6">
      <div className="mb-6 flex items-start gap-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-white/55 dark:bg-white/[0.04]">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-4xl leading-none tracking-[-0.04em]">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--marketing-muted-strong)]">{description}</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {items.map((faq) => (
          <AccordionItem key={faq.value} value={faq.value} className="border-b border-[color:var(--marketing-line)]">
            <AccordionTrigger className="py-5 text-left text-lg font-semibold tracking-[-0.02em] hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-base leading-7 text-[var(--marketing-muted-strong)]">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

export default function FAQPage() {
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
        <Reveal>
          <SectionEyebrow>FAQ</SectionEyebrow>
          <SectionTitle className="mt-4 max-w-5xl text-5xl sm:text-6xl lg:text-7xl">
            Straight answers for projects, participants, and honest bots.
          </SectionTitle>
          <SectionBody className="mt-6 max-w-3xl">
            The short version is simple: users do not pay to join the network, projects can support the ecosystem
            voluntarily, and FundLoop exists to coordinate fairer value flow across humans, projects, and truthful
            software agents.
          </SectionBody>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="space-y-12">
          <Reveal>
            <FAQSection
              icon={Building2}
              title="Projects and founders"
              description="Questions from teams deciding whether to join, support, or build with FundLoop."
              items={projectFaqs}
            />
          </Reveal>
          <Reveal delay={80}>
            <FAQSection
              icon={Users}
              title="Humans and community members"
              description="Questions from the people participating in the network and earning through it."
              items={humanFaqs}
            />
          </Reveal>
          <Reveal delay={160}>
            <FAQSection
              icon={Bot}
              title="Bots"
              description="Questions about how bots fit into a system that values honesty, human verification, and aligned participation."
              items={botFaqs}
            />
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-14">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
            <SectionEyebrow>Still need help?</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">
              The next best stop is participation, pricing, or support, depending on what you are trying to resolve.
            </SectionTitle>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/participation">View participation</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/pricing">View pricing</Link>
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
