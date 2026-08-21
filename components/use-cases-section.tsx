import Link from "next/link"
import { ArrowRight, Building2, HeartHandshake, ShieldCheck, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCases } from "@/lib/use-cases"

const iconMap = {
  fairdrops: Sparkles,
  "proof-of-humanity": ShieldCheck,
  "community-engagement": Users,
  "give-back": HeartHandshake,
  "viral-growth": Building2,
} as const

export default function UseCasesSection() {
  return (
    <section className="py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">Use Cases</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">How projects can use FundLoop in practice</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            From fairer distributions to stronger anti-bot confidence, these are concrete ways teams can use FundLoop
            to coordinate value, trust, and growth.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {useCases.map((useCase) => {
          const Icon = iconMap[useCase.slug]

          return (
            <Card
              key={useCase.slug}
              className="flex h-full flex-col border-slate-200/80 bg-white/90 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950/80"
            >
              <CardHeader className="pb-3">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{useCase.eyebrow}</p>
                <CardTitle className="mt-2 text-xl">{useCase.label}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{useCase.description}</p>
                <div className="mt-6">
                  <Button asChild variant="outline" className="gap-2">
                    <Link href={useCase.href}>
                      Read More
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
