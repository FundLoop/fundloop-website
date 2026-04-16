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
