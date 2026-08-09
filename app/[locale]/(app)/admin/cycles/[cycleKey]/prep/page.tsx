import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSearch, Info, ShieldAlert } from "lucide-react"
import { ProjectAttributionDatasetReviewActions } from "@/components/admin/project-attribution-dataset-review-actions"
import { EpochFundedAllocationActions } from "@/components/admin/epoch-funded-allocation-actions"
import { Link } from "@/i18n/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireInternalAdminActor } from "@/lib/zkas/auth"
import {
  loadMonthlyCyclePrepReview,
  loadEpochFinancialPrepReview,
  loadEpochFundedAllocationReview,
  type MonthlyCyclePrepIssue,
  type MonthlyCyclePrepPosture,
  type MonthlyCyclePrepSeverity,
} from "@/lib/monthly-cycles/monthly-cycle-prep"

type PageProps = {
  params: Promise<{ cycleKey: string; locale: string }>
}

function postureVariant(posture: MonthlyCyclePrepPosture) {
  if (posture === "ready") return "default" as const
  if (posture === "needs_review") return "secondary" as const
  return "destructive" as const
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function sumIntegerValues(left: string | number | null, right: string | number | null) {
  return (BigInt(String(left ?? 0)) + BigInt(String(right ?? 0))).toString()
}

function severityIcon(severity: MonthlyCyclePrepSeverity) {
  if (severity === "blocker") return <ShieldAlert className="h-4 w-4" />
  if (severity === "warning") return <AlertTriangle className="h-4 w-4" />
  return <Info className="h-4 w-4" />
}

function IssueCard({ issue }: { issue: MonthlyCyclePrepIssue }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 text-[var(--interactive-primary)]">{severityIcon(issue.severity)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[var(--text-strong)]">{issue.title}</h3>
            <Badge variant={issue.severity === "blocker" ? "destructive" : issue.severity === "warning" ? "secondary" : "outline"}>
              {issue.severity}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{issue.description}</p>
          {issue.actionHref ? (
            <Button asChild variant="link" className="mt-2 h-auto p-0 text-sm">
              <Link href={issue.actionHref}>Open related surface</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default async function AdminCyclePrepPage({ params }: PageProps) {
  const { cycleKey, locale } = await params
  const [review,financialPrep,fundedAllocation] = await (async () => {
    await requireInternalAdminActor()
    return Promise.all([loadMonthlyCyclePrepReview(cycleKey),loadEpochFinancialPrepReview(cycleKey),loadEpochFundedAllocationReview(cycleKey)])
  })()

  if (!review) {
    notFound()
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div>
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/admin/cycles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to monthly cycles
          </Link>
        </Button>
        <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
                Cycle prep and exception review
              </p>
              <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
                {review.cycle.cycleKey} prep workspace
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
                Review the immutable lock manifest before calculation. This page does not move the cycle forward yet; it
                shows whether operators have blockers, warnings, or a clean handoff into the next monthly stage.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4 lg:min-w-64">
              <Badge variant={postureVariant(review.posture)}>{review.postureLabel}</Badge>
              <p className="text-sm text-[var(--text-muted)]">
                {review.cycle.periodStart} to {review.cycle.periodEnd}
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Status: {review.cycle.status}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-7">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Contribution submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {review.contributionReadiness.submittedCount}/{review.contributionReadiness.expectedProjectCount}
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              {formatCurrency(locale, review.contributionReadiness.totalCalculatedContributionAmount)} calculated ·{" "}
              {review.contributionReadiness.missingProjectCount} missing
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">MVP Attribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{review.attributionReadiness.approvedCount}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              approved · {review.attributionReadiness.reviewRequiredCount} awaiting review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{review.manifest.counts.payments}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">confirmed inputs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reconciliation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{review.manifest.counts.unresolvedOnchainSubmissions}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              unresolved of {review.manifest.counts.onchainSubmissions}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">zkAS Inputs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{review.manifest.counts.approvedDatasets}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              datasets · {review.manifest.counts.identityArtifacts} identity artifacts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{review.manifest.counts.identitySnapshots}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">CUBID snapshots</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Asset priorities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{review.assetPreferenceReadiness.customPreferenceUserCount}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              custom · {review.assetPreferenceReadiness.rejectAllProjectTokenUserCount} reject project tokens
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5 rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-6 shadow-[var(--surface-shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">Funded allocation inputs</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">Valuation, fees, and carryover</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Provisional review-only inputs preserve exact source provenance. They are not claims, payables, revenue, provider instructions, or value movement.
            </p>
          </div>
          <Badge variant="outline">Production disabled</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Sources",String(financialPrep.summary?.source_count ?? 0)],
            ["Gross USD",financialPrep.summary?.gross_exact_usd ?? "0"],
            ["Project fees",financialPrep.summary?.project_fee_exact_usd ?? "0"],
            ["Base fees",financialPrep.summary?.base_fee_exact_usd ?? "0"],
            ["Distributable",financialPrep.summary?.distributable_exact_usd ?? "0"],
          ].map(([label,value])=>(
            <div key={label} className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">{label}</p>
              <p className="mt-2 break-all font-mono text-lg font-semibold text-[var(--text-strong)]">{value}</p>
            </div>
          ))}
        </div>
        {financialPrep.sources.length===0 ? (
          <p className="rounded-[var(--radius-xl)] border border-dashed border-[color:var(--surface-border)] p-4 text-sm text-[var(--text-muted)]">No fee-processed sources are ready. Posted FX and approved packages are required.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-[color:var(--surface-border)]">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-[var(--surface-panel-strong)] text-xs uppercase tracking-[0.12em] text-[var(--text-soft)]"><tr>
                <th className="p-3">Source</th><th className="p-3">Project</th><th className="p-3">Asset / custody</th><th className="p-3">Native</th><th className="p-3">FX</th><th className="p-3">Distributable USD</th><th className="p-3">State</th>
              </tr></thead>
              <tbody>{financialPrep.sources.map((source)=><tr key={source.source_lot_key} className="border-t border-[color:var(--surface-border)]">
                <td className="p-3 font-mono text-xs">{source.source_lot_key}</td><td className="p-3">{source.project_slug}</td><td className="p-3">{source.asset_key} / {source.custody_key}</td>
                <td className="p-3 font-mono">{source.native_atomic_amount}</td><td className="p-3 font-mono">{source.rate_usd_per_unit}</td>
                <td className="p-3 font-mono">{source.distributable_exact_usd}</td><td className="p-3"><Badge variant="secondary">{source.state}</Badge></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-6 shadow-[var(--surface-shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">Settled Cubid redistribution</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">Immutable allocation review</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Equal project shares are discounted by locked Cubid scores. Score shortfalls and overlap-cap overflow fund lowest-current-total-first top-ups under the preserved 3× cap. Results remain provisional: no payable, payout, provider call, or value movement is created here.
            </p>
          </div>
          <Badge variant="outline">Production disabled</Badge>
        </div>
        {fundedAllocation.runtimeAvailable ? <EpochFundedAllocationActions cycleKey={cycleKey} /> : null}
        {fundedAllocation.allocation ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["State",fundedAllocation.allocation.status ?? "locked"],
              ["Funded minor",fundedAllocation.allocation.funded_minor ?? "0"],
              ["Redistribution pool",sumIntegerValues(fundedAllocation.allocation.score_pool_minor,fundedAllocation.allocation.overlap_pool_minor)],
              ["Top-up / residue",`${fundedAllocation.allocation.top_up_minor ?? "0"} / ${fundedAllocation.allocation.returned_residue_minor ?? "0"}`],
              ["Final allocation",fundedAllocation.allocation.final_allocation_minor ?? "0"],
              ["Users",String(fundedAllocation.allocation.user_count ?? 0)],
              ["Manifest",fundedAllocation.allocation.manifest_hash?.slice(0,12) ?? "pending"],
              ["Result",fundedAllocation.allocation.result_hash?.slice(0,12) ?? "pending"],
            ].map(([label,value])=>(
              <div key={label} className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">{label}</p>
                <p className="mt-2 break-all font-mono text-base font-semibold text-[var(--text-strong)]">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-[var(--radius-xl)] border border-dashed border-[color:var(--surface-border)] p-4 text-sm text-[var(--text-muted)]">
            No settled allocation manifest is locked yet. Only approved packages with reconciled, journal-backed source lots can enter this review.
          </p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Exceptions
            </CardTitle>
            <CardDescription>
              Blockers must be resolved before calculation packaging. Warnings require operator review but may be acceptable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {review.issues.length === 0 ? (
              <div className="rounded-[var(--radius-xl)] border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  No prep exceptions found
                </div>
                <p className="mt-2 text-sm">The locked manifest is ready for the next calculation-packaging session.</p>
              </div>
            ) : (
              review.issues.map((issue) => <IssueCard key={`${issue.code}-${issue.description}`} issue={issue} />)
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Manifest integrity</CardTitle>
              <CardDescription>The lock manifest is the source of truth for downstream calculation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Locked at</p>
                <p className="text-[var(--text-strong)]">{review.manifest.lockedAt ?? "Not locked"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Hash</p>
                <p className="break-all font-mono text-xs text-[var(--text-strong)]">
                  {review.manifest.lockedManifestHash ?? "Missing"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Hash check</p>
                <p className="text-[var(--text-strong)]">
                  {review.manifest.hashMatches === null
                    ? "Unavailable"
                    : review.manifest.hashMatches
                      ? "Matches stored manifest"
                      : "Mismatch"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>MVP attribution approval</CardTitle>
              <CardDescription>
                Review scoped-CUBID attribution datasets submitted by project admins before they feed MVP calculation inputs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {review.attributionReadiness.readError ? (
                <p className="text-amber-700 dark:text-amber-200">{review.attributionReadiness.readError}</p>
              ) : review.attributionReadiness.datasets.length === 0 ? (
                <p className="text-[var(--text-muted)]">No MVP attribution datasets are attached to this cycle yet.</p>
              ) : (
                review.attributionReadiness.datasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[var(--text-strong)]">{dataset.projectName}</div>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                          {dataset.rowCount} rows · {dataset.totalAttributionPoints} points
                        </p>
                      </div>
                      <Badge
                        variant={
                          dataset.status === "approved"
                            ? "default"
                            : dataset.status === "rejected"
                              ? "destructive"
                              : dataset.status === "submitted"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        {dataset.status}
                      </Badge>
                    </div>
                    {dataset.note ? <p className="mt-3 text-[var(--text-muted)]">{dataset.note}</p> : null}
                    {dataset.status === "submitted" ? (
                      <div className="mt-4">
                        <ProjectAttributionDatasetReviewActions datasetId={dataset.id} projectName={dataset.projectName} />
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contribution readiness</CardTitle>
              <CardDescription>These live submissions are reviewed before lock-manifest inclusion lands in Goal #56.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Submitted projects</p>
                <p className="text-[var(--text-strong)]">
                  {review.contributionReadiness.submittedCount} of {review.contributionReadiness.expectedProjectCount}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Calculated contribution</p>
                <p className="text-[var(--text-strong)]">
                  {formatCurrency(locale, review.contributionReadiness.totalCalculatedContributionAmount)}
                </p>
              </div>
              {review.contributionReadiness.missingProjects.length > 0 ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Missing projects</p>
                  <ul className="mt-2 space-y-1 text-[var(--text-muted)]">
                    {review.contributionReadiness.missingProjects.slice(0, 5).map((project) => (
                      <li key={project.id}>{project.name}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asset priority readiness</CardTitle>
              <CardDescription>
                User settlement preferences are planning inputs only. Prep surfaces them so future distribution can detect
                token-rejection warnings without exposing private payout destinations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {review.assetPreferenceReadiness.readError ? (
                <p className="text-amber-700 dark:text-amber-200">{review.assetPreferenceReadiness.readError}</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Cycle participants</p>
                      <p className="text-2xl font-semibold text-[var(--text-strong)]">
                        {review.assetPreferenceReadiness.eligibleUserCount}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Preference rows</p>
                      <p className="text-2xl font-semibold text-[var(--text-strong)]">
                        {review.assetPreferenceReadiness.totalPreferenceRowCount}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Custom priorities</p>
                      <p className="text-2xl font-semibold text-[var(--text-strong)]">
                        {review.assetPreferenceReadiness.customPreferenceUserCount}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Using defaults</p>
                      <p className="text-2xl font-semibold text-[var(--text-strong)]">
                        {review.assetPreferenceReadiness.defaultPreferenceUserCount}
                      </p>
                    </div>
                  </div>
                  {review.assetPreferenceReadiness.usersRejectingProjectTokens.length > 0 ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Reject project tokens</p>
                      <ul className="mt-2 space-y-1 text-[var(--text-muted)]">
                        {review.assetPreferenceReadiness.usersRejectingProjectTokens.slice(0, 5).map((user) => (
                          <li key={user.userId}>{user.displayName ?? user.email ?? user.userId}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next monthly stage</CardTitle>
              <CardDescription>Review the cycle-anchored zkAS stage before calculation packaging.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" variant="outline">
                <Link href={`/admin/cycles/${review.cycle.cycleKey}/zkas`}>Open cycle zkAS stage</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live-row drift</CardTitle>
              <CardDescription>These are informational only; calculation should use the locked manifest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {review.liveDriftWarnings.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No live-count drift detected for the checked tables.</p>
              ) : (
                review.liveDriftWarnings.map((issue) => <IssueCard key={issue.code} issue={issue} />)
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
