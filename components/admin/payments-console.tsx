"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { CheckCircle, Info, Search } from "lucide-react"
import { confirmInternalPaymentReceipt, type PaymentRecordSummary } from "@/app/actions/project-payment-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"

type PaymentsConsoleProps = {
  initialPayments: PaymentRecordSummary[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function getStatusBadge(statusCode: string, statusName: string) {
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
      return <Badge variant="secondary">{statusName}</Badge>
  }
}

export function PaymentsConsole({ initialPayments }: PaymentsConsoleProps) {
  const [payments, setPayments] = useState(initialPayments)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [paymentToConfirm, setPaymentToConfirm] = useState<PaymentRecordSummary | null>(null)
  const [confirming, startConfirming] = useTransition()

  useEffect(() => {
    setPayments(initialPayments)
  }, [initialPayments])

  const filteredPayments = useMemo(() => {
    let next = [...payments]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      next = next.filter(
        (payment) =>
          payment.project_name.toLowerCase().includes(term) ||
          payment.payment_method_name.toLowerCase().includes(term) ||
          payment.notes?.toLowerCase().includes(term),
      )
    }

    if (statusFilter !== "all") {
      next = next.filter((payment) => payment.status_code === statusFilter)
    }

    return next
  }, [payments, searchTerm, statusFilter])

  const openConfirmDialog = (payment: PaymentRecordSummary) => {
    setPaymentToConfirm(payment)
    setConfirmDialogOpen(true)
  }

  const confirmPayment = () => {
    if (!paymentToConfirm) {
      return
    }

    startConfirming(async () => {
      const result = await confirmInternalPaymentReceipt(paymentToConfirm.id)
      if (!result.ok) {
        toast({
          title: "Confirmation failed",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      setPayments((current) =>
        current.map((payment) =>
          payment.id === paymentToConfirm.id
            ? {
                ...payment,
                status_code: "confirmed",
                status_name: "Confirmed",
                confirmed_at: result.data.confirmedAt,
                updated_at: result.data.confirmedAt,
              }
            : payment,
        ),
      )

      toast({
        title: "Payment confirmed",
        description: `Marked ${formatCurrency(paymentToConfirm.payment_amount)} from ${paymentToConfirm.project_name} as confirmed.`,
      })

      setConfirmDialogOpen(false)
      setPaymentToConfirm(null)
    })
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Internal Payment Operations</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Review project payment obligations and confirm receipts once FundLoop has actually reconciled them.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Obligations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Confirmation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payments.filter((payment) => payment.status_code === "awaiting_confirmation").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                payments
                  .filter((payment) => payment.status_code === "confirmed")
                  .reduce((total, payment) => total + payment.payment_amount, 0),
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Queue</CardTitle>
          <CardDescription>Filter by project, method, notes, or status to review the current intake pipeline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search projects, methods, or notes"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="awaiting_confirmation">Awaiting Confirmation</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableCaption>Production-backed payment records from Supabase.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Project</TableHead>
                <TableHead scope="col">Period</TableHead>
                <TableHead scope="col">Revenue</TableHead>
                <TableHead scope="col">Payment</TableHead>
                <TableHead scope="col">Method</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    No payment records match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="font-medium">{payment.project_name}</div>
                      <div className="text-xs text-slate-500">{payment.project_slug ?? "No slug"}</div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.period_start), "MMM d, yyyy")} -{" "}
                      {format(new Date(payment.period_end), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{formatCurrency(payment.revenue)}</TableCell>
                    <TableCell>{formatCurrency(payment.payment_amount)}</TableCell>
                    <TableCell className="capitalize">{payment.payment_method_name}</TableCell>
                    <TableCell>{getStatusBadge(payment.status_code, payment.status_name)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {payment.status_code === "awaiting_confirmation" ? (
                          <Button size="sm" onClick={() => openConfirmDialog(payment)}>
                            <CheckCircle className="mr-1 h-4 w-4" />
                            Confirm Receipt
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon" title={payment.notes ?? "No notes"}>
                          <Info className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Receipt</DialogTitle>
            <DialogDescription>
              {paymentToConfirm ? (
                <>
                  Confirm that FundLoop has actually received and reconciled {formatCurrency(paymentToConfirm.payment_amount)} from{" "}
                  {paymentToConfirm.project_name}. This should happen only after the payment is verified operationally.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={confirming}>
              Cancel
            </Button>
            <Button onClick={confirmPayment} disabled={confirming || !paymentToConfirm}>
              {confirming ? "Confirming..." : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
