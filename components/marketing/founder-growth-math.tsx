"use client"

import { useState } from "react"
import { ArrowRight, Megaphone, Sparkles } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { SectionEyebrow, SectionTitle, SectionBody } from "@/components/marketing/page-chrome"

export type FounderGrowthMathProps = {
  eyebrow?: string
  title?: string
  body?: string
}

export function FounderGrowthMathPanel({
  eyebrow = "Growth Economics",
  title = "The Math: Why Founders Join FundLoop Over Running Ads",
  body = "Compare redirecting a standard $1,000 monthly ad budget into FundLoop's value-sharing ecosystem vs. paying traditional ad platforms.",
}: FounderGrowthMathProps) {
  const [activeTab, setActiveTab] = useState<"comparison" | "steps">("comparison")

  return (
    <div className="rounded-[2.5rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(145deg,rgba(255,248,238,0.92),rgba(244,203,141,0.18))] p-6 shadow-[0_28px_90px_rgba(15,23,23,0.1)] dark:bg-[linear-gradient(145deg,rgba(14,24,23,0.96),rgba(239,139,87,0.09))] sm:p-10 lg:p-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl space-y-3">
          <SectionEyebrow className="text-[var(--marketing-accent)]">{eyebrow}</SectionEyebrow>
          <SectionTitle className="text-4xl sm:text-5xl">{title}</SectionTitle>
          <SectionBody className="text-base sm:text-lg">{body}</SectionBody>
        </div>

        {/* View Switcher */}
        <div className="inline-flex rounded-full border border-[color:var(--marketing-line-strong)] bg-white/40 p-1 dark:bg-white/[0.04]">
          <button
            type="button"
            onClick={() => setActiveTab("comparison")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "comparison"
                ? "bg-[var(--marketing-accent)] text-white"
                : "text-[var(--marketing-muted-strong)] hover:text-[var(--marketing-ink)]"
            }`}
          >
            Side-by-Side Model
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("steps")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "steps"
                ? "bg-[var(--marketing-accent)] text-white"
                : "text-[var(--marketing-muted-strong)] hover:text-[var(--marketing-ink)]"
            }`}
          >
            Step-by-Step Breakdown
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "comparison" ? (
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {/* Card A: Traditional Ads */}
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/50 p-6 dark:bg-white/[0.02] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-200/60 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                <Megaphone className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-muted)]">Option A</p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-[var(--marketing-ink)]">Traditional Ad Spend</h3>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">Starting User Base</span>
                <span className="font-semibold">1,000 total users (200 MAU @ 20%)</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">Monthly Ad Budget</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">$1,000 / month</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">New Signups Acquired</span>
                <span className="font-semibold">200 new users</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">New Active Users (20% MAU)</span>
                <span className="font-semibold">+40 active users</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">Resulting Growth</span>
                <span className="font-semibold text-neutral-600 dark:text-neutral-300">+20% growth (240 MAU total)</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-[var(--marketing-muted-strong)]">Ecosystem Network Effect</span>
                <span className="font-semibold text-neutral-500">None (Zero cross-promotion)</span>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-neutral-100/80 p-4 text-center dark:bg-neutral-900/60">
              <p className="text-xs uppercase tracking-wider text-[var(--marketing-muted)]">Effective Customer Acquisition</p>
              <p className="mt-1 font-display text-3xl font-bold text-neutral-700 dark:text-neutral-300">$25.00 <span className="text-sm font-normal text-neutral-500">/ active MAU</span></p>
              <p className="mt-1 text-xs text-[var(--marketing-muted-strong)]">Value leaves your project and goes to big ad networks.</p>
            </div>
          </div>

          {/* Card B: The FundLoop Model */}
          <div className="relative rounded-[2rem] border-2 border-[var(--marketing-accent)] bg-white/80 p-6 shadow-xl dark:bg-black/40 sm:p-8">
            <div className="absolute -top-3.5 right-6 rounded-full bg-[var(--marketing-accent)] px-3.5 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-white">
              Recommended Model
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--marketing-accent)]/15 text-[var(--marketing-accent)]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-accent)]">Option B</p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-[var(--marketing-ink)]">The FundLoop Loop</h3>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">Redirect Same Budget</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">$1,000 / month ($5 per MAU)</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">FundLoop Verified Reach</span>
                <span className="font-semibold">10,000 ecosystem users</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">Discovery & CTR (70%)</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">7,000 qualified visits</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">New Signups from Network</span>
                <span className="font-semibold">2,000 new verified users</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3">
                <span className="text-[var(--marketing-muted-strong)]">Enhanced Engagement (MAU Rate)</span>
                <span className="font-semibold text-[var(--marketing-accent)]">Surges from 20% → 30%</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-[var(--marketing-muted-strong)]">Instant Affiliate Network</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">All FundLoop projects become partners</span>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(239,139,87,0.18),transparent_70%)] border border-[var(--marketing-accent)]/30 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-[var(--marketing-accent)] font-semibold">Total Active Users</p>
              <p className="mt-1 font-display text-4xl font-extrabold text-[var(--marketing-ink)]">
                900 MAU <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">(+350% Growth)</span>
              </p>
              <p className="mt-1 text-xs text-[var(--marketing-muted-strong)]">3,000 total users × 30% active = 900 active humans rewarding each other.</p>
            </div>
          </div>
        </div>
      ) : (
        /* Step-by-Step Breakdown */
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">01</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Your Baseline</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              You start with 1,000 total users, of which 20% (200) are monthly active users (MAU).
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">02</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Redirect Ad Spend</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              Instead of paying $1,000/mo to ad platforms, you redirect that $1,000 to reward your active users with $5/mo each.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">03</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Ecosystem Discovery</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              FundLoop has 10,000 users. With a 70% click-through rate, 7,000 visit your project and 2,000 sign up.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">04</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Conversion Boost</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              With the FundLoop reward promise, your MAU conversion jumps from 20% to 30%. You now have 3,000 users = 900 active MAUs (+350% growth).
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">05</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Network Multiplier</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              Your users discover other projects in the ecosystem, and every other FundLoop project becomes your mutual distribution affiliate partner.
            </p>
          </div>
        </div>
      )}

      {/* Summary Banner & CTA */}
      <div className="mt-10 flex flex-col items-center justify-between gap-6 rounded-[2rem] border border-[color:var(--marketing-line-strong)] bg-white/40 p-6 dark:bg-white/[0.03] sm:flex-row sm:p-8">
        <div className="space-y-1 text-center sm:text-left">
          <p className="font-display text-2xl font-bold text-[var(--marketing-ink)]">
            Stop paying ad networks. Start rewarding real human participation.
          </p>
          <p className="text-sm text-[var(--marketing-muted-strong)]">
            Ready to bring your project into the loop? Onboarding takes less than 5 minutes.
          </p>
        </div>

        <Button
          asChild
          size="lg"
          className="rounded-full bg-[var(--marketing-accent)] px-8 text-white hover:bg-[color:var(--marketing-accent)]/92"
        >
          <Link href="/?onboarding=project">
            Start project onboarding
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
