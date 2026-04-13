import { PaymentsConsole } from "@/components/admin/payments-console"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalAdminActor } from "@/lib/zkas/auth"
import type { PaymentRecordSummary } from "@/app/actions/project-payment-actions"

type PaymentRow = {
  id: number
  project_id: number | null
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method_id: number | null
  status_id: number | null
  created_at: string | null
  updated_at: string | null
  paid_at: string | null
  confirmed_at: string | null
  notes: string | null
  projects: { name: string; slug: string | null } | null
  ref_payment_methods: { name: string; code: string } | null
  ref_payment_statuses: { name: string; code: string } | null
}

function mapPayment(row: PaymentRow): PaymentRecordSummary {
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
  }
}

export default async function AdminPaymentsPage() {
  const data = await (async () => {
    await requireInternalAdminActor()
    const supabase = getAdminSupabaseClient()
    const { data, error } = await supabase
      .from("payments")
      .select(`
        id,
        project_id,
        period_start,
        period_end,
        revenue,
        payment_amount,
        payment_percentage,
        payment_method_id,
        status_id,
        created_at,
        updated_at,
        paid_at,
        confirmed_at,
        notes,
        projects(name, slug),
        ref_payment_methods(name, code),
        ref_payment_statuses(name, code)
      `)
      .order("period_end", { ascending: false })
      .order("id", { ascending: false })

    if (error) {
      throw error
    }

    return (data ?? []) as PaymentRow[]
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "You cannot access internal payment operations.",
  }))

  if ("error" in data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{data.error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return <PaymentsConsole initialPayments={data.map(mapPayment)} />
}
