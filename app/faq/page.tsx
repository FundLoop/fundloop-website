import Link from "next/link"
import { ArrowLeft, ArrowRight, Bot, Building2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

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
]

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
]

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
]

function FAQSection({
  icon: Icon,
  title,
  description,
  items,
}: {
  icon: typeof Building2
  title: string
  description: string
  items: { value: string; question: string; answer: string }[]
}) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-5 flex items-start gap-4">
        <div className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full space-y-4">
        {items.map((faq) => (
          <AccordionItem key={faq.value} value={faq.value} className="rounded-lg border px-6">
            <AccordionTrigger className="py-4 text-left text-lg font-medium">{faq.question}</AccordionTrigger>
            <AccordionContent className="pb-4 leading-7 text-slate-600 dark:text-slate-300">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-12">
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Frequently Asked Questions</h1>
            <p className="mb-8 text-lg leading-8 text-slate-600 dark:text-slate-300">
              The short version of FundLoop is simple: users should not have to pay to join the network, projects can
              support the ecosystem voluntarily, and the platform exists to help coordinate fairer value flow across
              humans, projects, and even honest bots.
            </p>

            <FAQSection
              icon={Building2}
              title="Projects and Founders"
              description="Questions from teams deciding whether to join, support, or build with FundLoop."
              items={projectFaqs}
            />

            <FAQSection
              icon={Users}
              title="Humans and Community Members"
              description="Questions from the people participating in the network and earning through it."
              items={humanFaqs}
            />

            <FAQSection
              icon={Bot}
              title="Bots"
              description="Questions about how bots fit into a system that values honesty, human verification, and aligned participation."
              items={botFaqs}
            />

            <div className="mt-12 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <p className="text-slate-600 dark:text-slate-300">Need a pricing answer or a product clarification we did not cover?</p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild variant="outline">
                  <Link href="/pricing">View Pricing</Link>
                </Button>
                <Button asChild>
                  <Link href="/support">
                    Contact Support
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
