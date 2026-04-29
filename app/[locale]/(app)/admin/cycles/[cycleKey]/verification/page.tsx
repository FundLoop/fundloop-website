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
    </div>
  )
}
