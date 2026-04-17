import type { OnchainSubmissionSummary } from "../onchain/payment-submissions"

export type PaymentRecordSummary = {
  id: number
  project_id: number | null
  project_name: string
  project_slug: string | null
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method_id: number | null
  payment_method_name: string
  payment_method_code: string
  status_id: number | null
  status_name: string
  status_code: string
  created_at: string | null
  updated_at: string | null
  paid_at: string | null
  confirmed_at: string | null
  notes: string | null
  latest_onchain_submission: OnchainSubmissionSummary | null
}

export type PaymentRecordSummaryRow = {
  id: number
  project_id: number | null
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method_id: number | null
  status_id: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  paid_at: string | null
  confirmed_at: string | null
  projects: {
    name: string
    slug: string | null
  } | null
  ref_payment_methods: {
    name: string
    code: string
  } | null
  ref_payment_statuses: {
    name: string
    code: string
  } | null
}

export function mapPaymentRecordSummary(row: PaymentRecordSummaryRow): PaymentRecordSummary {
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.projects?.name ?? "Unknown project",
    project_slug: row.projects?.slug ?? null,
    period_start: row.period_start,
    period_end: row.period_end,
    revenue: row.revenue,
    payment_amount: row.payment_amount,
    payment_percentage: row.payment_percentage,
    payment_method_id: row.payment_method_id,
    payment_method_name: row.ref_payment_methods?.name ?? "Unknown",
    payment_method_code: row.ref_payment_methods?.code ?? "unknown",
    status_id: row.status_id,
    status_name: row.ref_payment_statuses?.name ?? "Unknown",
    status_code: row.ref_payment_statuses?.code ?? "unknown",
    created_at: row.created_at,
    updated_at: row.updated_at,
    paid_at: row.paid_at,
    confirmed_at: row.confirmed_at,
    notes: row.notes,
    latest_onchain_submission: null,
  }
}
