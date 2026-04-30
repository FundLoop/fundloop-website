import { notFound } from "next/navigation"
import { ArrowLeft, Banknote, CheckCircle2, FileWarning, Route } from "lucide-react"
import { MonthlyCyclePayoutIntentsButton } from "@/components/admin/monthly-cycle-payout-intents-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Link } from "@/i18n/navigation"
import { loadMonthlyCyclePayoutOverview } from "@/lib/monthly-cycles/monthly-cycle-payouts"
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
              Convert approved published user results into concrete payout intents. Execution batches and reconciliation
              stay intentionally separate so future EVM, Solana, and fiat rail adapters have a stable contract to consume.
            </p>
          </div>
          <div className="space-y-3 rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4">
            <Badge variant={overview.cycle.status === "distribution" ? "default" : "secondary"}>{overview.cycle.statusLabel}</Badge>
            <div className="text-sm text-[var(--text-muted)]">{overview.cycle.periodStart} to {overview.cycle.periodEnd}</div>
            <MonthlyCyclePayoutIntentsButton cycleKey={overview.cycle.cycleKey} disabled={!overview.canCreateIntents} />
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
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" />Ready intents</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{overview.intents.readyCount}</div><p className="text-xs text-[var(--text-muted)]">{formatCurrency(locale, overview.intents.totalAmountUsd)} total intent value</p></CardContent>
        </Card>
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
          <CardTitle>Payout intents</CardTitle>
          <CardDescription>These are outbound obligations derived from approved monthly-cycle user results.</CardDescription>
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
    </div>
  )
}
