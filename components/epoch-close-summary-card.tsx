import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function EpochCloseSummaryCard({ eyebrow, title, description, cycleKey, rootHash, values }: {
  eyebrow: string
  title: string
  description: string
  cycleKey: string
  rootHash: string
  values: Array<{ label: string; value: string }>
}) {
  return <Card className="border-cyan-300/60 dark:border-cyan-500/30">
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--interactive-primary)]">{eyebrow}</p><CardTitle className="mt-2">{title}</CardTitle></div>
        <Badge variant="outline">{cycleKey} · payout readying</Badge>
      </div>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{values.map((row)=><div key={row.label} className="rounded-xl border border-[color:var(--surface-border)] p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">{row.label}</p><p className="mt-1 font-mono font-semibold text-[var(--text-strong)]">{row.value}</p>
      </div>)}</div>
      <p className="break-all font-mono text-xs text-[var(--text-muted)]">Close root: {rootHash}</p>
    </CardContent>
  </Card>
}
