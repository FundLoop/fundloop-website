import Link from "next/link"
import { ArrowLeft, ArrowRight, Coins, HeartHandshake, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>

          <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">Pricing</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
              FundLoop is free to use forever for users.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              This is the platform you come to to get money, not pay money. If you are a user participating in the
              ecosystem, creating a profile, exploring projects, and becoming eligible for distributions should never
              come with a FundLoop platform fee.
            </p>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-3">
            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Users className="h-5 w-5" />
                </div>
                <CardTitle>For Users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Free forever. FundLoop is designed so users can receive value, not be charged for access to the
                  network.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <HeartHandshake className="h-5 w-5" />
                </div>
                <CardTitle>For Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  FundLoop is funded on a voluntary basis. We ask projects to support the system when they are able,
                  rather than gating participation behind mandatory SaaS pricing.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Coins className="h-5 w-5" />
                </div>
                <CardTitle>Transfer Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Payment processor fees for fiat and gas fees for crypto are real network costs and come out of the
                  funds transferred out from the platform.
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="mt-8 rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-10">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">How project funding works</h2>
              <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
                FundLoop is funded on a voluntary basis. We recommend that projects allow us to divert 1% or more of
                their distributed funds to the community of people who work to operate FundLoop, and another 1% or more
                to the treasury used to fund promising new projects that have taken the 1% pledge but have not yet
                become profitable.
              </p>
              <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
                That structure is meant to keep the platform sustainable without turning FundLoop into a paywall. It
                supports the operators keeping the system alive today while also helping new aligned projects get far
                enough to contribute back into the loop.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">1%+ to operators</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Supports the people and workflows required to operate FundLoop, maintain infrastructure, and help the
                  ecosystem function reliably.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">1%+ to the treasury</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Funds promising new projects that have already taken the pledge but have not yet reached profitability,
                  helping the network grow in a principled way.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50/70 p-8 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20 md:p-10">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Fees on money movement</h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              Towards the point where money actually moves, there are unavoidable transaction costs. Payment processor
              fees apply when moving fiat money, and gas fees apply when moving crypto. Those costs come out of the
              funds transferred out from our platform rather than being charged as a separate subscription.
            </p>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              We want the pricing model to stay easy to understand: users do not pay to participate, projects are asked
              to support the ecosystem voluntarily, and transfer rails carry their own direct execution costs.
            </p>
          </section>

          <section className="mt-8 flex flex-col gap-4 rounded-[2rem] border border-emerald-200 bg-emerald-50 px-6 py-8 dark:border-emerald-900/60 dark:bg-emerald-950/20 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Want to join as a project?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                If your team wants to participate in the loop and support shared prosperity, start with a project
                profile.
              </p>
            </div>
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href="/#project-signup">
                Join as a Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </section>
        </div>
      </div>
    </div>
  )
}
