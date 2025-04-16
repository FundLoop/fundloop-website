import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ArrowLeft } from "lucide-react"

export default function FAQPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-slate-600 dark:text-slate-300 text-lg mb-8">
          Find answers to common questions about the FundLoop ecosystem.
        </p>

        <Accordion type="single" collapsible className="w-full space-y-4">
          <AccordionItem value="item-1" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-medium py-4">What is FundLoop?</AccordionTrigger>
            <AccordionContent className="text-slate-600 dark:text-slate-300 pb-4">
              FundLoop is a network state for mutual prosperity that connects projects and users in a sustainable
              economic ecosystem. Projects pledge 1% of their revenue to fund a universal airdropped citizen salary for
              all active members, creating a self-sustaining cycle of growth and shared prosperity.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-1a" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-medium py-4">Is this a perfect system?</AccordionTrigger>
            <AccordionContent className="text-slate-600 dark:text-slate-300 pb-4">
              It's a beautiful system in theory, but we're starting from scratch and will fly by the seat of our pants
              as we build it.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-medium py-4">How does the 1% pledge work?</AccordionTrigger>
            <AccordionContent className="text-slate-600 dark:text-slate-300 pb-4">
              Projects that join FundLoop commit to contributing 1% of their revenue to the ecosystem. This contribution
              is used to fund the airdropped citizen salary program, which distributes funds equally to all active users
              within the ecosystem. Projects can choose from various payment methods and billing frequencies to make
              their contributions.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-medium py-4">
              What is the airdropped citizen salary?
            </AccordionTrigger>
            <AccordionContent className="text-slate-600 dark:text-slate-300 pb-4">
              The airdropped citizen salary is a monthly payment distributed equally to all active users in the FundLoop
              ecosystem. It's funded by the 1% revenue contributions from projects. The amount varies based on the total
              funds collected and the number of active users, but it grows as more projects and users join the
              ecosystem.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-medium py-4">
              How do I qualify for the airdropped citizen salary?
            </AccordionTrigger>
            <AccordionContent className="text-slate-600 dark:text-slate-300 pb-4">
              To qualify for the airdropped citizen salary, you need to be an active member of the FundLoop ecosystem.
              This means creating a user profile, connecting with at least one project, and maintaining regular activity
              within the ecosystem. Activity can include using services from participating projects, contributing
              skills, or participating in governance.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-medium py-4">
              What benefits do projects get from joining?
            </AccordionTrigger>
            <AccordionContent className="text-slate-600 dark:text-slate-300 pb-4">
              Projects benefit from joining FundLoop in several ways: they gain access to a growing network of engaged
              users, increase user retention and satisfaction, build a positive brand association through social impact,
              and gain a competitive advantage in the market. The ecosystem creates a virtuous cycle where projects and
              users mutually benefit from participation.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-6" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-medium py-4">How is user data handled?</AccordionTrigger>
            <AccordionContent className="text-slate-600 dark:text-slate-300 pb-4">
              FundLoop takes data privacy seriously. User participation data is anonymized before being shared with
              projects in the ecosystem. Personal identifying information is never shared without explicit consent. All
              data handling complies with relevant privacy regulations, and users have control over their data through
              their account settings.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-7" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-medium py-4">
              Can I contribute my skills to the ecosystem?
            </AccordionTrigger>
            <AccordionContent className="text-slate-600 dark:text-slate-300 pb-4">
              Yes! FundLoop encourages users to actively contribute their skills to help grow the ecosystem. During the
              signup process, you can indicate your willingness to contribute and specify your skills in areas such as
              building, marketing, managing, governing, operating, testing, researching, educating, or supporting.
              Active contributors may receive additional benefits within the ecosystem.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-8" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-medium py-4">How is FundLoop governed?</AccordionTrigger>
            <AccordionContent className="text-slate-600 dark:text-slate-300 pb-4">
              FundLoop is governed by its community of projects and users. Major decisions about the ecosystem's
              direction, fund allocation, and policy changes are made through a democratic process where both projects
              and users have representation. The governance structure evolves as the ecosystem grows, with a focus on
              transparency, fairness, and collective prosperity.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-12 text-center">
          <p className="text-slate-600 dark:text-slate-300 mb-4">Don't see your question answered here?</p>
          <Button asChild>
            <Link href="/support">Contact Support</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
