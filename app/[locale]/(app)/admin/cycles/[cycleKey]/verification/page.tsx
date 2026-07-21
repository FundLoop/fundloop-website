import { notFound } from "next/navigation"
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react"
import { MonthlyCycleVerificationActions } from "@/components/admin/monthly-cycle-verification-actions"
import { RunStatusBadge } from "@/components/zkas/run-status-badge"
import { VerificationStatusBadge } from "@/components/zkas/verification-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { loadMonthlyCycleVerificationReview } from "@/lib/monthly-cycles/monthly-cycle-verification"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

type PageProps = {
  params: Promise<{ cycleKey: string; locale: string }>
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
}

function formatNumber(locale: string, value: number) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)
}

export default async function AdminCycleVerificationPage({ params }: PageProps) {
  const { cycleKey, locale } = await params
  const review = await (async () => {
    await requireInternalAdminActor()
    return loadMonthlyCycleVerificationReview(cycleKey)
  })()

  if (!review) notFound()

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <Button asChild variant="ghost">
        <Link href={`/admin/cycles/${review.cycle.cycleKey}/zkas`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to cycle zkAS
        </Link>
      </Button>

      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
              Cleanup, verification, and approval
            </p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
              {review.cycle.cycleKey} result review
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
              Compare completed calculation outputs against stored totals, record cleanup decisions, and explicitly approve
              the cycle before distribution work begins.
            </p>
          </div>
          <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4">
            <Badge variant={review.cycle.status === "approval" ? "default" : review.canMarkVerified ? "secondary" : "destructive"}>
              {review.cycle.status}
            </Badge>
            <p className="mt-3 text-sm text-[var(--text-muted)]">{review.cycle.periodStart} to {review.cycle.periodEnd}</p>
            {review.cycle.status === "approval" ? (
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href={`/admin/cycles/${review.cycle.cycleKey}/payouts`}>Open payout work</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Runs</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{review.totals.completedRunCount}</div><p className="text-xs text-[var(--text-muted)]">{review.totals.failedRunCount} failed of {review.totals.runCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Results</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{review.totals.resultCount}</div><p className="text-xs text-[var(--text-muted)]">{review.totals.eligibleResultCount} eligible</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Allocated</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{formatCurrency(locale, review.totals.totalAllocatedUsd)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Approval</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{review.cycle.approvalStartedAt ? "Ready" : "Pending"}</div></CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Review issues</CardTitle>
            <CardDescription>Blockers must be resolved or marked for cleanup before approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {review.issues.length === 0 ? (
              <div className="rounded-[var(--radius-xl)] border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
                <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />No cleanup blockers found</div>
              </div>
            ) : (
              review.issues.map((issue) => (
                <div key={issue.code} className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />{issue.title}<Badge variant={issue.severity === "blocker" ? "destructive" : "secondary"}>{issue.severity}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{issue.description}</p>
                  {issue.actionHref ? <Button asChild variant="link" className="h-auto p-0"><Link href={issue.actionHref}>Open related surface</Link></Button> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operator decision</CardTitle>
            <CardDescription>Every verification and approval decision requires a note and writes an audit event.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyCycleVerificationActions cycleKey={review.cycle.cycleKey} canMarkVerified={review.canMarkVerified} canApprove={review.canApprove} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Latest completed run</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {review.latestCompletedRun ? (
            <>
              <div>Run: <Link href={`/admin/superadmin/zkas/runs/${review.latestCompletedRun.id}`} className="text-emerald-600 hover:underline">#{review.latestCompletedRun.id}</Link></div>
              <div>Execution: <RunStatusBadge status={review.latestCompletedRun.status} /></div>
              <div>Verification: <VerificationStatusBadge status={review.latestCompletedRun.verification_status} /></div>
              <div>Users: {review.latestCompletedRun.user_count ?? "-"}</div>
              <div>Run allocated: {formatCurrency(locale, Number(review.latestCompletedRun.total_allocated_usd ?? 0))}</div>
              <div>Result hash: {review.latestCompletedRun.result_artifact_hash ?? "Missing"}</div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No completed run exists for this cycle yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Calculated MVP allocation</CardTitle>
              <CardDescription>
                Read-only calculation output. These values are not verified, approved, credited, paid, or transferable until
                later monthly-cycle stages explicitly advance.
              </CardDescription>
            </div>
            <Badge variant="secondary">Calculated, not credited</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Allocated</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(locale, review.totals.totalAllocatedUsd)}</div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Stored in `zkas_run_results` for operator review.</p>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Returned</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(locale, review.calculation.returnedPoolUsd)}</div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Future-pool value, not user earnings.</p>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Artifact</div>
              <div className="mt-2 break-all text-sm font-medium text-[var(--text-strong)]">
                {review.calculation.resultArtifactHash ?? "Missing"}
              </div>
              <p className="mt-1 break-all text-xs text-[var(--text-muted)]">{review.calculation.resultArtifactPath ?? "No result artifact path recorded."}</p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] p-4">
              <h2 className="text-base font-semibold text-[var(--text-strong)]">User results</h2>
              <div className="mt-3 space-y-2">
                {review.calculation.userResults.length > 0 ? (
                  review.calculation.userResults.slice(0, 8).map((row) => (
                    <div key={row.zkasUserId} className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-panel-strong)] px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{row.zkasUserId}</span>
                      <span className="font-semibold">{formatCurrency(locale, row.allocationUsd)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No calculated user result rows are linked to this cycle.</p>
                )}
              </div>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] p-4">
              <h2 className="text-base font-semibold text-[var(--text-strong)]">Source breakdown</h2>
              <div className="mt-3 space-y-2">
                {review.calculation.sourceBreakdown.length > 0 ? (
                  review.calculation.sourceBreakdown.map((row) => (
                    <div key={`${row.assetType}-${row.assetCode}`} className="rounded-[var(--radius-lg)] bg-[var(--surface-panel-strong)] px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{row.assetCode} <span className="text-[var(--text-muted)]">({row.assetType})</span></span>
                        <span>{formatCurrency(locale, row.allocatedUsd)} allocated</span>
                      </div>
                      {row.returnedUsd > 0 ? <p className="mt-1 text-xs text-[var(--text-muted)]">{formatCurrency(locale, row.returnedUsd)} returned to future pool</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No asset-fill or returned-pool rows are linked to this cycle.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] p-4">
              <h2 className="text-base font-semibold text-[var(--text-strong)]">Raw project entitlements</h2>
              <div className="mt-3 space-y-2">
                {review.calculation.projectResults.slice(0, 6).map((row) => (
                  <div key={`${row.projectId}-${row.userId}`} className="rounded-[var(--radius-lg)] bg-[var(--surface-panel-strong)] px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span>Project {row.projectId}</span>
                      <span className="font-semibold">{formatCurrency(locale, row.rawUsd)}</span>
                    </div>
                    <p className="mt-1 truncate text-[var(--text-muted)]">{row.userId}</p>
                    <p className="mt-1 text-[var(--text-muted)]">{formatNumber(locale, row.attributionPoints)} / {formatNumber(locale, row.totalProjectPoints)} points</p>
                  </div>
                ))}
                {review.calculation.projectResults.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No raw entitlement rows are linked.</p> : null}
              </div>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] p-4">
              <h2 className="text-base font-semibold text-[var(--text-strong)]">Asset fills</h2>
              <div className="mt-3 space-y-2">
                {review.calculation.assetFills.slice(0, 6).map((row) => (
                  <div key={`${row.userId}-${row.projectId}-${row.assetCode}-${row.preferenceRank}`} className="rounded-[var(--radius-lg)] bg-[var(--surface-panel-strong)] px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span>{row.assetCode}</span>
                      <span className="font-semibold">{formatCurrency(locale, row.usdValue)}</span>
                    </div>
                    <p className="mt-1 truncate text-[var(--text-muted)]">{row.userId}</p>
                    <p className="mt-1 text-[var(--text-muted)]">Rank {row.preferenceRank}{row.partial ? " · partial fill" : ""}</p>
                  </div>
                ))}
                {review.calculation.assetFills.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No selected asset fills are linked.</p> : null}
              </div>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] p-4">
              <h2 className="text-base font-semibold text-[var(--text-strong)]">Returned pools</h2>
              <div className="mt-3 space-y-2">
                {review.calculation.returnedPools.slice(0, 6).map((row) => (
                  <div key={`${row.projectId}-${row.assetCode}-${row.reasonCode}`} className="rounded-[var(--radius-lg)] bg-[var(--surface-panel-strong)] px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span>{row.assetCode}</span>
                      <span className="font-semibold">{formatCurrency(locale, row.usdValue)}</span>
                    </div>
                    <p className="mt-1 text-[var(--text-muted)]">Project {row.projectId} · {row.reasonCode.replaceAll("_", " ")}</p>
                  </div>
                ))}
                {review.calculation.returnedPools.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No future-pool returns are linked.</p> : null}
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
