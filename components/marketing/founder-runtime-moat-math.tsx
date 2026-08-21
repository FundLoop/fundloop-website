"use client"

import { useTranslations } from "next-intl"
import { Flame, HeartHandshake, Link2, ShieldCheck, Sparkles, TrendingUp, Users, Zap } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { SectionEyebrow, SectionTitle, SectionBody } from "@/components/marketing/page-chrome"
import { useFounderCalculator } from "@/components/marketing/founder-calculator-context"

export function FounderRuntimeMoatMathPanel() {
  const t = useTranslations("founders.calculators.runtime")
  const {
    runtimeMau,
    setRuntimeMau,
    sharePct,
    setSharePct,
    arpu,
    setArpu,
    effectiveCAC,
    competitorChurnRate,
    competitorChurnCount,
    targetUsersToKeepUp,
    competitorAdSpend,
    grossRevenue,
    competitorRetained,
    fundLoopMonth1Mau,
    fundLoopMonth1GrossRevenue,
    giveBackTotal,
    giveBackPerUser,
    fundLoopRetained,
    monthlyAdvantage,
    annualAdvantage,
  } = useFounderCalculator()

  return (
    <div className="rounded-[2.5rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(145deg,rgba(255,248,238,0.92),rgba(244,203,141,0.18))] p-6 shadow-[0_28px_90px_rgba(15,23,23,0.1)] dark:border-white/[0.12] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(255,120,68,0.12),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(52,211,153,0.06),transparent_40%),linear-gradient(145deg,#161e29,#0e131b_50%,#18202c)] dark:shadow-[0_28px_90px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-10 lg:p-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl space-y-3">
          <SectionEyebrow className="text-[var(--marketing-accent)]">{t("eyebrow")}</SectionEyebrow>
          <SectionTitle className="text-4xl sm:text-5xl">{t("title")}</SectionTitle>
          <SectionBody className="text-base sm:text-lg">{t("body")}</SectionBody>
        </div>

        {/* Linked Model Explanatory Callout */}
        <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--marketing-accent)]/30 bg-[var(--marketing-accent)]/10 px-4 py-2.5 text-xs text-[var(--marketing-ink)] dark:bg-[var(--marketing-accent)]/15">
          <Link2 className="h-4 w-4 shrink-0 text-[var(--marketing-accent)]" />
          <span>
            {t.rich("linkedModel", {
              strong: (chunks) => <strong className="text-[var(--marketing-accent)]">{chunks}</strong>,
              arpu,
              cac: effectiveCAC.toFixed(2),
            })}
          </span>
        </div>
      </div>

      {/* Interactive Controls Grid */}
      <div className="mt-10 grid gap-6 rounded-3xl border border-[color:var(--marketing-line)] bg-white/60 p-6 dark:border-white/[0.08] dark:bg-white/[0.03] md:grid-cols-3">
        {/* Slider 1: MAU */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--marketing-ink)]">
              <Users className="h-4 w-4 text-[var(--marketing-accent)]" />
              {t("controls.mau")}
            </span>
            <span className="rounded-lg bg-[var(--marketing-accent)]/10 px-2.5 py-1 font-mono font-bold text-[var(--marketing-accent)]">
              {runtimeMau.toLocaleString()} MAU
            </span>
          </div>
          <Slider
            value={[runtimeMau]}
            min={100}
            max={10000}
            step={100}
            onValueChange={(val) => setRuntimeMau(val[0] ?? 1000)}
            className="py-2"
          />
          <p className="text-xs text-[var(--marketing-muted)]">{t("controls.mauHelp")}</p>
        </div>

        {/* Slider 2: ARPU */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--marketing-ink)]">
              <Zap className="h-4 w-4 text-[var(--marketing-accent)]" />
              {t("controls.arpu")}
            </span>
            <span className="rounded-lg bg-[var(--marketing-accent)]/10 px-2.5 py-1 font-mono font-bold text-[var(--marketing-accent)]">
              ${arpu} / mo
            </span>
          </div>
          <Slider
            value={[arpu]}
            min={5}
            max={200}
            step={5}
            onValueChange={(val) => setArpu(val[0] ?? 50)}
            className="py-2"
          />
          <p className="text-xs text-[var(--marketing-muted)]">{t("controls.arpuHelp")}</p>
        </div>

        {/* Slider 3: Share % */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--marketing-ink)]">
              <HeartHandshake className="h-4 w-4 text-[var(--marketing-accent)]" />
              {t("controls.share")}
            </span>
            <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {sharePct}% (${giveBackPerUser}/user)
            </span>
          </div>
          <Slider
            value={[sharePct]}
            min={1}
            max={25}
            step={1}
            onValueChange={(val) => setSharePct(val[0] ?? 10)}
            className="py-2"
          />
          <p className="text-xs text-[var(--marketing-muted)]">
            {t("controls.shareHelp", { rate: competitorChurnRate.toFixed(1) })}
          </p>
        </div>
      </div>

      {/* Side-by-Side Model Cards */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Competitor Model */}
        <div className="flex flex-col justify-between rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/50 p-6 dark:border-white/[0.08] dark:bg-white/[0.02] sm:p-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                <Flame className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-muted)]">{t("competitor.eyebrow")}</p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-[var(--marketing-ink)]">{t("competitor.title")}</h3>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("grossRevenue")}</span>
                <span className="font-semibold">${grossRevenue.toLocaleString()} / mo</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("sharedWithUsers")}</span>
                <span className="font-semibold text-neutral-500">{t("competitor.noGiveBack")}</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("monthlyChurn")}</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {t("competitor.churnValue", { count: competitorChurnCount, rate: competitorChurnRate.toFixed(1) })}
                </span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("monthlyGrowth")}</span>
                <span className="font-semibold text-neutral-500">{t("competitor.growthValue")}</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("competitor.adSpend")}</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {t("competitor.adSpendValue", { amount: competitorAdSpend, users: targetUsersToKeepUp, cac: effectiveCAC.toFixed(2) })}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-[var(--marketing-muted-strong)]">{t("competitor.loyalty")}</span>
                <span className="font-semibold text-neutral-500">{t("competitor.loyaltyValue")}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-neutral-100/80 p-4 text-center dark:bg-neutral-900/60">
            <p className="text-xs uppercase tracking-wider text-[var(--marketing-muted)]">{t("netProfit")}</p>
            <p className="mt-1 font-display text-3xl font-bold text-neutral-700 dark:text-neutral-300">
              ${competitorRetained.toLocaleString()} <span className="text-sm font-normal text-neutral-500">/ mo</span>
            </p>
            <p className="mt-1 text-xs text-[var(--marketing-muted-strong)]">
              {t("competitor.summary", { users: targetUsersToKeepUp, amount: competitorAdSpend, mau: fundLoopMonth1Mau })}
            </p>
          </div>
        </div>

        {/* FundLoop Model */}
        <div className="relative flex flex-col justify-between rounded-[2rem] border-2 border-emerald-500/50 bg-white/80 p-6 shadow-xl dark:border-emerald-500/60 dark:bg-white/[0.03] sm:p-8">
          <div>
            <div className="absolute -top-3.5 right-6 rounded-full bg-emerald-600 px-3.5 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-white shadow-sm">
              {t("fundloop.badge")}
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">{t("fundloop.eyebrow")}</p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-[var(--marketing-ink)]">{t("fundloop.title")}</h3>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("grossRevenueMonthOne")}</span>
                <span className="font-semibold">${fundLoopMonth1GrossRevenue.toLocaleString()} / mo</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("fundloop.sharedWithUsers", { percent: sharePct })}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  -${giveBackTotal.toLocaleString()} / mo (${giveBackPerUser}/user)
                </span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("monthlyChurn")}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t("fundloop.churnValue")}</span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("monthlyGrowth")}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {t("fundloop.growthValue", { count: competitorChurnCount, mau: fundLoopMonth1Mau })}
                </span>
              </div>
              <div className="flex justify-between border-b border-[color:var(--marketing-line)] pb-3 dark:border-white/[0.08]">
                <span className="text-[var(--marketing-muted-strong)]">{t("fundloop.adCost")}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t("fundloop.adCostValue")}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-[var(--marketing-muted-strong)]">{t("fundloop.migration")}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t("fundloop.migrationValue")}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_70%)] border border-emerald-500/30 p-4 text-center dark:bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.12),transparent_70%)]">
            <p className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
              {t("netProfit")}
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold text-[var(--marketing-ink)]">
              ${fundLoopRetained.toLocaleString()} <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">/ mo</span>
            </p>
            <p className="mt-1 text-xs text-[var(--marketing-muted-strong)]">
              {monthlyAdvantage > 0 ? (
                <span>
                  {t.rich("fundloop.advantage", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                    monthly: monthlyAdvantage,
                    annual: annualAdvantage,
                  })}
                </span>
              ) : (
                <span>{t("fundloop.sustainable")}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 3 Moat Callout Cards */}
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--marketing-accent)]/15 text-[var(--marketing-accent)]">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h4 className="mt-4 font-semibold text-[var(--marketing-ink)]">{t("moats.churnTitle")}</h4>
          <p className="mt-2 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
            {t("moats.churnBody")}
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <h4 className="mt-4 font-semibold text-[var(--marketing-ink)]">{t("moats.migrationTitle")}</h4>
          <p className="mt-2 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
            {t("moats.migrationBody")}
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/60 p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h4 className="mt-4 font-semibold text-[var(--marketing-ink)]">{t("moats.reputationTitle")}</h4>
          <p className="mt-2 text-xs leading-relaxed text-[var(--marketing-muted-strong)]">
            {t("moats.reputationBody")}
          </p>
        </div>
      </div>
    </div>
  )
}
