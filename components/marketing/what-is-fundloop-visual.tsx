"use client"

import { useState } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Building2, Coins, Repeat, Sparkles, TrendingUp, Users, Wallet } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

export type LoopNodeInfo = {
  title: string
  body: string
}

export type WhatIsFundLoopVisualProps = {
  projectLabel?: string
  participantLabel?: string
  projectCta: string
  participantCta: string
  nodes: {
    people: LoopNodeInfo
    participation: LoopNodeInfo
    projects: LoopNodeInfo
    fundloop: LoopNodeInfo
    step1?: LoopNodeInfo
    step2?: LoopNodeInfo
    step3?: LoopNodeInfo
    step4?: LoopNodeInfo
  }
  actionBar?: {
    participantFocus: { title: string; body: string }
    projectFocus: { title: string; body: string }
    defaultFocus: { title: string; body: string }
  }
  nextLabel?: string
  loopsToStartLabel?: string
  protocolBadge?: string
  cubidVerifiedBadge?: string
}

export function WhatIsFundLoopVisual({
  projectLabel = "Projects & Companies",
  participantLabel = "People & Participants",
  projectCta,
  participantCta,
  nodes,
  actionBar,
  nextLabel = "Next",
  loopsToStartLabel = "Loops to Start",
  protocolBadge = "FundLoop Continuous Coordination",
  cubidVerifiedBadge = "CUBID Verified",
}: WhatIsFundLoopVisualProps) {
  const [hoveredStep, setHoveredStep] = useState<1 | 2 | 3 | 4 | null>(null)

  const step1 = nodes.step1 ?? nodes.people
  const step2 = nodes.step2 ?? nodes.participation
  const step3 = nodes.step3 ?? nodes.projects
  const step4 = nodes.step4 ?? nodes.fundloop

  const isParticipantHovered = hoveredStep === 1 || hoveredStep === 4
  const isProjectHovered = hoveredStep === 2 || hoveredStep === 3

  const actionTitle = isParticipantHovered
    ? actionBar?.participantFocus.title ?? "Participant Focus"
    : isProjectHovered
      ? actionBar?.projectFocus.title ?? "Project Focus"
      : actionBar?.defaultFocus.title ?? "Choose Your Role in the Loop"

  const actionBody = isParticipantHovered
    ? actionBar?.participantFocus.body ?? "Participate in verified projects and build eligibility for monthly distributions."
    : isProjectHovered
      ? actionBar?.projectFocus.body ?? "Pool 1% of revenue, attract high-intent organic users, and grow community alignment."
      : actionBar?.defaultFocus.body ?? "Hover any step above to explore that phase, or select your path to get started."

  return (
    <div className="relative mx-auto mt-10 max-w-6xl overflow-hidden rounded-[2.5rem] border border-[color:var(--marketing-line)] bg-gradient-to-b from-[#141d1b] via-[#101b1a] to-[#0c1413] p-6 text-[#fff9ef] shadow-2xl sm:p-10">
      {/* Background ambient glow highlights based on active step hover */}
      <div
        className={cn(
          "pointer-events-none absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-emerald-500/15 blur-[100px] transition-all duration-500",
          isParticipantHovered ? "opacity-100 scale-110" : "opacity-30",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-[#ff7844]/15 blur-[100px] transition-all duration-500",
          isProjectHovered ? "opacity-100 scale-110" : "opacity-30",
        )}
      />

      {/* Center Loop Diagram */}
      <div className="relative">
        {/* Desktop 2x2 Cyclical Loop Grid */}
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">
          {/* Step 1: People participate in projects (Top-Left) */}
          <div
            onMouseEnter={() => setHoveredStep(1)}
            onMouseLeave={() => setHoveredStep((curr) => (curr === 1 ? null : curr))}
            className={cn(
              "group relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 sm:p-7",
              hoveredStep === 1
                ? "border-[#34d399] bg-emerald-950/40 shadow-[0_0_35px_rgba(52,211,153,0.2)] ring-1 ring-[#34d399]"
                : "border-white/10 bg-white/[0.03] hover:border-[#34d399]/50 hover:bg-emerald-950/20",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#34d399]/40 bg-[#34d399]/15 text-[#34d399] shadow-sm">
                  <Users className="h-6 w-6" />
                </span>
                <span className="rounded-full border border-[#34d399]/30 bg-[#34d399]/10 px-3 py-0.5 text-xs font-semibold text-[#34d399]">
                  {participantLabel}
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-1 text-xs font-semibold text-[#34d399]/80">
                <span>{nextLabel}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-display text-lg font-bold text-white sm:text-xl">{step1.title}</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#c7d5cf]">{step1.body}</p>
            </div>
          </div>

          {/* Step 2: Projects collect revenue (Top-Right) */}
          <div
            onMouseEnter={() => setHoveredStep(2)}
            onMouseLeave={() => setHoveredStep((curr) => (curr === 2 ? null : curr))}
            className={cn(
              "group relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 sm:p-7",
              hoveredStep === 2
                ? "border-[#ff7844] bg-orange-950/40 shadow-[0_0_35px_rgba(255,120,68,0.2)] ring-1 ring-[#ff7844]"
                : "border-white/10 bg-white/[0.03] hover:border-[#ff7844]/50 hover:bg-orange-950/20",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#ff7844]/40 bg-[#ff7844]/15 text-[#ff7844] shadow-sm">
                  <TrendingUp className="h-6 w-6" />
                </span>
                <span className="rounded-full border border-[#ff7844]/30 bg-[#ff7844]/10 px-3 py-0.5 text-xs font-semibold text-[#ff7844]">
                  {projectLabel}
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-1 text-xs font-semibold text-[#ff7844]/80">
                <span>{nextLabel}</span>
                <ArrowDown className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-y-1" />
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-display text-lg font-bold text-white sm:text-xl">{step2.title}</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#dbe3df]">{step2.body}</p>
            </div>
          </div>

          {/* Step 4: People get paid (Bottom-Left) */}
          <div
            onMouseEnter={() => setHoveredStep(4)}
            onMouseLeave={() => setHoveredStep((curr) => (curr === 4 ? null : curr))}
            className={cn(
              "group relative order-last lg:order-3 flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 sm:p-7",
              hoveredStep === 4
                ? "border-[#34d399] bg-emerald-950/40 shadow-[0_0_35px_rgba(52,211,153,0.2)] ring-1 ring-[#34d399]"
                : "border-white/10 bg-white/[0.03] hover:border-[#34d399]/50 hover:bg-emerald-950/20",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#34d399]/40 bg-[#34d399]/15 text-[#34d399] shadow-sm">
                  <Wallet className="h-6 w-6" />
                </span>
                <span className="rounded-full border border-[#34d399]/30 bg-[#34d399]/10 px-3 py-0.5 text-xs font-semibold text-[#34d399]">
                  {participantLabel}
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-1 text-xs font-semibold text-[#34d399]/80">
                <ArrowUp className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-1" />
                <span>{loopsToStartLabel}</span>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-display text-lg font-bold text-white sm:text-xl">{step4.title}</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#c7d5cf]">{step4.body}</p>
            </div>
          </div>

          {/* Step 3: Projects reward community through FundLoop (Bottom-Right) */}
          <div
            onMouseEnter={() => setHoveredStep(3)}
            onMouseLeave={() => setHoveredStep((curr) => (curr === 3 ? null : curr))}
            className={cn(
              "group relative order-3 lg:order-4 flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 sm:p-7",
              hoveredStep === 3
                ? "border-[#ff7844] bg-orange-950/40 shadow-[0_0_35px_rgba(255,120,68,0.2)] ring-1 ring-[#ff7844]"
                : "border-white/10 bg-white/[0.03] hover:border-[#ff7844]/50 hover:bg-orange-950/20",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#ff7844]/40 bg-[#ff7844]/15 text-[#ff7844] shadow-sm">
                  <Coins className="h-6 w-6" />
                </span>
                <span className="rounded-full border border-[#ff7844]/30 bg-[#ff7844]/10 px-3 py-0.5 text-xs font-semibold text-[#ff7844]">
                  {projectLabel}
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-1 text-xs font-semibold text-[#ff7844]/80">
                <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
                <span>{nextLabel}</span>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-display text-lg font-bold text-white sm:text-xl">{step3.title}</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#dbe3df]">{step3.body}</p>
            </div>
          </div>
        </div>

        {/* Central Protocol Badge Indicator */}
        <div className="mt-8 flex items-center justify-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2 text-xs font-medium text-[#c7d5cf] shadow-inner backdrop-blur-md">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--marketing-accent)]/20 text-[var(--marketing-accent)]">
              <Repeat className="h-3.5 w-3.5 animate-[spin_12s_linear_infinite]" />
            </span>
            <span className="font-display font-semibold text-white">{protocolBadge}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold text-[#f5b195]">
              <Sparkles className="h-2.5 w-2.5" />
              {cubidVerifiedBadge}
            </span>
          </div>
        </div>

        {/* Dynamic Contextual Action Bar Correlated to Hovered Step */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-6 transition-all duration-300">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#a3b8b0]">
                  {actionTitle}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#c7d5cf]">
                {actionBody}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Participant CTA button */}
              <Link
                href="/?onboarding=user"
                className={cn(
                  "group flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs sm:text-sm font-semibold transition-all duration-200",
                  isParticipantHovered
                    ? "bg-[#059669] text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400 hover:bg-[#10b981]"
                    : "border border-[#34d399]/40 bg-[#34d399]/15 text-[#34d399] hover:bg-[#059669] hover:text-white",
                )}
              >
                <Users className="h-4 w-4" />
                <span>{participantCta}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>

              {/* Project CTA button */}
              <Link
                href="/?onboarding=project"
                className={cn(
                  "group flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs sm:text-sm font-semibold transition-all duration-200",
                  isProjectHovered
                    ? "bg-[#d45f35] text-white shadow-lg shadow-orange-950/60 ring-2 ring-orange-400 hover:bg-[#e06b40]"
                    : "border border-[#ff7844]/40 bg-[#ff7844]/15 text-[#ff7844] hover:bg-[#d45f35] hover:text-white",
                )}
              >
                <Building2 className="h-4 w-4" />
                <span>{projectCta}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
