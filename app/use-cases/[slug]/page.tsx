import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Building2, HeartHandshake, ShieldCheck, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getUseCaseBySlug, useCases } from "@/lib/use-cases"

const iconMap = {
  fairdrops: Sparkles,
  "proof-of-humanity": ShieldCheck,
  "community-engagement": Users,
  "give-back": HeartHandshake,
  "viral-growth": Building2,
} as const

export function generateStaticParams() {
  return useCases.map((useCase) => ({ slug: useCase.slug }))
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const useCase = getUseCaseBySlug(slug)

  if (!useCase) {
    notFound()
  }

  const Icon = iconMap[useCase.slug]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/#use-cases">
                <ArrowLeft className="h-4 w-4" />
                Back to Use Cases
              </Link>
            </Button>
          </div>

          <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Icon className="h-3.5 w-3.5" />
                  {useCase.eyebrow}
                </div>
                <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
                  {useCase.label}
                </h1>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{useCase.hero}</p>
              </div>

              <Card className="border-slate-200/80 bg-slate-50 shadow-none dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">What this unlocks</p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {useCase.outcomes.map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">How it works</h2>
                <div className="mt-4 space-y-4 text-base leading-7 text-slate-600 dark:text-slate-300">
                  {useCase.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Why teams use it</h2>
                <ul className="mt-4 space-y-4 text-base leading-7 text-slate-600 dark:text-slate-300">
                  {useCase.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          <section className="mt-8 rounded-[2rem] border border-emerald-200 bg-emerald-50 px-6 py-8 dark:border-emerald-900/60 dark:bg-emerald-950/20 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ready to apply this in your project?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Create a project profile and we can connect the right onboarding, identity, and payout workflows.
                </p>
              </div>
              <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Link href="/#project-signup">
                  Join as a Project
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
