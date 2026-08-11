import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowUpRight, BadgeDollarSign, Coins, Landmark, ListChecks, Route, WalletCards } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { getUserEarningsWorkspace, type UserEarningsCredit, type UserEarningsCycle } from "@/lib/workspace/user-earnings-workspace"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WithdrawalRequestPanel } from "@/components/workspace/withdrawal-request-panel"
import { StripeConnectPanel } from "@/components/account/stripe-connect-panel"
import { getStripeConnectOverview } from "@/lib/stripe/stripe-connect-overview"
import { EpochCloseSummaryCard } from "@/components/epoch-close-summary-card"
import { loadLatestUserEpochClose } from "@/lib/monthly-cycles/epoch-close-review"

type WorkspaceEarningsPageProps = {
  params: Promise<{ locale: string }>
}

function formatCurrency(locale: string, value: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

function formatDate(locale: string, value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function statusTone(status: UserEarningsCycle["payoutStatus"]) {
  if (status === "paid") return "border-emerald-300/60 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100"
  if (status === "failed" || status === "cancelled") {
    return "border-rose-300/60 bg-rose-50 text-rose-950 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100"
  }
  if (status === "not_created") {
    return "border-slate-300/60 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-400/10 dark:text-slate-200"
  }
  return "border-cyan-300/60 bg-cyan-50 text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-100"
}

function creditStatusTone(status: UserEarningsCredit["paymentStatus"]) {
  if (status === "not_paid") {
    return "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
  }
  return "border-slate-300/60 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-400/10 dark:text-slate-200"
}

function CreditTable({
  rows,
  empty,
  locale,
  t,
}: {
  rows: UserEarningsCredit[]
  empty: string
  locale: string
  t: Awaited<ReturnType<typeof getTranslations>>
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("creditTable.cycle")}</TableHead>
          <TableHead>{t("creditTable.credit")}</TableHead>
          <TableHead>{t("creditTable.assetFills")}</TableHead>
          <TableHead>{t("creditTable.source")}</TableHead>
          <TableHead>{t("creditTable.status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-[var(--text-muted)]">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-semibold text-[var(--text-strong)]">{row.key}</div>
                <div className="text-xs text-[var(--text-muted)]">{t(`cycleStatus.${row.cycleStatus}`)}</div>
              </TableCell>
              <TableCell>
                <div className="font-semibold text-[var(--text-strong)]">
                  {formatCurrency(locale, row.usdEquivalentAmount, row.currencyCode)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {t("creditTable.credited", { date: formatDate(locale, row.creditedAt) })}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {row.assetFills.length === 0 ? (
                    <span className="text-sm text-[var(--text-muted)]">{t("creditTable.noAssetFills")}</span>
                  ) : (
                    row.assetFills.map((fill, index) => (
                      <div key={`${row.id}-${fill.assetCode}-${index}`} className="text-sm">
                        <span className="font-medium text-[var(--text-strong)]">
                          {formatCurrency(locale, fill.usdValue)} {fill.assetCode}
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {" "}
                          · {t("creditTable.rank", { rank: fill.preferenceRank })}
                          {fill.partial ? ` · ${t("creditTable.partial")}` : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="text-sm text-[var(--text-muted)]">
                    {t("creditTable.projects", { count: row.sourceBreakdown.length })}
                  </div>
                  {row.sourceBreakdown.map((source) => (
                    <div key={`${row.id}-project-${source.projectId}`} className="text-xs font-medium text-[var(--text-strong)]">
                      {source.projectName}
                    </div>
                  ))}
                  <div className="text-xs text-[var(--text-muted)]">
                    {t("creditTable.baseline", { amount: formatCurrency(locale, row.allocationBreakdown.baselineUsd) })}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {t("creditTable.topUp", { amount: formatCurrency(locale, row.allocationBreakdown.equalizationTopUpUsd) })}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className="border-emerald-300/60 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
                    {t(`creditStatus.${row.status}`)}
                  </Badge>
                  <Badge variant="outline" className={creditStatusTone(row.paymentStatus)}>
                    {t(`paymentStatus.${row.paymentStatus}`)}
                  </Badge>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

function CycleTable({
  rows,
  empty,
  locale,
  t,
}: {
  rows: UserEarningsCycle[]
  empty: string
  locale: string
  t: Awaited<ReturnType<typeof getTranslations>>
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("table.cycle")}</TableHead>
          <TableHead>{t("table.result")}</TableHead>
          <TableHead>{t("table.payout")}</TableHead>
          <TableHead>{t("table.route")}</TableHead>
          <TableHead>{t("table.status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-[var(--text-muted)]">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={`${row.resultId}-${row.payoutIntentId ?? "result"}`}>
              <TableCell>
                <div className="font-semibold text-[var(--text-strong)]">{row.key}</div>
                <div className="text-xs text-[var(--text-muted)]">{t(`cycleStatus.${row.cycleStatus}`)}</div>
              </TableCell>
              <TableCell>
                <div className="font-semibold text-[var(--text-strong)]">{formatCurrency(locale, row.allocationUsd)}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {t("table.published", { date: formatDate(locale, row.publishedAt) })}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-semibold text-[var(--text-strong)]">
                  {row.payoutAmountUsd === null ? t("table.notCreated") : formatCurrency(locale, row.payoutAmountUsd, row.currencyCode)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {row.batchStatus ? t("table.batch", { status: t(`batchStatus.${row.batchStatus}`) }) : t("table.unbatched")}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-medium text-[var(--text-strong)]">{row.routeLabel ?? t("table.noRoute")}</div>
                <div className="text-xs text-[var(--text-muted)]">{row.rail ? t(`rail.${row.rail}`) : t("rail.pending")}</div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className={statusTone(row.payoutStatus)}>
                    {t(`payoutStatus.${row.payoutStatus}`)}
                  </Badge>
                  {row.reconciliationStatus ? (
                    <span className="text-xs text-[var(--text-muted)]">{t(`reconciliationStatus.${row.reconciliationStatus}`)}</span>
                  ) : null}
                  {row.statusReason ? (
                    <span className="text-xs text-[var(--text-muted)]">
                      {row.statusReason === "missing_default_payout_route" ? t("reason.missing_default_payout_route") : row.statusReason}
                    </span>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

export default async function WorkspaceEarningsPage({ params }: WorkspaceEarningsPageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("workspaceEarnings")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const [earnings, epochClose, stripeConnect] = await Promise.all([
    getUserEarningsWorkspace(navigationContext),
    navigationContext.user ? loadLatestUserEpochClose(navigationContext.user.id) : Promise.resolve(null),
    getStripeConnectOverview(navigationContext.user?.id),
  ])
  const nextAction = earnings.summary.nextAction

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[calc(var(--radius-2xl)+0.35rem)] border border-[color:var(--surface-border)] bg-[radial-gradient(circle_at_top_right,var(--interactive-secondary),transparent_35%),linear-gradient(135deg,var(--surface-panel-strong),var(--surface-panel))] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)] md:text-5xl">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
          </div>
          <Button asChild>
            <Link href={earnings.rawResultsHref}>
              {t("rawResultsCta")}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
            <p className="text-sm font-medium text-[var(--text-muted)]">{t("stats.published")}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">
              {formatCurrency(locale, earnings.summary.totalCreditedUsd)}
            </p>
          </div>
          <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
            <p className="text-sm font-medium text-[var(--text-muted)]">{t("stats.pending")}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">
              {formatCurrency(locale, earnings.summary.pendingPayoutUsd)}
            </p>
          </div>
          <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
            <p className="text-sm font-medium text-[var(--text-muted)]">{t("stats.notPaid")}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{earnings.summary.creditCount}</p>
          </div>
          <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
            <p className="text-sm font-medium text-[var(--text-muted)]">{t("stats.routes")}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{earnings.summary.activeRouteCount}</p>
          </div>
        </div>
      </section>

      {epochClose ? <EpochCloseSummaryCard
        eyebrow="Provisional epoch award"
        title="Your approved allocation is conditional and not payable"
        description="This review record preserves the approved result and redistribution top-up. It is not user-owned, cannot be withdrawn, and does not prove a payout or transfer."
        cycleKey={epochClose.cycleKey}
        rootHash={epochClose.rootHash}
        values={[
          {label:"Initial claims",value:epochClose.initialClaimMinor},{label:"Redistribution top-up",value:epochClose.topUpMinor},
          {label:"Top-up ceiling",value:epochClose.redistributionCeilingMinor},{label:"Selected cap multiple",value:`${epochClose.capMultiple}×`},
          {label:"Epoch harvest (aggregate)",value:epochClose.harvestedUnclaimedMinor},
          {label:"Final minor units",value:epochClose.finalAwardMinor},{label:"Payable state",value:epochClose.payableStatus},
        ]}
      /> : null}

      {earnings.warnings.length > 0 ? (
        <section className="rounded-3xl border border-amber-300/70 bg-amber-50/80 p-5 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
          <p className="font-semibold">{t("warnings.title")}</p>
          <p>{t("warnings.body")}</p>
        </section>
      ) : null}

      <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BadgeDollarSign className="h-5 w-5 text-[var(--interactive-primary)]" />
            <CardTitle>{t("credits.title")}</CardTitle>
          </div>
          <CardDescription>{t("credits.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreditTable rows={earnings.credits} empty={t("credits.empty")} locale={locale} t={t} />
        </CardContent>
      </Card>

      <WithdrawalRequestPanel
        termsPreviewRequired
        eligibleUsd={earnings.summary.eligibleWithdrawalUsd}
        defaultRoute={earnings.routes.defaultRoute ? { id: earnings.routes.defaultRoute.id, label: earnings.routes.defaultRoute.label, rail: earnings.routes.defaultRoute.rail } : null}
        assetOptions={earnings.withdrawalAssetOptions}
        initialRequests={earnings.withdrawalRequests}
      />

      <StripeConnectPanel initial={stripeConnect} />

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ListChecks className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{t("nextAction.title")}</CardTitle>
            </div>
            <CardDescription>{t(`nextAction.${nextAction}.body`)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
              <p className="font-semibold text-[var(--text-strong)]">{t(`nextAction.${nextAction}.title`)}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t(`nextAction.${nextAction}.detail`)}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/workspace/account">{t("nextAction.accountCta")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/projects">{t("nextAction.discoveryCta")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Coins className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{t("assetPreferences.title")}</CardTitle>
            </div>
            <CardDescription>{t("assetPreferences.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-cyan-300/60 bg-cyan-50/80 p-4 text-sm leading-6 text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-100">
              {t("assetPreferences.planningNote")}
            </div>
            {!earnings.assetPreferences.hasCustomPreferences ? (
              <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
                <p className="font-semibold text-[var(--text-strong)]">{t("assetPreferences.usingDefaultsTitle")}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t("assetPreferences.usingDefaultsBody")}</p>
              </div>
            ) : null}
            {earnings.assetPreferences.rejectsAllProjectTokens ? (
              <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                <p className="font-semibold">{t("assetPreferences.rejectAllWarningTitle")}</p>
                <p className="mt-1">{t("assetPreferences.rejectAllWarningBody")}</p>
              </div>
            ) : null}
            <div className="space-y-3">
              {(earnings.assetPreferences.hasCustomPreferences
                ? earnings.assetPreferences.preferences
                : earnings.assetPreferences.defaultPreferences
              ).map((preference) => (
                <div
                  key={`${preference.rank}-${preference.assetType}-${preference.assetCode}-${preference.projectId ?? "default"}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4"
                >
                  <div>
                    <p className="font-semibold text-[var(--text-strong)]">
                      {t("assetPreferences.rank", { rank: preference.rank })}: {preference.assetCode}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">{t(`assetPreferences.type.${preference.assetType}`)}</p>
                  </div>
                  <Badge variant={preference.accepted ? "default" : "outline"}>
                    {preference.accepted ? t("assetPreferences.accepted") : t("assetPreferences.rejected")}
                  </Badge>
                </div>
              ))}
            </div>
            <Button asChild variant="outline">
              <Link href="/workspace/account">{t("assetPreferences.manageCta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Route className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{t("routes.title")}</CardTitle>
            </div>
            <CardDescription>{t("routes.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {earnings.routes.all.length > 0 ? (
              earnings.routes.all.map((route) => (
                <div key={route.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
                  <div>
                    <p className="font-semibold text-[var(--text-strong)]">{route.label}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {t(`rail.${route.rail}`)} · {route.currencyCode}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {route.isDefault ? <Badge>{t("routes.default")}</Badge> : null}
                    <Badge variant="outline">{t(`routeStatus.${route.status}`)}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--surface-border-strong)] bg-[var(--surface-panel)] p-5">
                <p className="font-semibold text-[var(--text-strong)]">{t("routes.emptyTitle")}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t("routes.emptyBody")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BadgeDollarSign className="h-5 w-5 text-[var(--interactive-primary)]" />
            <CardTitle>{t("pending.title")}</CardTitle>
          </div>
          <CardDescription>{t("pending.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CycleTable rows={earnings.pendingDistributions} empty={t("pending.empty")} locale={locale} t={t} />
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Landmark className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{t("history.title")}</CardTitle>
            </div>
            <CardDescription>{t("history.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CycleTable rows={earnings.cycles} empty={t("history.empty")} locale={locale} t={t} />
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <WalletCards className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{t("status.title")}</CardTitle>
            </div>
            <CardDescription>{t("status.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
              <p className="text-sm font-medium text-[var(--text-muted)]">{t("status.ready")}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{earnings.summary.readyIntentCount}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
              <p className="text-sm font-medium text-[var(--text-muted)]">{t("status.missingRoute")}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{earnings.summary.draftIntentCount}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
              <p className="text-sm font-medium text-[var(--text-muted)]">{t("status.failed")}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">
                {formatCurrency(locale, earnings.summary.failedPayoutUsd)}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
