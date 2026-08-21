import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, Activity, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  formatMonthlyCycleEventType,
  loadMonthlyCycleObservabilityOverview,
  monthlyCyclePipelineStages,
  type MonthlyCyclePipelineStage,
} from "@/lib/observability/monthly-cycle-events"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

function formatLabel(value: string) {
  return value.replaceAll("_", " ")
}

function parseOptionalNumber(value: string | undefined) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function getSeverityBadgeVariant(severity: string) {
  if (severity === "error") return "destructive" as const
  if (severity === "warning") return "secondary" as const
  return "outline" as const
}

function getOutcomeBadgeVariant(outcome: string) {
  if (outcome === "failure") return "destructive" as const
  if (outcome === "success") return "default" as const
  return "outline" as const
}

export const dynamic = "force-dynamic"

export default async function AdminCycleObservabilityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireInternalAdminActor()
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const cycleKey = typeof resolvedSearchParams.cycleKey === "string" ? resolvedSearchParams.cycleKey : undefined
  const stageParam = typeof resolvedSearchParams.stage === "string" ? resolvedSearchParams.stage : undefined
  const outcome = typeof resolvedSearchParams.outcome === "string" ? resolvedSearchParams.outcome : undefined
  const severity = typeof resolvedSearchParams.severity === "string" ? resolvedSearchParams.severity : undefined
  const attemptId = typeof resolvedSearchParams.attemptId === "string" ? resolvedSearchParams.attemptId : undefined
  const daysParam = typeof resolvedSearchParams.days === "string" ? resolvedSearchParams.days : "14"
  const stage = monthlyCyclePipelineStages.includes(stageParam as MonthlyCyclePipelineStage)
    ? (stageParam as MonthlyCyclePipelineStage)
    : undefined
  const days = parseOptionalNumber(daysParam) ?? 14

  const data = await loadMonthlyCycleObservabilityOverview({
    cycleKey,
    stage,
    outcome: outcome === "attempt" || outcome === "success" || outcome === "failure" ? outcome : undefined,
    severity: severity === "info" || severity === "warning" || severity === "error" ? severity : undefined,
    attemptId,
    days,
  })

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/admin/cycles">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to cycles</span>
          </Link>
        </Button>
      </div>

      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="max-w-3xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
            Monthly pipeline observability
          </p>
          <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
            Cycle Events
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
            Inspect lock, prep, calculation, verification, payout, and reporting events across monthly cycles. This is the
            operator audit trail that future MCP tools should expose rather than inventing a parallel protocol log.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.totals.eventCount}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              {data.totals.affectedCycleCount} affected cycles
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              Failures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.totals.failureCount}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Across selected filters</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock3 className="h-4 w-4" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.totals.warningCount}</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Needs operator review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Source of truth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">DB log</div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">No separate MCP log</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.summaries.map((summary) => (
          <Card key={summary.stage}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize">{summary.stage}</CardTitle>
              <CardDescription>Attempts / successes / failures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-2xl font-bold">
                {summary.attempts} / {summary.successes} / {summary.failures}
              </div>
              <p>Warnings: {summary.warnings}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Latest event:{" "}
                {summary.latestEventAt
                  ? formatDistanceToNow(new Date(summary.latestEventAt), { addSuffix: true })
                  : "none"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Latest failure:{" "}
                {summary.latestFailureAt
                  ? formatDistanceToNow(new Date(summary.latestFailureAt), { addSuffix: true })
                  : "none"}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow the monthly event stream by cycle, stage, outcome, severity, or attempt.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3 xl:grid-cols-6" method="get">
            <label className="space-y-2 text-sm">
              <span>Cycle key</span>
              <Input name="cycleKey" defaultValue={cycleKey ?? ""} placeholder="2026-04" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Stage</span>
              <select name="stage" defaultValue={stage ?? ""} className="flex h-10 w-full rounded-md border bg-background px-3 py-2">
                <option value="">All stages</option>
                {monthlyCyclePipelineStages.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>Outcome</span>
              <select name="outcome" defaultValue={outcome ?? ""} className="flex h-10 w-full rounded-md border bg-background px-3 py-2">
                <option value="">All outcomes</option>
                {["attempt", "success", "failure"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>Severity</span>
              <select name="severity" defaultValue={severity ?? ""} className="flex h-10 w-full rounded-md border bg-background px-3 py-2">
                <option value="">All severities</option>
                {["info", "warning", "error"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>Attempt ID</span>
              <Input name="attemptId" defaultValue={attemptId ?? ""} placeholder="attempt..." />
            </label>
            <label className="space-y-2 text-sm">
              <span>Days</span>
              <Input name="days" inputMode="numeric" defaultValue={String(days)} />
            </label>
            <div className="flex items-end gap-2 md:col-span-3 xl:col-span-6">
              <Button type="submit">Apply filters</Button>
              <Button asChild variant="ghost">
                <Link href="/admin/cycles/observability">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {attemptId && data.attemptEvents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Attempt drill-down</CardTitle>
            <CardDescription>All monthly cycle events recorded for this attempt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.attemptEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-[color:var(--surface-border)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getOutcomeBadgeVariant(event.outcome)}>{event.outcome}</Badge>
                  <Badge variant={getSeverityBadgeVariant(event.severity)}>{event.severity}</Badge>
                  <span className="text-sm font-medium">{formatMonthlyCycleEventType(event.event_type)}</span>
                  <span className="text-xs text-[var(--text-muted)]">{new Date(event.created_at).toLocaleString()}</span>
                </div>
                {event.message ? <p className="mt-2 text-sm text-[var(--text-muted)]">{event.message}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Event stream</CardTitle>
          <CardDescription>Latest matching monthly cycle events for the selected filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Attempt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-[var(--text-muted)]">
                    No monthly cycle events match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(event.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="font-medium">{event.cycle_key}</div>
                      <div className="text-xs text-[var(--text-muted)]">{event.status ?? "status unavailable"}</div>
                    </TableCell>
                    <TableCell className="capitalize">{event.stage}</TableCell>
                    <TableCell>{formatMonthlyCycleEventType(event.event_type)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={getOutcomeBadgeVariant(event.outcome)}>{event.outcome}</Badge>
                        <Badge variant={getSeverityBadgeVariant(event.severity)}>{event.severity}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-[var(--text-muted)]">{event.message ?? "No message"}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/cycles/observability?attemptId=${encodeURIComponent(event.attempt_id)}`}
                        className="font-mono text-xs text-blue-600 underline underline-offset-2 dark:text-blue-300"
                      >
                        {event.attempt_id.slice(0, 16)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
