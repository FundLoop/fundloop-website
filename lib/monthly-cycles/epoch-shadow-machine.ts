export const epochShadowStages = [
  "collecting", "reconciling", "valuing", "fee_processing", "carryover_payouts",
  "locking", "allocating", "reviewing", "payout_readying", "payout_open", "expired", "closed",
] as const

export type EpochShadowStage = (typeof epochShadowStages)[number]

export const epochLegacyCompatibility: Record<EpochShadowStage, string> = {
  collecting: "open", reconciling: "prep", valuing: "prep", fee_processing: "prep",
  carryover_payouts: "prep", locking: "locked", allocating: "calculation", reviewing: "approval",
  payout_readying: "distribution", payout_open: "distribution", expired: "completed", closed: "reporting",
}

export function nextEpochShadowStage(stage: EpochShadowStage): EpochShadowStage | null {
  const index = epochShadowStages.indexOf(stage)
  return index < 0 || index === epochShadowStages.length - 1 ? null : epochShadowStages[index + 1]
}

const pacificParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
})

function partsAt(date: Date) {
  return Object.fromEntries(pacificParts.formatToParts(date).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]))
}

export function pacificLocalToUtc(year: number, month: number, day: number, hour = 0) {
  const desired = Date.UTC(year, month - 1, day, hour)
  let candidate = desired
  for (let count = 0; count < 4; count += 1) {
    const p = partsAt(new Date(candidate))
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    candidate += desired - represented
  }
  return new Date(candidate)
}

export function pacificMonthEndCutoff(year: number, month: number) {
  const next = new Date(Date.UTC(year, month, 1))
  return pacificLocalToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, 1)
}

export function emailRelativeOptOutDeadline(deliveredAt: Date, holidays: ReadonlySet<string>) {
  const delivered = partsAt(deliveredAt)
  let cursor = new Date(Date.UTC(delivered.year, delivered.month - 1, delivered.day + 1))
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6 && !holidays.has(key)) {
      return pacificLocalToUtc(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate() + 1)
    }
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
}

export function payoutExpiryAt(openedAt: Date, lifespanMonths = 3) {
  const opened = partsAt(openedAt)
  const expiryMonth = new Date(Date.UTC(opened.year, opened.month - 1 + lifespanMonths, 1))
  return pacificLocalToUtc(expiryMonth.getUTCFullYear(), expiryMonth.getUTCMonth() + 1, 1)
}

export function evaluateEpochTransition(input: {
  stage: EpochShadowStage
  now: Date
  periodEnd?: Date
  payoutOpenedAt?: Date
  carryoverComplete?: boolean
}) {
  if (input.stage === "collecting" && input.periodEnd && input.now >= input.periodEnd) return "reconciling" as const
  if (input.stage === "payout_open" && input.payoutOpenedAt && input.now >= payoutExpiryAt(input.payoutOpenedAt)) return "expired" as const
  if (input.stage === "expired" && input.carryoverComplete) return "closed" as const
  return null
}
