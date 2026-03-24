"use client"

import { ArrowRight } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

function buildUrl(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

export default function Hero() {
  const pathname = usePathname()
  const router = useRouter()

  const openFlow = (flow: "user" | "project") => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set("onboarding", flow)
    router.push(buildUrl(pathname, nextParams), { scroll: false })
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 dark:from-emerald-500/10 dark:to-cyan-500/10" />
      <div className="container relative mx-auto px-4 py-24 md:py-32 flex flex-col items-center text-center">
        <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-6">
          Introducing FundLoop
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400">
          A Network State for Mutual Prosperity
        </h1>
        <p className="max-w-[800px] text-slate-600 dark:text-slate-300 text-lg md:text-xl mb-8">
          Join a regenerative ecosystem where projects contribute to people, people support meaningful projects, and
          onboarding now actually meets you where you are.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            size="lg"
            className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
            onClick={() => openFlow("project")}
          >
            Join as a Project <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" size="lg" onClick={() => openFlow("user")}>
            Join as a User <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <p className="mt-6 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          New onboarding drafts save automatically. If you step away, FundLoop will bring you back to the last screen
          the next time you return.
        </p>
      </div>
    </div>
  )
}
