"use client"

import { useState } from "react"
import { ArrowRight, DollarSign, Megaphone, Sparkles, TrendingUp, Users, Zap } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { SectionEyebrow, SectionTitle, SectionBody } from "@/components/marketing/page-chrome"
import { useFounderCalculator } from "@/components/marketing/founder-calculator-context"

export type FounderGrowthMathProps = {
  eyebrow?: string
  title?: string
  body?: string
}

export function FounderGrowthMathPanel({
  eyebrow = "Growth Economics",
  title = "The Math: Why Founders Join FundLoop Over Running Ads",
  body = "Compare redirecting your monthly ad budget into FundLoop's value-sharing ecosystem vs. paying traditional ad platforms.",
}: FounderGrowthMathProps) {
  const [activeTab, setActiveTab] = useState<"comparison" | "steps">("comparison")

  const {
    startingUsers,
    setStartingUsers,
    startingMau,
    setStartingMau,
    monthlyAdBudget,
    setMonthlyAdBudget,
    newUsersFromAds,
    setNewUsersFromAds,
    arpu,
    setArpu,
    startingMauRate,
    newActiveUsersFromAds,
    traditionalTotalMau,
    traditionalGrowthPct,
    effectiveCAC,
    fundLoopGiveBackPerStartingUser,
    fundLoopReach,
    fundLoopVisits,
    fundLoopSignups,
    fundLoopTotalUsers,
    fundLoopMauRate,
    fundLoopTotalMau,
    fundLoopGrowthPct,
  } = useFounderCalculator()

  return (
    <div className="rounded-[2.5rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(145deg,rgba(255,248,238,0.92),rgba(244,203,141,0.18))] p-6 shadow-[0_28px_90px_rgba(15,23,23,0.1)] dark:border-white/[0.08] dark:bg-[linear-gradient(145deg,rgba(15,20,28,0.96),rgba(255,120,68,0.06))] dark:shadow-[0_28px_90px_rgba(0,0,0,0.5)] sm:p-10 lg:p-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl space-y-3">
          <SectionEyebrow className="text-[var(--marketing-accent)]">{eyebrow}</SectionEyebrow>
          <SectionTitle className="text-4xl sm:text-5xl">{title}</SectionTitle>
          <SectionBody className="text-base sm:text-lg">{body}</SectionBody>
        </div>

        {/* View Switcher */}
        <div className="inline-flex rounded-full border border-[color:var(--marketing-line-strong)] bg-white/40 p-1 dark:border-white/[0.12] dark:bg-white/[0.04]">
          <button
            type="button"
            onClick={() => setActiveTab("comparison")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "comparison"
                ? "bg-[var(--marketing-accent)] text-white shadow-sm"
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
                ? "bg-[var(--marketing-accent)] text-white shadow-sm"
                : "text-[var(--marketing-muted-strong)] hover:text-[var(--marketing-ink)]"
            }`}
          >
            Step-by-Step Breakdown
          </button>
        </div>
      </div>

      {/* Interactive Sliders Grid */}
      <div className="mt-10 rounded-3xl border border-[color:var(--marketing-line)] bg-white/60 p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--marketing-ink)]">
            Adjust Your Project Parameters
          </h4>
          <p className="text-xs text-[var(--marketing-muted-strong)]">
            Assumption: Active MAU rate increases by <strong className="text-[var(--marketing-accent)]">+10%</strong> (from {(startingMauRate * 100).toFixed(0)}% → {(fundLoopMauRate * 100).toFixed(0)}%) with FundLoop give-back incentives.
          </p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Slider 1: Starting User Base */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--marketing-ink)]">
                <Users className="h-3.5 w-3.5 text-[var(--marketing-accent)]" />
                Starting Users
              </span>
              <span className="rounded-md bg-[var(--marketing-accent)]/10 px-2 py-0.5 font-mono font-bold text-[var(--marketing-accent)]">
                {startingUsers.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[startingUsers]}
              min={100}
              max={10000}
              step={100}
              onValueChange={(val) => {
                const nextUsers = val[0] ?? 1000
                setStartingUsers(nextUsers)
                if (startingMau > nextUsers) {
                  setStartingMau(nextUsers)
                }
              }}
              className="py-1.5"
            />
            <p className="text-[0.7rem] text-[var(--marketing-muted)]">Total registered user accounts.</p>
          </div>

          {/* Slider 2: Starting MAU */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--marketing-ink)]">
                <Users className="h-3.5 w-3.5 text-[var(--marketing-accent)]" />
                Baseline MAU
              </span>
              <span className="rounded-md bg-[var(--marketing-accent)]/10 px-2 py-0.5 font-mono font-bold text-[var(--marketing-accent)]">
                {startingMau.toLocaleString()} ({(startingMauRate * 100).toFixed(0)}%)
              </span>
            </div>
            <Slider
              value={[startingMau]}
              min={10}
              max={startingUsers}
              step={10}
              onValueChange={(val) => setStartingMau(val[0] ?? 200)}
              className="py-1.5"
            />
            <p className="text-[0.7rem] text-[var(--marketing-muted)]">Monthly active users before FundLoop.</p>
          </div>

          {/* Slider 3: Monthly Ad Budget */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--marketing-ink)]">
                <DollarSign className="h-3.5 w-3.5 text-[var(--marketing-accent)]" />
                Monthly Ad Budget
              </span>
              <span className="rounded-md bg-rose-500/10 px-2 py-0.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                ${monthlyAdBudget.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[monthlyAdBudget]}
              min={100}
              max={10000}
              step={100}
              onValueChange={(val) => setMonthlyAdBudget(val[0] ?? 1000)}
              className="py-1.5"
            />
            <p className="text-[0.7rem] text-[var(--marketing-muted)]">Ad spend to be redirected.</p>
          </div>

          {/* Slider 4: New Users / mo */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--marketing-ink)]">
                <TrendingUp className="h-3.5 w-3.5 text-[var(--marketing-accent)]" />
                New Users / mo
              </span>
              <span className="rounded-md bg-[var(--marketing-accent)]/10 px-2 py-0.5 font-mono font-bold text-[var(--marketing-accent)]">
                {newUsersFromAds.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[newUsersFromAds]}
              min={10}
              max={2000}
              step={10}
              onValueChange={(val) => setNewUsersFromAds(val[0] ?? 200)}
              className="py-1.5"
            />
            <p className="text-[0.7rem] text-[var(--marketing-muted)]">Signups from traditional ads.</p>
          </div>

          {/* Slider 5: ARPU */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--marketing-ink)]">
                <Zap className="h-3.5 w-3.5 text-[var(--marketing-accent)]" />
                Monthly ARPU
              </span>
              <span className="rounded-md bg-[var(--marketing-accent)]/10 px-2 py-0.5 font-mono font-bold text-[var(--marketing-accent)]">
                ${arpu} / mo
              </span>
            </div>
            <Slider
              value={[arpu]}
              min={5}
              max={200}
              step={5}
              onValueChange={(val) => setArpu(val[0] ?? 50)}
              className="py-1.5"
            />
            <p className="text-[0.7rem] text-[var(--marketing-muted)]">Average revenue per active user.</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "comparison" ? (
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {/* Card A: Traditional Ads */}
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/50 p-6 dark:border-white/[0.08] dark:bg-white/[0.02] sm:p-8">
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
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">Starting User Base</span>
                <span className="font-semibold">{startingUsers.toLocaleString()} total ({startingMau.toLocaleString()} MAU @ {(startingMauRate * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">Monthly Ad Budget</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">${monthlyAdBudget.toLocaleString()} / month</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">New Signups Acquired</span>
                <span className="font-semibold">{newUsersFromAds.toLocaleString()} new users</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">New Active Users ({(startingMauRate * 100).toFixed(0)}% MAU)</span>
                <span className="font-semibold">+{newActiveUsersFromAds.toLocaleString()} active users</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">Effective CAC per Active User</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">${effectiveCAC.toFixed(2)} / active MAU</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-[var(--marketing-muted-strong)]">Ecosystem Network Effect</span>
                <span className="font-semibold text-neutral-500">None (Zero cross-promotion)</span>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-neutral-100/80 p-4 text-center dark:bg-neutral-900/60">
              <p className="text-xs uppercase tracking-wider text-[var(--marketing-muted)]">Total Active Users</p>
              <p className="mt-1 font-display text-4xl font-extrabold text-[var(--marketing-ink)]">
                {traditionalTotalMau.toLocaleString()} MAU <span className="text-sm font-semibold text-neutral-500">(+{traditionalGrowthPct}% Growth)</span>
              </p>
              <p className="mt-1 text-xs text-[var(--marketing-muted-strong)]">
                From {startingUsers.toLocaleString()} users, only +{newActiveUsersFromAds.toLocaleString()} active users added via ads ($${effectiveCAC.toFixed(2)}/user).
              </p>
            </div>
          </div>

          {/* Card B: The FundLoop Model */}
          <div className="relative rounded-[2rem] border-2 border-[var(--marketing-accent)] bg-white/80 p-6 shadow-xl dark:border-[var(--marketing-accent)] dark:bg-white/[0.03] sm:p-8">
            <div className="absolute -top-3.5 right-6 rounded-full bg-[var(--marketing-accent)] px-3.5 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-white shadow-sm">
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
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">Redirect Same Budget</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  ${monthlyAdBudget.toLocaleString()} / month (${fundLoopGiveBackPerStartingUser.toFixed(2)} per MAU)
                </span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">FundLoop Verified Reach</span>
                <span className="font-semibold">{fundLoopReach.toLocaleString()} ecosystem users</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">Discovery & CTR (70%)</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{fundLoopVisits.toLocaleString()} qualified visits</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">New Signups from Network</span>
                <span className="font-semibold">{fundLoopSignups.toLocaleString()} new verified users</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">Enhanced Engagement (MAU Rate)</span>
                <span className="font-semibold text-[var(--marketing-accent)]">
                  Surges from {(startingMauRate * 100).toFixed(0)}% → {(fundLoopMauRate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-[var(--marketing-muted-strong)]">Instant Affiliate Network</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">All FundLoop projects become partners</span>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(239,139,87,0.18),transparent_70%)] border border-[var(--marketing-accent)]/30 p-4 text-center dark:bg-[radial-gradient(ellipse_at_top,rgba(255,120,68,0.15),transparent_70%)]">
              <p className="text-xs uppercase tracking-wider text-[var(--marketing-accent)] font-semibold">Total Active Users</p>
              <p className="mt-1 font-display text-4xl font-extrabold text-[var(--marketing-ink)]">
                {fundLoopTotalMau.toLocaleString()} MAU <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">(+{fundLoopGrowthPct}% Growth)</span>
              </p>
              <p className="mt-1 text-xs text-[var(--marketing-muted-strong)]">
                {fundLoopTotalUsers.toLocaleString()} total users × {(fundLoopMauRate * 100).toFixed(0)}% active = {fundLoopTotalMau.toLocaleString()} active humans rewarding each other.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Step-by-Step Breakdown */
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">01</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Your Baseline</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              You start with {startingUsers.toLocaleString()} total users, of which {(startingMauRate * 100).toFixed(0)}% ({startingMau.toLocaleString()}) are monthly active users (MAU).
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">02</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Redirect Ad Spend</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              Instead of paying ${monthlyAdBudget.toLocaleString()}/mo to ad platforms, you redirect that ${monthlyAdBudget.toLocaleString()} to reward your active users with ${fundLoopGiveBackPerStartingUser.toFixed(2)}/mo each.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">03</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Ecosystem Discovery</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              FundLoop has {fundLoopReach.toLocaleString()} users. With a 70% click-through rate, {fundLoopVisits.toLocaleString()} visit your project and {fundLoopSignups.toLocaleString()} sign up.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">04</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Conversion Boost</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              With the FundLoop reward promise, your MAU conversion jumps from {(startingMauRate * 100).toFixed(0)}% to {(fundLoopMauRate * 100).toFixed(0)}%. You now have {fundLoopTotalUsers.toLocaleString()} users = {fundLoopTotalMau.toLocaleString()} active MAUs (+{fundLoopGrowthPct}% growth).
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="font-display text-2xl font-bold text-[var(--marketing-accent)]">05</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider">Network Multiplier</p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
              Your users discover other projects in the ecosystem, and every other FundLoop project becomes your mutual distribution affiliate partner.
            </p>
          </div>
        </div>
      )}

      {/* Summary Banner & CTA */}
      <div className="mt-10 flex flex-col items-center justify-between gap-6 rounded-[2rem] border border-[color:var(--marketing-line-strong)] bg-white/40 p-6 dark:border-white/[0.08] dark:bg-white/[0.03] sm:flex-row sm:p-8">
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
          className="rounded-full bg-[var(--marketing-accent)] px-8 text-white shadow-md hover:bg-[color:var(--marketing-accent)]/92"
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
