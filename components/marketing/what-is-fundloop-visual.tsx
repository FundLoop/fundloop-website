"use client"

import { useState } from "react"
import { ArrowRight, Building2, CheckCircle2, Coins, Repeat, Sparkles, UserRound, Users } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type NodeInfo = {
  title: string
  body: string
}

export type WhatIsFundLoopVisualProps = {
  projectLabel: string
  participantLabel: string
  projectCta: string
  participantCta: string
  nodes: {
    people: NodeInfo
    participation: NodeInfo
    projects: NodeInfo
    fundloop: NodeInfo
  }
}

export function WhatIsFundLoopVisual({
  projectLabel,
  participantLabel,
  projectCta,
  participantCta,
  nodes,
}: WhatIsFundLoopVisualProps) {
  const [hoveredSide, setHoveredSide] = useState<"project" | "participant" | null>(null)

  return (
    <div className="relative mx-auto mt-10 max-w-6xl overflow-hidden rounded-[2.5rem] border border-[color:var(--marketing-line)] bg-gradient-to-b from-[#141d1b] via-[#101b1a] to-[#0c1413] p-6 text-[#fff9ef] shadow-2xl sm:p-10">
      {/* Background ambient glow highlights based on active hover */}
      <div
        className={cn(
          "pointer-events-none absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-emerald-500/15 blur-[100px] transition-opacity duration-500",
          hoveredSide === "participant" ? "opacity-100 scale-110" : "opacity-40",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-[#ff7844]/15 blur-[100px] transition-opacity duration-500",
          hoveredSide === "project" ? "opacity-100 scale-110" : "opacity-40",
        )}
      />

      {/* Main Diagram Area */}
      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        {/* Left Side: Participant / User Persona Area */}
        <div
          onMouseEnter={() => setHoveredSide("participant")}
          onMouseLeave={() => setHoveredSide((current) => (current === "participant" ? null : current))}
          className={cn(
            "relative flex flex-col justify-between rounded-3xl border p-6 sm:p-7 transition-all duration-300",
            hoveredSide === "participant"
              ? "border-[#34d399]/60 bg-emerald-950/30 shadow-[0_0_35px_rgba(52,211,153,0.15)] ring-1 ring-[#34d399]/40"
              : "border-white/10 bg-white/[0.03] hover:border-[#34d399]/40 hover:bg-emerald-950/20",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#34d399]/40 bg-[#34d399]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#34d399]">
              <Users className="h-3.5 w-3.5" />
              {participantLabel}
            </span>
            <span className="text-[0.68rem] font-semibold uppercase tracking-widest text-[#a3b8b0]">
              Step 01 &amp; 04
            </span>
          </div>

          <div className="mt-6 space-y-6">
            {/* Node 1: People */}
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#34d399]/30 bg-[#34d399]/15 text-[#34d399]">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h4 className="font-display text-lg font-bold text-white sm:text-xl">
                  {nodes.people.title}
                </h4>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#c7d5cf]">
                  {nodes.people.body}
                </p>
              </div>
            </div>

            {/* Node 4: Mutual Distribution */}
            <div className="border-t border-white/10 pt-5 flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#34d399]/30 bg-[#34d399]/15 text-[#34d399]">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <h4 className="font-display text-lg font-bold text-white sm:text-xl">
                  {nodes.fundloop.title}
                </h4>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#c7d5cf]">
                  {nodes.fundloop.body}
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Participant CTA */}
          <div className="mt-7 pt-5 border-t border-white/10">
            <Link
              href="/?onboarding=user"
              className={cn(
                "group flex w-full items-center justify-between rounded-2xl px-5 py-4 text-xs sm:text-sm font-semibold transition-all duration-200",
                hoveredSide === "participant"
                  ? "bg-[#059669] text-white shadow-lg shadow-emerald-900/40 hover:bg-[#10b981]"
                  : "border border-[#34d399]/40 bg-[#34d399]/15 text-[#34d399] hover:bg-[#059669] hover:text-white",
              )}
            >
              <span className="flex-1 text-left leading-snug">{participantCta}</span>
              <ArrowRight className="ml-2 h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Center Hub: The FundLoop Core */}
        <div className="relative flex flex-col items-center justify-center py-4 lg:py-0">
          <div className="relative flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-full border border-white/20 bg-gradient-to-tr from-[#1a2523] via-[#101b1a] to-[#201c18] shadow-[0_0_50px_rgba(212,95,53,0.15)]">
            {/* Spinning Outer Ring */}
            <div className="absolute inset-[-6px] rounded-full border border-dashed border-white/20 animate-[spin_40s_linear_infinite]" />
            <div className="text-center p-3">
              <div className="mx-auto flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-[color:var(--marketing-accent)]/50 bg-[color:var(--marketing-accent)]/20 text-[var(--marketing-accent)] shadow-sm">
                <Repeat className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <p className="mt-1 font-display text-sm sm:text-base font-bold tracking-tight text-white">
                FundLoop
              </p>
              <p className="text-[0.55rem] font-semibold uppercase tracking-widest text-[#f5b195]">
                Protocol
              </p>
            </div>
          </div>

          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-[#a0b0a8]">
              <Sparkles className="h-2.5 w-2.5 text-[#f5b195]" />
              CUBID Verified
            </span>
          </div>
        </div>

        {/* Right Side: Project / Company Persona Area */}
        <div
          onMouseEnter={() => setHoveredSide("project")}
          onMouseLeave={() => setHoveredSide((current) => (current === "project" ? null : current))}
          className={cn(
            "relative flex flex-col justify-between rounded-3xl border p-6 sm:p-7 transition-all duration-300",
            hoveredSide === "project"
              ? "border-[#ff7844]/60 bg-orange-950/30 shadow-[0_0_35px_rgba(255,120,68,0.15)] ring-1 ring-[#ff7844]/40"
              : "border-white/10 bg-white/[0.03] hover:border-[#ff7844]/40 hover:bg-orange-950/20",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#ff7844]/40 bg-[#ff7844]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#ff7844]">
              <Building2 className="h-3.5 w-3.5" />
              {projectLabel}
            </span>
            <span className="text-[0.68rem] font-semibold uppercase tracking-widest text-[#d8b8ac]">
              Step 02 &amp; 03
            </span>
          </div>

          <div className="mt-6 space-y-6">
            {/* Node 2: Participation */}
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#ff7844]/30 bg-[#ff7844]/15 text-[#ff7844]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <h4 className="font-display text-lg font-bold text-white sm:text-xl">
                  {nodes.participation.title}
                </h4>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#dbe3df]">
                  {nodes.participation.body}
                </p>
              </div>
            </div>

            {/* Node 3: Projects */}
            <div className="border-t border-white/10 pt-5 flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#ff7844]/30 bg-[#ff7844]/15 text-[#ff7844]">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h4 className="font-display text-lg font-bold text-white sm:text-xl">
                  {nodes.projects.title}
                </h4>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#dbe3df]">
                  {nodes.projects.body}
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Project CTA */}
          <div className="mt-7 pt-5 border-t border-white/10">
            <Link
              href="/?onboarding=project"
              className={cn(
                "group flex w-full items-center justify-between rounded-2xl px-5 py-4 text-xs sm:text-sm font-semibold transition-all duration-200",
                hoveredSide === "project"
                  ? "bg-[#d45f35] text-white shadow-lg shadow-orange-950/50 hover:bg-[#e06b40]"
                  : "border border-[#ff7844]/40 bg-[#ff7844]/15 text-[#ff7844] hover:bg-[#d45f35] hover:text-white",
              )}
            >
              <span className="flex-1 text-left leading-snug">{projectCta}</span>
              <ArrowRight className="ml-2 h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
