"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { Search, CheckCircle, Info } from "lucide-react"

interface Project {
  id: number
  name: string
}

interface Payment {
  id: number
  project_id: number
  project_name: string
  period_start: string
  period_end: string
  revenue: number
  payment_amount: number
  payment_percentage: number
  payment_method: string
  status: string
  created_at: string
  updated_at: string
  paid_at: string | null
  confirmed_at: string | null
  notes: string | null
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [paymentToConfirm, setPaymentToConfirm] = useState<Payment | null>(null)

  useEffect(() => {
    fetchPayments()
  }, [])

  useEffect(() => {
    filterPayments()
  }, [payments, searchTerm, statusFilter])

  const fetchPayments = async () => {
    try {
      setLoading(true)

      // In a real app, you would fetch from Supabase
      // For demo purposes, we'll use mock data
      const mockPayments: Payment[] = [
        {
          id: 1,
          project_id: 1,
          project_name: "EcoStream",
          period_start: "2023-03-01",
          period_end: "2023-03-31",
          revenue: 25000.0,
          payment_amount: 375.0,
          payment_percentage: 1.5,
          payment_method: "bank_transfer",
          status: "confirmed",
          created_at: "2023-04-02T10:30:00Z",
          updated_at: "2023-04-05T14:20:00Z",
          paid_at: "2023-04-03T09:15:00Z",
          confirmed_at: "2023-04-05T14:20:00Z",
          notes: null,
        },
        {
          id: 2,
          project_id: 1,
          project_name: "EcoStream",
          period_start: "2023-04-01",
          period_end: "2023-04-30",
          revenue: 28500.0,
          payment_amount: 427.5,
          payment_percentage: 1.5,
          payment_method: "bank_transfer",
          status: "awaiting_confirmation",
          created_at: "2023-05-02T11:45:00Z",
          updated_at: "2023-05-03T16:30:00Z",
          paid_at: "2023-05-03T16:30:00Z",
          confirmed_at: null,
          notes: null,
        },
        {
          id: 3,
          project_id: 1,
          project_name: "EcoStream",
          period_start: "2023-05-01",
          period_end: "2023-05-31",
          revenue: 32000.0,
          payment_amount: 480.0,
          payment_percentage: 1.5,
          payment_method: "credit_card",
          status: "draft",
          created_at: "2023-06-01T09:00:00Z",
          updated_at: "2023-06-01T09:00:00Z",
          paid_at: null,
          confirmed_at: null,
          notes: "Pending final revenue numbers",
        },
        {
          id: 4,
          project_id: 2,
          project_name: "Harvest",
          period_start: "2023-03-01",
          period_end: "2023-03-31",
          revenue: 18000.0,
          payment_amount: 180.0,
          payment_percentage: 1.0,
          payment_method: "bank_transfer",
          status: "confirmed",
          created_at: "2023-04-01T08:20:00Z",
          updated_at: "2023-04-03T10:15:00Z",
          paid_at: "2023-04-02T14:30:00Z",
          confirmed_at: "2023-04-03T10:15:00Z",
          notes: null,
        },
        {
          id: 5,
          project_id: 2,
          project_name: "Harvest",
          period_start: "2023-04-01",
          period_end: "2023-04-30",
          revenue: 20500.0,
          payment_amount: 205.0,
          payment_percentage: 1.0,
          payment_method: "bank_transfer",
          status: "awaiting_confirmation",
          created_at: "2023-05-01T09:45:00Z",
          updated_at: "2023-05-02T11:20:00Z",
          paid_at: "2023-05-02T11:20:00Z",
          confirmed_at: null,
          notes: null,
        },
        {
          id: 6,
          project_id: 3,
          project_name: "Nomad Workspace",
          period_start: "2023-03-01",
          period_end: "2023-03-31",
          revenue: 42000.0,
          payment_amount: 840.0,
          payment_percentage: 2.0,
          payment_method: "crypto",
          status: "confirmed",
          created_at: "2023-04-02T15:10:00Z",
          updated_at: "2023-04-04T09:30:00Z",
          paid_at: "2023-04-03T16:45:00Z",
          confirmed_at: "2023-04-04T09:30:00Z",
          notes: null,
        },
      ]

      setPayments(mockPayments)
      setFilteredPayments(mockPayments)
    } catch (error) {
      console.error("Error fetching payments:", error)
      toast({
        title: "Error",
        description: "Failed to load payment data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterPayments = () => {
    let filtered = [...payments]

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (payment) =>
          payment.project_name.toLowerCase().includes(term) ||
          payment.payment_method.toLowerCase().includes(term) ||
          payment.notes?.toLowerCase().includes(term),
      )
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((payment) => payment.status === statusFilter)
    }

    setFilteredPayments(filtered)
  }

  const confirmPayment = async (payment: Payment) => {
    try {
      // In a real app, you would update in Supabase
      // const { error } = await supabase
      //   .from('payments')
      //   .update({
      //     status: 'confirmed',
      //     confirmed_at: new Date().toISOString(),
      //     updated_at: new Date().toISOString()
      //   })
      //   .eq('id', payment.id)

      // For demo purposes, we'll just update the local state
      setPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id
            ? {
                ...p,
                status: "confirmed",
                confirmed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : p,
        ),
      )

      toast({
        title: "Payment Confirmed",
        description: `Payment from ${payment.project_name} has been confirmed.`,
      })
    } catch (error) {
      console.error("Error confirming payment:", error)
      toast({
        title: "Error",
        description: "Failed to confirm payment",
        variant: "destructive",
      })
    }
  }

  const openConfirmDialog = (payment: Payment) => {
    setPaymentToConfirm(payment)
    setConfirmDialogOpen(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "awaiting_confirmation":
        return <Badge variant="warning">Awaiting Confirmation</Badge>
      case "confirmed":
        return <Badge variant="success">Confirmed</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <p>Loading payment data...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Payment Management</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">Manage and confirm payments from projects</p>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Filter Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by project name..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="w-full md:w-[200px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="awaiting_confirmation">Awaiting Confirmation</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Payments</CardTitle>
          <CardDescription>View and manage payments from all projects</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>A list of all project payments</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No payment records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.project_name}</TableCell>
                    <TableCell>
                      {format(new Date(payment.period_start), "MMM d, yyyy")} -{" "}
                      {format(new Date(payment.period_end), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{formatCurrency(payment.revenue)}</TableCell>
                    <TableCell>{formatCurrency(payment.payment_amount)}</TableCell>
                    <TableCell>{payment.payment_percentage}%</TableCell>
                    <TableCell className="capitalize">{payment.payment_method.replace("_", " ")}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {payment.status === "awaiting_confirmation" && (
                          <Button size="sm" onClick={() => openConfirmDialog(payment)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Confirm Receipt
                          </Button>
                        )}

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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm Payment Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Receipt</DialogTitle>
            <DialogDescription>
              {paymentToConfirm && (
                <>
                  Are you sure you want to confirm receipt of {formatCurrency(paymentToConfirm.payment_amount)} from{" "}
                  {paymentToConfirm.project_name}?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (paymentToConfirm) {
                  confirmPayment(paymentToConfirm)
                  setConfirmDialogOpen(false)
                }
              }}
            >
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
