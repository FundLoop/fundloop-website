"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import {
  createProjectPaymentDrafts,
  listProjectLatestOnchainSubmissions,
  listProjectManagedCryptoPaymentMethods,
  type ManagedCryptoPaymentMethodSummary,
} from "@/app/actions/project-payment-actions"
import {
  ProjectCryptoPaymentDialog,
  type CryptoPaymentMethodOption,
} from "@/components/project-crypto-payment-dialog"
import { buildLatestOnchainSubmissionMap, type OnchainSubmissionSummary } from "@/lib/onchain/payment-submissions"
import { ProjectCryptoRouteManager } from "@/components/project-crypto-route-manager"
import { ArrowLeft, Plus, Calculator, Save, AlertTriangle, Trash2, Info } from "lucide-react"

interface PaymentMethod {
  id: number
  name: string
  code: string
  description: string | null
}

interface PaymentStatus {
  id: number
  name: string
  code: string
  description: string | null
}

interface PaymentPeriodicity {
  id: number
  name: string
  code: string
  description: string | null
}

interface Project {
  id: number
  slug: string | null
  name: string
  payment_percentage: number | null
  payment_periodicity_id: number | null
  payment_custom_days: number | null
  default_payment_method_id: number | null
}

interface Payment {
  id: number
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method_id: number | null
  payment_method_name: string
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

interface NewPaymentRow {
  id: string // Temporary ID for UI
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method_id: number
}

const periodTagLabels: Record<number, string> = {
  0: "Current / unspecified",
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
}

export default function ProjectPaymentsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [projectId, setProjectId] = useState<number | null>(null)

  const [project, setProject] = useState<Project | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatus[]>([])
  const [paymentPeriodicities, setPaymentPeriodicities] = useState<PaymentPeriodicity[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [newPaymentRows, setNewPaymentRows] = useState<NewPaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [managedCryptoPaymentMethods, setManagedCryptoPaymentMethods] = useState<ManagedCryptoPaymentMethodSummary[]>([])
  const [cryptoPaymentDialogOpen, setCryptoPaymentDialogOpen] = useState(false)
  const [paymentToPay, setPaymentToPay] = useState<Payment | null>(null)

  const cryptoPaymentMethods = useMemo<CryptoPaymentMethodOption[]>(
    () =>
      managedCryptoPaymentMethods
        .filter((method) => method.is_enabled)
        .map((method) => ({
          id: method.id,
          label: method.label,
          is_default: method.is_default,
          is_runtime_available: method.is_runtime_available,
          runtime_availability_issue: method.runtime_availability_issue,
          chain: {
            id: method.chain.id,
            display_name: method.chain.display_name,
            network_key: method.chain.network_key,
            evm_chain_id: method.chain.evm_chain_id,
            native_asset_symbol: method.chain.native_asset_symbol,
          },
          asset: {
            id: method.asset.id,
            symbol: method.asset.symbol,
            name: method.asset.name,
            token_address: method.asset.token_address,
            decimals: method.asset.decimals,
            is_native: method.asset.is_native,
            is_stablecoin: method.asset.is_stablecoin,
          },
          intakeContract: {
            id: method.intakeContract.id,
            contract_address: method.intakeContract.contract_address,
            treasury_address: method.intakeContract.treasury_address,
          },
        })),
    [managedCryptoPaymentMethods],
  )

  useEffect(() => {
    const fetchProjectData = async () => {
      const supabase = getSupabaseBrowserClient()

      try {
        setLoading(true)

        const { data: paymentMethodsData, error: paymentMethodsError } = await supabase
          .from("ref_payment_methods")
          .select("id, name, code, description")
          .order("display_order")

        if (paymentMethodsError) throw paymentMethodsError

        const { data: paymentStatusesData, error: paymentStatusesError } = await supabase
          .from("ref_payment_statuses")
          .select("id, name, code, description")
          .order("display_order")

        if (paymentStatusesError) throw paymentStatusesError

        const { data: paymentPeriodicitiesData, error: paymentPeriodicitiesError } = await supabase
          .from("ref_payment_periodicities")
          .select("id, name, code, description")
          .order("display_order")

        if (paymentPeriodicitiesError) throw paymentPeriodicitiesError

        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select(
            "id, slug, name, payment_percentage, payment_periodicity_id, payment_custom_days, default_payment_method_id"
          )
          .eq("slug", slug)
          .single()

        if (projectError) throw projectError

        setProjectId(projectData.id)

        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select(`
           id, period_start, period_end, revenue, payment_amount, payment_percentage,
           payment_method_id, status_id, created_at, updated_at, paid_at, confirmed_at, notes,
           ref_payment_methods(name, code),
           ref_payment_statuses(name, code)
         `)
          .eq("project_id", projectData.id)
          .order("period_start", { ascending: false })

        if (paymentsError) throw paymentsError

        const latestOnchainSubmissionsResult = await listProjectLatestOnchainSubmissions(slug)
        const latestOnchainSubmissionByPaymentId = latestOnchainSubmissionsResult.ok
          ? buildLatestOnchainSubmissionMap(latestOnchainSubmissionsResult.data)
          : new Map<number, OnchainSubmissionSummary>()

        const transformedPayments =
          paymentsData?.map((payment) => ({
            id: payment.id,
            period_start: payment.period_start,
            period_end: payment.period_end,
            revenue: payment.revenue,
            payment_amount: payment.payment_amount,
            payment_percentage: payment.payment_percentage,
            payment_method_id: payment.payment_method_id,
            payment_method_name: payment.ref_payment_methods?.name || "Unknown",
            status_id: payment.status_id,
            status_name: payment.ref_payment_statuses?.name || "Unknown",
            status_code: payment.ref_payment_statuses?.code || "unknown",
            created_at: payment.created_at,
            updated_at: payment.updated_at,
            paid_at: payment.paid_at,
            confirmed_at: payment.confirmed_at,
            notes: payment.notes,
            latest_onchain_submission: latestOnchainSubmissionByPaymentId.get(payment.id) ?? null,
          })) || []

        setPaymentMethods(paymentMethodsData || [])
        setPaymentStatuses(paymentStatusesData || [])
        setPaymentPeriodicities(paymentPeriodicitiesData || [])
        setProject(projectData ? { ...projectData, slug: projectData.slug ?? slug } : null)
        setPayments(transformedPayments)

        const cryptoRoutesResult = await listProjectManagedCryptoPaymentMethods(slug)
        if (cryptoRoutesResult.ok) {
          setManagedCryptoPaymentMethods(cryptoRoutesResult.data)
        }

        setNewPaymentRows([
          {
            id: crypto.randomUUID(),
            period_start: "",
            period_end: "",
            revenue: 0,
            payment_amount: 0,
            payment_percentage: projectData.payment_percentage || 1.0,
            payment_method_id: projectData.default_payment_method_id || 0,
          },
        ])
      } catch (error) {
        console.error("Error fetching project data:", error)
        toast({
          title: "Error",
          description: "Failed to load project payment data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    void fetchProjectData()
  }, [slug])

  const getDefaultPeriod = () => {
    // Get the most recent payment end date
    const sortedPayments = [...payments].sort(
      (a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime(),
    )

    const today = new Date()
    let startDate: Date
    let endDate: Date

    if (sortedPayments.length > 0) {
      // Start from the day after the last payment period
      startDate = addDays(new Date(sortedPayments[0].period_end), 1)

      // Calculate end date based on project periodicity
      const periodicity = paymentPeriodicities.find((p) => p.id === project?.payment_periodicity_id)

      if (periodicity?.code === "week") {
        endDate = addDays(startDate, 6) // 7 days total (start date + 6)
      } else if (periodicity?.code === "month") {
        // Approximate a month
        endDate = addDays(startDate, 30)
      } else if (periodicity?.code === "custom" && project?.payment_custom_days) {
        endDate = addDays(startDate, project.payment_custom_days - 1)
      } else {
        // Default to month
        endDate = addDays(startDate, 30)
      }
    } else {
      // No previous payments, use previous period
      const periodicity = paymentPeriodicities.find((p) => p.id === project?.payment_periodicity_id)

      if (periodicity?.code === "week") {
        startDate = startOfWeek(subDays(today, 7))
        endDate = endOfWeek(subDays(today, 7))
      } else if (periodicity?.code === "month") {
        startDate = startOfMonth(subDays(today, 30))
        endDate = endOfMonth(subDays(today, 30))
      } else if (periodicity?.code === "custom" && project?.payment_custom_days) {
        startDate = subDays(today, project.payment_custom_days * 2)
        endDate = subDays(today, project.payment_custom_days + 1)
      } else {
        // Default to previous month
        startDate = startOfMonth(subDays(today, 30))
        endDate = endOfMonth(subDays(today, 30))
      }
    }

    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    }
  }

  const addNewPaymentRow = () => {
    const { startDate, endDate } = getDefaultPeriod()

    const newRow: NewPaymentRow = {
      id: `new-${Date.now()}-${newPaymentRows.length}`,
      period_start: startDate,
      period_end: endDate,
      revenue: 0,
      payment_amount: 0,
      payment_percentage: project?.payment_percentage || 1,
      payment_method_id: project?.default_payment_method_id || paymentMethods[0]?.id || 1,
    }

    setNewPaymentRows((prev) => [...prev, newRow])
  }

  const removeNewPaymentRow = (id: string) => {
    setNewPaymentRows((prev) => prev.filter((row) => row.id !== id))
  }

  const updateNewPaymentRow = (id: string, field: keyof NewPaymentRow, value: any) => {
    setNewPaymentRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  const calculatePaymentAmount = (id: string) => {
    const row = newPaymentRows.find((row) => row.id === id)
    if (!row) return

    const percentage = row.payment_percentage || project?.payment_percentage || 1
    const amount = (row.revenue * percentage) / 100

    updateNewPaymentRow(id, "payment_amount", amount)
    updateNewPaymentRow(id, "payment_percentage", percentage)
  }

  const savePayments = async () => {
    // Validate all rows
    const invalidRows = newPaymentRows.filter(
      (row) => !row.period_start || !row.period_end || row.revenue <= 0 || row.payment_amount <= 0,
    )

    if (invalidRows.length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields with valid values",
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    try {
      const result = await createProjectPaymentDrafts({
        projectSlug: slug,
        payments: newPaymentRows.map((row) => ({
          period_start: row.period_start,
          period_end: row.period_end,
          revenue: row.revenue,
          payment_amount: row.payment_amount,
          payment_percentage: row.payment_percentage,
          payment_method_id: row.payment_method_id,
        })),
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      const newPayments: Payment[] = result.data.map((payment) => ({
        id: payment.id,
        period_start: payment.period_start,
        period_end: payment.period_end,
        revenue: payment.revenue,
        payment_amount: payment.payment_amount,
        payment_percentage: payment.payment_percentage,
        payment_method_id: payment.payment_method_id,
        payment_method_name: payment.payment_method_name,
        status_id: payment.status_id,
        status_name: payment.status_name,
        status_code: payment.status_code,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
        paid_at: payment.paid_at,
        confirmed_at: payment.confirmed_at,
        notes: payment.notes,
        latest_onchain_submission: payment.latest_onchain_submission,
      }))

      setPayments((prev) => [...newPayments, ...prev])
      setNewPaymentRows([])

      setTimeout(() => {
        addNewPaymentRow()
      }, 100)

      toast({
        title: "Payments Saved",
        description: `${newPayments.length} payment record(s) have been saved as drafts.`,
      })
    } catch (error) {
      console.error("Error saving payments:", error)
      toast({
        title: "Error",
        description: "Failed to save payment records",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const getStatusBadge = (statusCode: string, statusName: string) => {
    switch (statusCode) {
      case "draft":
        return <Badge variant="outline">{statusName}</Badge>
      case "pending":
        return <Badge variant="secondary">{statusName}</Badge>
      case "awaiting_confirmation":
        return <Badge variant="outline">{statusName}</Badge>
      case "confirmed":
        return <Badge>{statusName}</Badge>
      case "failed":
        return <Badge variant="destructive">{statusName}</Badge>
      default:
        return <Badge>{statusName}</Badge>
    }
  }

  const getOnchainProgressText = (payment: Payment) => {
    const submission = payment.latest_onchain_submission
    if (!submission) {
      return null
    }

    switch (submission.status) {
      case "submitted":
        return "Onchain receipt stored; waiting for the transaction receipt to become fetchable."
      case "confirming":
        return `Onchain deposit verified with ${submission.confirmation_count}/${submission.confirmation_depth} confirmations.`
      case "confirmed":
        return `Onchain deposit finalized with ${submission.confirmation_count} confirmations.`
      case "failed":
        return submission.failure_reason ?? "The latest onchain submission failed reconciliation."
    }
  }

  const openCryptoPaymentDialog = (payment: Payment) => {
    setPaymentToPay(payment)
    setCryptoPaymentDialogOpen(true)
  }

  const getPeriodTagFromDate = (dateString: string | null | undefined) => {
    if (!dateString) {
      return 0
    }

    const monthText = dateString.slice(5, 7)
    const month = Number.parseInt(monthText, 10)
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : 0
  }

  const getPeriodTagLabel = (periodId: number) => periodTagLabels[periodId] ?? `Month ${periodId}`

  const handleCryptoPaymentRecorded = (paymentId: number, submission: OnchainSubmissionSummary) => {
    const awaitingStatus = paymentStatuses.find((status) => status.code === "awaiting_confirmation")
    if (!awaitingStatus) {
      return
    }

    setPayments((prev) =>
      prev.map((payment) =>
        payment.id === paymentId
          ? {
              ...payment,
              status_id: awaitingStatus.id,
              status_name: awaitingStatus.name,
              status_code: awaitingStatus.code,
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              notes: `Onchain payment submitted: ${submission.tx_hash} (period tag: ${submission.period_id === 0 ? "current" : submission.period_id})`,
              latest_onchain_submission: submission,
            }
          : payment,
      ),
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <p>Loading payment data...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12" data-testid="project-payments-page">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href={`/projects/${slug}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Project</span>
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{project?.name} Payments</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">Manage your revenue share payments to FundLoop</p>
        </div>
      </div>

      <div className="space-y-8">
        <ProjectCryptoRouteManager
          projectSlug={slug}
          routes={managedCryptoPaymentMethods}
          onRoutesChange={setManagedCryptoPaymentMethods}
        />

        {/* Add New Payments Section */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Payments</CardTitle>
            <CardDescription>Record your revenue and calculate payments for each period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {newPaymentRows.map((row, index) => (
                <div key={row.id} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Payment Period {index + 1}</h3>
                    {newPaymentRows.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeNewPaymentRow(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`period-start-${row.id}`}>Period Start</Label>
                      <Input
                        id={`period-start-${row.id}`}
                        type="date"
                        value={row.period_start}
                        onChange={(e) => updateNewPaymentRow(row.id, "period_start", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`period-end-${row.id}`}>Period End</Label>
                      <Input
                        id={`period-end-${row.id}`}
                        type="date"
                        value={row.period_end}
                        onChange={(e) => updateNewPaymentRow(row.id, "period_end", e.target.value)}
                      />
                      <p className="text-xs text-slate-500">
                        Onchain period tag preview: {getPeriodTagLabel(getPeriodTagFromDate(row.period_end))}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`revenue-${row.id}`}>Revenue for Period</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <Input
                          id={`revenue-${row.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className="pl-7"
                          value={row.revenue || ""}
                          onChange={(e) =>
                            updateNewPaymentRow(row.id, "revenue", Number.parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => calculatePaymentAmount(row.id)}
                        disabled={!row.revenue}
                        className="mb-0.5"
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        Calculate Payment
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`payment-amount-${row.id}`}>Payment Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <Input
                          id={`payment-amount-${row.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className="pl-7"
                          value={row.payment_amount || ""}
                          onChange={(e) =>
                            updateNewPaymentRow(row.id, "payment_amount", Number.parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      {row.payment_percentage < 1 && row.revenue > 0 && (
                        <p className="text-sm text-red-500 flex items-center mt-1">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Payment is less than the recommended 1% minimum
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`payment-percentage-${row.id}`}>Payment Percentage</Label>
                      <div className="relative">
                        <Input
                          id={`payment-percentage-${row.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className="pr-7"
                          value={row.payment_percentage || ""}
                          onChange={(e) => {
                            const value = Number.parseFloat(e.target.value) || 0
                            updateNewPaymentRow(row.id, "payment_percentage", value)
                            if (row.revenue > 0) {
                              const amount = (row.revenue * value) / 100
                              updateNewPaymentRow(row.id, "payment_amount", amount)
                            }
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Your project's default payment percentage is {project?.payment_percentage}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`payment-method-${row.id}`}>Payment Method</Label>
                    <Select
                      value={row.payment_method_id.toString()}
                      onValueChange={(value) =>
                        updateNewPaymentRow(row.id, "payment_method_id", Number.parseInt(value))
                      }
                    >
                      <SelectTrigger id={`payment-method-${row.id}`}>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id.toString()}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              <div className="flex justify-between">
                <Button variant="outline" onClick={addNewPaymentRow}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Period
                </Button>

                <Button onClick={savePayments} disabled={saving || newPaymentRows.length === 0}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Payments"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manage Payments Section */}
        <Card>
          <CardHeader>
            <CardTitle>Manage Payments</CardTitle>
            <CardDescription>View and manage your payment history</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>A list of your payment records</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Period</TableHead>
                  <TableHead scope="col">Revenue</TableHead>
                  <TableHead scope="col">Payment</TableHead>
                  <TableHead scope="col">Percentage</TableHead>
                  <TableHead scope="col">Method</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      No payment records found
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id} data-testid={`payment-row-${payment.id}`}>
                      <TableCell>
                        <div className="font-medium">
                          {format(new Date(payment.period_start), "MMM d, yyyy")} -{" "}
                          {format(new Date(payment.period_end), "MMM d, yyyy")}
                        </div>
                        <div className="text-xs text-slate-500">
                          Onchain tag: {getPeriodTagLabel(getPeriodTagFromDate(payment.period_end))}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(payment.revenue)}</TableCell>
                      <TableCell>{formatCurrency(payment.payment_amount)}</TableCell>
                      <TableCell>{payment.payment_percentage}%</TableCell>
                      <TableCell className="capitalize">{payment.payment_method_name.replace("_", " ")}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(payment.status_code, payment.status_name)}
                          {payment.latest_onchain_submission ? (
                            <p className="max-w-xs text-xs text-slate-500">{getOnchainProgressText(payment)}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(payment.status_code === "draft" ||
                            payment.status_code === "pending" ||
                            (payment.status_code === "failed" && payment.latest_onchain_submission?.status === "failed")) &&
                          cryptoPaymentMethods.length > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openCryptoPaymentDialog(payment)}
                              data-testid={`pay-with-crypto-${payment.id}`}
                            >
                              {payment.status_code === "failed" ? "Retry crypto payment" : "Pay with crypto"}
                            </Button>
                          ) : null}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              // View payment details
                            }}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                        {payment.status_code === "awaiting_confirmation" ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Awaiting automatic onchain reconciliation to verify the recorded deposit.
                          </p>
                        ) : null}
                        {payment.status_code === "failed" && payment.latest_onchain_submission?.status === "failed" ? (
                          <p className="mt-1 text-xs text-rose-600">
                            The latest onchain submission failed verification. Review the failure above, then retry with
                            a replacement deposit.
                          </p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ProjectCryptoPaymentDialog
        open={cryptoPaymentDialogOpen}
        onOpenChange={setCryptoPaymentDialogOpen}
        payment={paymentToPay}
        paymentMethods={cryptoPaymentMethods}
        projectId={projectId}
        projectSlug={slug}
        onPaymentRecorded={handleCryptoPaymentRecorded}
      />
    </div>
  )
}
