"use client"

import { useState } from "react"
import { ArrowRight, Coins, Compass, HeartHandshake, Repeat, ShieldCheck, Sparkles } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type NodeInfo = {
  step: string
  title: string
  body: string
}

export type FundloopForUsersVisualProps = {
  eyebrow: string
  title: string
  body: string
  cta: string
  center: string
  centerSubtext?: string
  stageLabel?: string
  nodes: {
    find: NodeInfo
    signup: NodeInfo
    participate: NodeInfo
    reward: NodeInfo
  }
}

export function FundloopForUsersVisual({
  eyebrow,
  title,
  body,
  cta,
  center,
  centerSubtext = "CUBID Verified • Governed Monthly Distribution",
  stageLabel = "Stage {num} of 4",
  nodes,
}: FundloopForUsersVisualProps) {
  const [activeStep, setActiveStep] = useState<number | null>(null)

  const stepsList = [
    { key: "find", info: nodes.find, icon: Compass, num: 1 },
    { key: "signup", info: nodes.signup, icon: ShieldCheck, num: 2 },
    { key: "participate", info: nodes.participate, icon: HeartHandshake, num: 3 },
    { key: "reward", info: nodes.reward, icon: Coins, num: 4 },
  ]

  return (
    <div className="relative mx-auto my-12 max-w-6xl overflow-hidden rounded-[2.5rem] border border-[#34d399]/20 bg-gradient-to-b from-[#111c19] via-[#0d1614] to-[#0a100f] p-6 text-[#fff9ef] shadow-2xl sm:p-10">
      {/* Ambient glowing highlights */}
      <div className="pointer-events-none absolute -left-20 top-1/3 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-[#7eafcb]/10 blur-[120px]" />

      {/* Header section inside card */}
      <div className="text-center max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#34d399]/40 bg-[#34d399]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#34d399]">
          <Sparkles className="h-3.5 w-3.5" />
          {eyebrow}
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#c2d5cd]">
          {body}
        </p>
      </div>

      {/* 4-Step Loop Flow Grid */}
      <div className="relative mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stepsList.map((item, index) => {
          const Icon = item.icon
          const isHovered = activeStep === index
          const formattedStage = stageLabel.replace("{num}", String(item.num))

          return (
            <div
              key={item.key}
              onMouseEnter={() => setActiveStep(index)}
              onMouseLeave={() => setActiveStep(null)}
              className={cn(
                "relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300",
                isHovered
                  ? "border-[#34d399]/60 bg-emerald-950/40 shadow-[0_0_30px_rgba(52,211,153,0.15)] ring-1 ring-[#34d399]/40 scale-[1.02]"
                  : "border-white/10 bg-white/[0.03] hover:border-[#34d399]/40 hover:bg-emerald-950/20",
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#34d399]/30 bg-[#34d399]/15 text-[#34d399]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-[#34d399]/30 bg-[#34d399]/10 px-2.5 py-0.5 text-xs font-bold text-[#34d399]">
                    {item.info.step}
                  </span>
                </div>

                <h3 className="mt-5 font-display text-lg font-bold text-white">
                  {item.info.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#cbd8d3]">
                  {item.info.body}
                </p>
              </div>

              {/* Connecting Flow Arrow indicator */}
              <div className="mt-6 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-widest text-[#34d399]">
                <span>{formattedStage}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Action Strip with Center Hub Badge */}
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#34d399]/40 bg-[#34d399]/20 text-[#34d399]">
            <Repeat className="h-5 w-5 animate-[spin_30s_linear_infinite]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{center}</p>
            <p className="text-xs text-[#a0b0a8]">{centerSubtext}</p>
          </div>
        </div>

        <Link
          href="/?onboarding=user"
          className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#059669] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-[#10b981] transition-all"
        >
          <span>{cta}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  )
}
