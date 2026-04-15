import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  PAYMENT_FLOW_ACTOR_ROLES,
  PAYMENT_FLOWS,
  PAYMENT_FLOW_OUTCOMES,
  type PaymentFlow,
  type PaymentFlowActorRole,
  type PaymentFlowOutcome,
} from "@/lib/observability/payment-flow"
import {
  buildAttemptLabel,
  formatEventError,
  listAttemptPaymentFlowEvents,
  listPaymentFlowEvents,
  listPaymentFlowSummaries,
} from "@/lib/observability/payment-flow-server"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

function formatLabel(value: string) {
  return value.replaceAll("_", " ")
}

function parseOptionalNumber(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function getSeverityBadgeVariant(severity: string) {
  switch (severity) {
    case "error":
      return "destructive" as const
    case "warning":
      return "secondary" as const
    default:
      return "outline" as const
  }
}

export const dynamic = "force-dynamic"

export default async function AdminPaymentsObservabilityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireInternalAdminActor()
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const flowParam = typeof resolvedSearchParams.flow === "string" ? resolvedSearchParams.flow : undefined
  const outcomeParam = typeof resolvedSearchParams.outcome === "string" ? resolvedSearchParams.outcome : undefined
  const actorRoleParam = typeof resolvedSearchParams.actorRole === "string" ? resolvedSearchParams.actorRole : undefined
  const attemptIdParam = typeof resolvedSearchParams.attemptId === "string" ? resolvedSearchParams.attemptId : undefined
  const projectIdParam = typeof resolvedSearchParams.projectId === "string" ? resolvedSearchParams.projectId : undefined
  const paymentIdParam = typeof resolvedSearchParams.paymentId === "string" ? resolvedSearchParams.paymentId : undefined
  const daysParam = typeof resolvedSearchParams.days === "string" ? resolvedSearchParams.days : "7"

  const flow = PAYMENT_FLOWS.includes(flowParam as PaymentFlow) ? (flowParam as PaymentFlow) : undefined
  const outcome = PAYMENT_FLOW_OUTCOMES.includes(outcomeParam as PaymentFlowOutcome)
    ? (outcomeParam as PaymentFlowOutcome)
    : undefined
  const actorRole = PAYMENT_FLOW_ACTOR_ROLES.includes(actorRoleParam as PaymentFlowActorRole)
    ? (actorRoleParam as PaymentFlowActorRole)
    : undefined
  const projectId = parseOptionalNumber(projectIdParam)
  const paymentId = parseOptionalNumber(paymentIdParam)
  const days = parseOptionalNumber(daysParam) ?? 7

  const [summaries, events, attemptEvents] = await Promise.all([
    listPaymentFlowSummaries(),
    listPaymentFlowEvents({
      flow,
      outcome,
      actorRole,
      projectId,
      paymentId,
      attemptId: attemptIdParam,
      days,
      limit: 50,
    }),
    attemptIdParam ? listAttemptPaymentFlowEvents(attemptIdParam) : Promise.resolve([]),
  ])

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/admin/payments">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Payments</span>
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Payment Flow Observability</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Investigate wallet connect, payment save, receipt recording, and admin confirmation attempts with recent failure
          summaries and per-attempt drill-downs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaries.map((summary) => (
          <Card key={summary.flow}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize">{formatLabel(summary.flow)}</CardTitle>
              <CardDescription>24h attempts / 7d failures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-2xl font-bold">{summary.last24h.attempts}</div>
              <p>24h successes: {summary.last24h.successes}</p>
              <p>24h failures: {summary.last24h.failures}</p>
              <p>7d failures: {summary.last7d.failures}</p>
              <p className="text-xs text-slate-500">
                Latest failure:{" "}
                {summary.last7d.latestFailureAt
                  ? formatDistanceToNow(new Date(summary.last7d.latestFailureAt), { addSuffix: true })
                  : "none"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow the event stream by flow, outcome, actor role, project, payment, or attempt.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3 xl:grid-cols-6" method="get">
            <label className="space-y-2 text-sm">
              <span>Flow</span>
              <select name="flow" defaultValue={flow ?? ""} className="flex h-10 w-full rounded-md border bg-background px-3 py-2">
                <option value="">All flows</option>
                {PAYMENT_FLOWS.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>Outcome</span>
              <select
                name="outcome"
                defaultValue={outcome ?? ""}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="">All outcomes</option>
                {PAYMENT_FLOW_OUTCOMES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>Actor role</span>
              <select
                name="actorRole"
                defaultValue={actorRole ?? ""}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="">All roles</option>
                {PAYMENT_FLOW_ACTOR_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>Project ID</span>
              <Input name="projectId" defaultValue={projectIdParam ?? ""} placeholder="17" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Payment ID</span>
              <Input name="paymentId" defaultValue={paymentIdParam ?? ""} placeholder="248" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Days</span>
              <select name="days" defaultValue={String(days)} className="flex h-10 w-full rounded-md border bg-background px-3 py-2">
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <label className="space-y-2 text-sm md:col-span-2 xl:col-span-5">
              <span>Attempt ID</span>
              <Input name="attemptId" defaultValue={attemptIdParam ?? ""} placeholder="paste an attempt id to inspect one interaction" />
            </label>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Apply filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {attemptIdParam ? (
        <Card>
          <CardHeader>
            <CardTitle>{buildAttemptLabel(attemptIdParam)}</CardTitle>
            <CardDescription>All captured events for the selected attempt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {attemptEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No events found for this attempt.</p>
            ) : (
              attemptEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getSeverityBadgeVariant(event.severity)}>{event.outcome}</Badge>
                    <span className="font-medium capitalize">{formatLabel(event.stage)}</span>
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-2 text-slate-700">{formatEventError(event)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Latest matching observability events for the selected filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Flow</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    No observability events match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium capitalize">{formatLabel(event.flow)}</div>
                      <div className="text-xs text-slate-500 capitalize">{formatLabel(event.stage)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityBadgeVariant(event.severity)}>{event.outcome}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{event.project_name ?? "Unknown project"}</div>
                      <div className="text-xs text-slate-500">{event.project_slug ?? "No slug"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{event.payment_id ? `#${event.payment_id}` : "—"}</TableCell>
                    <TableCell>
                      <Link href={`/admin/payments/observability?attemptId=${encodeURIComponent(event.attempt_id)}`} className="text-sm text-blue-600 underline underline-offset-2">
                        {buildAttemptLabel(event.attempt_id)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md text-sm text-slate-700">{formatEventError(event)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {event.actor_role}
                        {event.tx_hash ? ` · ${event.tx_hash.slice(0, 10)}…` : ""}
                      </div>
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
