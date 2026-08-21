import { Coins, Infinity, ShieldCheck, Sparkles, TrendingUp, Users, Wallet } from "lucide-react"

export type WhatIsFundLoopDiagramProps = {
  stages: {
    people: { title: string; subtitle: string }
    projectsRevenue: { title: string; subtitle: string }
    projectsReward: { title: string; subtitle: string }
    peopleRewards: { title: string; subtitle: string }
  }
  center: {
    cubidLabel: string
    cubidDesc: string
    allocatorLabel: string
    allocatorDesc: string
  }
  tagline: string
  subtagline: string
}

export function WhatIsFundLoopDiagram({
  stages,
  center,
  tagline,
  subtagline,
}: WhatIsFundLoopDiagramProps) {
  return (
    <div className="relative mx-auto mt-10 max-w-5xl overflow-hidden rounded-[2.5rem] border border-[color:var(--marketing-line)] bg-gradient-to-b from-[#141d1b] via-[#101b1a] to-[#0c1413] p-6 text-[#fff9ef] shadow-2xl sm:p-10">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-[90px]" />
      <div className="pointer-events-none absolute -right-20 top-1/4 h-80 w-80 rounded-full bg-[#ff7844]/10 blur-[90px]" />

      {/* Main Circular Diagram Canvas */}
      <div className="relative mx-auto max-w-4xl py-4 sm:py-8">
        <div className="grid gap-6 sm:gap-10 grid-cols-1 md:grid-cols-2">
          {/* Stage 1: People Participate (Top-Left) */}
          <div className="relative flex flex-col items-center justify-between rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center shadow-lg sm:p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-md">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold text-white sm:text-2xl">
              {stages.people.title}
            </h3>
            <p className="mt-1 text-sm font-medium text-emerald-200/90">
              {stages.people.subtitle}
            </p>
          </div>

          {/* Stage 2: Projects Collect Revenue (Top-Right) */}
          <div className="relative flex flex-col items-center justify-between rounded-3xl border border-orange-500/30 bg-orange-950/20 p-6 text-center shadow-lg sm:p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-400/40 bg-orange-500/15 text-orange-300 shadow-md">
              <TrendingUp className="h-8 w-8" />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold text-white sm:text-2xl">
              {stages.projectsRevenue.title}
            </h3>
            <p className="mt-1 text-sm font-medium text-orange-200/90">
              {stages.projectsRevenue.subtitle}
            </p>
          </div>

          {/* Stage 4: People Receive Credited Rewards (Bottom-Left) */}
          <div className="relative order-last md:order-3 flex flex-col items-center justify-between rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center shadow-lg sm:p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-md">
              <Wallet className="h-8 w-8" />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold text-white sm:text-2xl">
              {stages.peopleRewards.title}
            </h3>
            <p className="mt-1 text-sm font-medium text-emerald-200/90">
              {stages.peopleRewards.subtitle}
            </p>
          </div>

          {/* Stage 3: Projects Reward Community 1% (Bottom-Right) */}
          <div className="relative order-3 md:order-4 flex flex-col items-center justify-between rounded-3xl border border-orange-500/30 bg-orange-950/20 p-6 text-center shadow-lg sm:p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-400/40 bg-orange-500/15 text-orange-300 shadow-md">
              <Coins className="h-8 w-8" />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold text-white sm:text-2xl">
              {stages.projectsReward.title}
            </h3>
            <p className="mt-1 text-sm font-medium text-orange-200/90">
              {stages.projectsReward.subtitle}
            </p>
          </div>
        </div>

        {/* Central Coordination Badge */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3.5 shadow-inner backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Infinity className="h-5 w-5 text-[#ff7844]" />
              <span className="font-display font-bold text-white">FundLoop</span>
            </div>
            <span className="hidden sm:inline text-white/20">•</span>
            <div className="flex items-center gap-1.5 text-xs text-[#cbd8d3]">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-white">{center.cubidLabel}:</span>
              <span>{center.cubidDesc}</span>
            </div>
            <span className="hidden sm:inline text-white/20">•</span>
            <div className="flex items-center gap-1.5 text-xs text-[#cbd8d3]">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="font-semibold text-white">{center.allocatorLabel}:</span>
              <span>{center.allocatorDesc}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Continuous Cycle Tagline */}
      <div className="mt-4 border-t border-white/10 pt-6 text-center">
        <p className="font-display text-lg sm:text-xl font-bold text-[#fff9ef]">
          {tagline}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.25em] text-[#ff7844]">
          {subtagline}
        </p>
      </div>
    </div>
  )
}
