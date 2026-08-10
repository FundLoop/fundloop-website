import { notFound } from "next/navigation"
import { ArrowLeft, Banknote, CheckCircle2, FileWarning, Route } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BasePayoutOperatorControls } from "@/components/admin/base-payout-operator-controls"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Link } from "@/i18n/navigation"
import { loadMonthlyCyclePayoutOverview } from "@/lib/monthly-cycles/monthly-cycle-payouts"
import { loadBasePayoutOperatorOverview } from "@/lib/base-payout/base-payout-operator-overview"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

type PageProps = {
  params: Promise<{ cycleKey: string; locale: string }>
}

function formatCurrency(locale: string, value: number) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
}

export default async function AdminCyclePayoutsPage({ params }: PageProps) {
  const { cycleKey, locale } = await params
  const overview = await (async () => {
    await requireInternalAdminActor()
    return loadMonthlyCyclePayoutOverview(cycleKey)
  })()

  if (!overview) notFound()
  const basePayout = await loadBasePayoutOperatorOverview(overview.cycle.id)

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <Button asChild variant="ghost">
        <Link href="/admin/cycles">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to monthly cycles
        </Link>
      </Button>

      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
              Outbound payout domain
            </p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
              {overview.cycle.cycleKey} payout work
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
              Review credited-but-not-paid bookkeeping earnings before any future settlement planning. Payout intents,
              execution batches, and reconciliation stay intentionally separate; this page does not transfer funds.
            </p>
          </div>
          <div className="space-y-3 rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4">
            <Badge variant={overview.cycle.status === "distribution" ? "default" : "secondary"}>{overview.cycle.statusLabel}</Badge>
            <div className="text-sm text-[var(--text-muted)]">{overview.cycle.periodStart} to {overview.cycle.periodEnd}</div>
            <p className="max-w-xs text-sm text-[var(--text-muted)]">Direct result-based intent creation is retired. Users create project-scoped withdrawal reservations from their earnings workspace.</p>
          </div>
        </div>
      </section>

      {overview.warnings.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileWarning className="h-4 w-4" />
              Some payout reads are temporarily unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {overview.warnings.map((warning) => (
              <p key={`${warning.scope}-${warning.message}`}>
                <span className="font-semibold">{warning.scope}:</span> {warning.message}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Banknote className="h-4 w-4" />Published results</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{formatCurrency(locale, overview.publishedResults.totalAmountUsd)}</div><p className="text-xs text-[var(--text-muted)]">{overview.publishedResults.count} user allocations</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" />Bookkeeping credits</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{formatCurrency(locale, overview.bookkeepingCredits.totalCreditedUsd)}</div><p className="text-xs text-[var(--text-muted)]">{overview.bookkeepingCredits.count} credited rows, not paid yet</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Returned future pool</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{formatCurrency(locale, overview.returnedPools.totalAmountUsd)}</div><p className="text-xs text-[var(--text-muted)]">{overview.returnedPools.count} returned pool rows</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" />Ready intents</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{overview.intents.readyCount}</div><p className="text-xs text-[var(--text-muted)]">{formatCurrency(locale, overview.intents.totalAmountUsd)} total intent value</p></CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Route className="h-4 w-4" />Missing routes</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{overview.intents.missingRouteCount}</div><p className="text-xs text-[var(--text-muted)]">Draft intents awaiting user payout preferences</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Batches</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{overview.batches.count}</div><p className="text-xs text-[var(--text-muted)]">{overview.batches.intentCount} intents batched later</p></CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Bookkeeping credits</CardTitle>
          <CardDescription>
            Approved monthly results credited to user accounts. These records are explicitly not paid yet and do not expose private payout destinations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Asset fills</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.bookkeepingCredits.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-[var(--text-muted)]">
                    No bookkeeping credits exist yet. Create credits after approval; do not create payout intents as a substitute.
                  </TableCell>
                </TableRow>
              ) : (
                overview.bookkeepingCredits.rows.map((credit) => (
                  <TableRow key={credit.id}>
                    <TableCell className="font-mono text-xs">{credit.user_id}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={credit.status === "credited" ? "default" : "secondary"}>{credit.status}</Badge>
                        <Badge variant="outline">{credit.payment_status.replaceAll("_", " ")}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(locale, Number(credit.usd_equivalent_amount ?? 0))}</TableCell>
                    <TableCell>{Array.isArray(credit.asset_fills) ? credit.asset_fills.length : 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Returned future-pool amounts</CardTitle>
          <CardDescription>Amounts that were not credited to users and remain separate from user earnings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.returnedPools.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-[var(--text-muted)]">
                    No returned future-pool rows are linked to this cycle.
                  </TableCell>
                </TableRow>
              ) : (
                overview.returnedPools.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>Project #{row.project_id}</TableCell>
                    <TableCell>{row.asset_type} · {row.asset_code}</TableCell>
                    <TableCell>{formatCurrency(locale, Number(row.usd_value ?? 0))}</TableCell>
                    <TableCell>{row.reason_code.replaceAll("_", " ")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout intents</CardTitle>
          <CardDescription>These are later outbound planning records. They are not required for MVP bookkeeping credits.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rail</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Route</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.intents.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-[var(--text-muted)]">
                    No payout intents exist yet. Create them after the cycle reaches approval and published user results exist.
                  </TableCell>
                </TableRow>
              ) : (
                overview.intents.rows.map((intent) => (
                  <TableRow key={intent.id}>
                    <TableCell className="font-mono text-xs">{intent.user_id}</TableCell>
                    <TableCell><Badge variant={intent.status === "ready" ? "default" : "secondary"}>{intent.status}</Badge></TableCell>
                    <TableCell>{intent.rail ?? "Pending route"}</TableCell>
                    <TableCell>{formatCurrency(locale, Number(intent.amount_usd ?? 0))}</TableCell>
                    <TableCell>{intent.payout_route_id ? `#${intent.payout_route_id}` : intent.status_reason ?? "Missing"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BasePayoutOperatorControls enabled={basePayout.enabled} deployments={basePayout.deployments} commands={basePayout.commands}
        intents={overview.intents.rows.map((intent)=>({id:intent.id,rail:intent.rail,status:intent.status,amount_usd:Number(intent.amount_usd),payout_route_id:intent.payout_route_id}))}/>
    </div>
  )
}
