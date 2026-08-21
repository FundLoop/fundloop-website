export type ProjectPaymentDraftInput = {
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method_id: number
}

export type NormalizedProjectPaymentDraft = {
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method_id: number
}

type ValidationResult =
  | { ok: true; data: NormalizedProjectPaymentDraft[] }
  | { ok: false; error: string }

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp)
}

function normalizeMoney(value: number) {
  return Number(value.toFixed(2))
}

export function validateProjectPaymentDrafts(rows: ProjectPaymentDraftInput[]): ValidationResult {
  if (rows.length === 0) {
    return { ok: false, error: "Add at least one payment period before saving." }
  }

  const normalized: NormalizedProjectPaymentDraft[] = []

  for (const [index, row] of rows.entries()) {
    if (!isValidIsoDate(row.period_start) || !isValidIsoDate(row.period_end)) {
      return { ok: false, error: `Payment period ${index + 1} must include valid start and end dates.` }
    }

    if (Date.parse(`${row.period_end}T00:00:00Z`) < Date.parse(`${row.period_start}T00:00:00Z`)) {
      return { ok: false, error: `Payment period ${index + 1} ends before it starts.` }
    }

    if (!Number.isFinite(row.revenue) || row.revenue <= 0) {
      return { ok: false, error: `Payment period ${index + 1} must include revenue greater than zero.` }
    }

    if (!Number.isFinite(row.payment_amount) || row.payment_amount <= 0) {
      return { ok: false, error: `Payment period ${index + 1} must include a payment amount greater than zero.` }
    }

    if (!Number.isFinite(row.payment_percentage) || row.payment_percentage <= 0) {
      return { ok: false, error: `Payment period ${index + 1} must include a payment percentage greater than zero.` }
    }

    if (!Number.isInteger(row.payment_method_id) || row.payment_method_id <= 0) {
      return { ok: false, error: `Payment period ${index + 1} must use a valid payment method.` }
    }

    normalized.push({
      period_start: row.period_start,
      period_end: row.period_end,
      revenue: normalizeMoney(row.revenue),
      payment_amount: normalizeMoney(row.payment_amount),
      payment_percentage: Number(row.payment_percentage.toFixed(4)),
      payment_method_id: row.payment_method_id,
    })
  }

  return { ok: true, data: normalized }
}
