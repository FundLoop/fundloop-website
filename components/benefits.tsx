import type React from "react"
import Link from "next/link"
import { Building2, Users, Globe2, Sprout } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface BenefitsProps {
  id?: string
}

export default function Benefits({ id }: BenefitsProps) {
  return (
    <div id={id} className="container mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Benefits for Everyone</h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-[800px] mx-auto">
          FundLoop creates a virtuous cycle where everyone benefits from participation in the network.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/blog/how-fundloop-benefits-projects?origin=benefits" className="h-full">
          <BenefitCard
            icon={<Building2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />}
            title="For Projects"
            description="Gain access to a growing network of engaged users, increase user retention and satisfaction, and build a sustainable business model with positive social impact."
            benefits={[
              "Expanded user base through network effects",
              "Higher user retention and engagement",
              "Positive brand association and impact",
              "Competitive advantage in the market",
            ]}
          />
        </Link>

        <Link href="/blog/how-fundloop-benefits-people?origin=benefits" className="h-full">
          <BenefitCard
            icon={<Users className="h-10 w-10 text-cyan-600 dark:text-cyan-400" />}
            title="For People"
            description="Receive a monthly citizen salary just for being active in the ecosystem, discover aligned projects and services, and participate in a new economic model."
            benefits={[
              "Monthly citizen salary payments",
              "Access to aligned products and services",
              "Voice in governance of the network",
              "Participation in a new economic model",
            ]}
          />
        </Link>

        <Link href="/blog/how-fundloop-benefits-the-world?origin=benefits" className="h-full">
          <BenefitCard
            icon={<Globe2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />}
            title="For the Planet"
            description="Support sustainable development, fund environmental initiatives through network governance, and create economic incentives aligned with planetary health."
            benefits={[
              "Funding for environmental initiatives",
              "Incentives aligned with sustainability",
              "Support for regenerative economics",
              "Collective action on global challenges",
            ]}
          />
        </Link>

        <Link href="/blog/how-fundloop-benefits-allo?origin=benefits" className="h-full">
          <BenefitCard
            icon={<Sprout className="h-10 w-10 text-green-600 dark:text-green-400" />}
            title="For the Network"
            description="Build a self-sustaining digital nation with shared prosperity, create a new model for economic cooperation, and demonstrate the power of network states."
            benefits={[
              "Self-sustaining economic model",
              "Growing collective influence",
              "Demonstration of network state viability",
              "Creation of shared digital infrastructure",
            ]}
          />
        </Link>
      </div>
    </div>
  )
}

interface BenefitCardProps {
  icon: React.ReactNode
  title: string
  description: string
  benefits: string[]
}

function BenefitCard({ icon, title, description, benefits }: BenefitCardProps) {
  return (
    <Card className="h-full transition-transform transform hover:scale-105 hover:shadow-lg">
      <CardHeader>
        <div className="mb-2">{icon}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col justify-between">
        <ul className="space-y-2">
          {benefits.map((benefit, index) => (
            <li key={index} className="flex items-start">
              <div className="mr-2 mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <span className="text-sm text-slate-600 dark:text-slate-300">{benefit}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline mt-4 self-start transition-colors">
          Read more
        </p>
      </CardContent>
    </Card>
  )
}
