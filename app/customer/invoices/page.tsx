"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CustomerNav } from "@/components/customer/customer-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { FileText, Plus, Calendar, Download, Clock, CheckCircle2, XCircle, AlertCircle, HourglassIcon } from "lucide-react"
import { format, differenceInDays, differenceInHours } from "date-fns"

interface InvoiceRequest {
  id: string
  request_number: string
  date_range_start: string
  date_range_end: string
  status: string
  description?: string
  created_at: string
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
}

interface Invoice {
  id: string
  request_id: string
  file_url: string
  file_name: string
  available_until: string
  notes?: string
  uploaded_at: string
}

export default function CustomerInvoicesPage() {
  const router = useRouter()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<InvoiceRequest[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    date_range_start: "",
    date_range_end: "",
    description: "",
  })

  const isAdmin = customer?.role === "customer_admin"

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session", { credentials: "include" })
        if (!sessionResponse.ok) {
          router.push("/customer/login")
          return
        }

        const sessionData = await sessionResponse.json()
        if (sessionData.type !== "customer") {
          router.push("/customer/login")
          return
        }

        setCustomer(sessionData.session)

        // Fetch invoice requests
        const requestsResponse = await fetch("/api/invoice-requests")
        if (requestsResponse.ok) {
          const data = await requestsResponse.json()
          setRequests(data)
        }

        // Fetch invoices
        const invoicesResponse = await fetch("/api/invoices")
        if (invoicesResponse.ok) {
          const data = await invoicesResponse.json()
          setInvoices(data)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast.error("Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleLogout = async () => {
    await fetch("/api/auth/customer/logout", { method: "POST", credentials: "include" })
    router.push("/customer/login")
  }

  const handleSubmitRequest = async () => {
    if (!formData.date_range_start || !formData.date_range_end) {
      toast.error("Please select date range")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/invoice-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const newRequest = await response.json()
        setRequests((prev) => [newRequest, ...prev])
        setIsDialogOpen(false)
        setFormData({ date_range_start: "", date_range_end: "", description: "" })
        toast.success("Invoice request submitted successfully")
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to submit request")
      }
    } catch (error) {
      console.error("Submit error:", error)
      toast.error("Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    try {
      const response = await fetch(`/api/invoice-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })

      if (response.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: "approved" } : r))
        )
        toast.success("Request approved")
      } else {
        toast.error("Failed to approve request")
      }
    } catch (error) {
      console.error("Approve error:", error)
      toast.error("Failed to approve request")
    }
  }

  const handleReject = async (requestId: string, reason: string) => {
    try {
      const response = await fetch(`/api/invoice-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejected_reason: reason }),
      })

      if (response.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: "rejected", rejection_reason: reason } : r))
        )
        toast.success("Request rejected")
      } else {
        toast.error("Failed to reject request")
      }
    } catch (error) {
      console.error("Reject error:", error)
      toast.error("Failed to reject request")
    }
  }

  const getInvoiceForRequest = (requestId: string) => {
    return invoices.find((inv) => inv.request_id === requestId)
  }

  const isInvoiceAvailable = (invoice: Invoice) => {
    return new Date(invoice.available_until) > new Date()
  }

  const getTimeRemaining = (availableUntil: string) => {
    const now = new Date()
    const until = new Date(availableUntil)
    const days = differenceInDays(until, now)
    const hours = differenceInHours(until, now) % 24

    if (days > 0) {
      return `${days}d ${hours}h remaining`
    } else if (hours > 0) {
      return `${hours}h remaining`
    }
    return "Expired"
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
      pending_approval: { variant: "secondary", label: "Pending Approval", icon: <Clock className="h-3 w-3" /> },
      approved: { variant: "default", label: "Approved", icon: <CheckCircle2 className="h-3 w-3" /> },
      rejected: { variant: "destructive", label: "Rejected", icon: <XCircle className="h-3 w-3" /> },
      uploaded: { variant: "outline", label: "Invoice Ready", icon: <FileText className="h-3 w-3" /> },
      expired: { variant: "destructive", label: "Expired", icon: <AlertCircle className="h-3 w-3" /> },
    }
    const { variant, label, icon } = config[status] || { variant: "secondary", label: status, icon: null }
    return (
      <Badge variant={variant} className="gap-1">
        {icon}
        {label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <SidebarProvider>
        <CustomerNav customer={customer} onLogout={handleLogout} />
        <SidebarInset>
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <CustomerNav customer={customer} onLogout={handleLogout} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Invoices</h1>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Invoice Requests</h2>
                <p className="text-muted-foreground">Request and download invoices for your account</p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Request Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Invoice</DialogTitle>
                    <DialogDescription>
                      Select the date range for the invoice you need
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date_range_start">From Date</Label>
                        <Input
                          id="date_range_start"
                          type="date"
                          value={formData.date_range_start}
                          onChange={(e) => setFormData({ ...formData, date_range_start: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date_range_end">To Date</Label>
                        <Input
                          id="date_range_end"
                          type="date"
                          value={formData.date_range_end}
                          onChange={(e) => setFormData({ ...formData, date_range_end: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Notes (optional)</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Any specific details or requirements..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSubmitRequest} disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit Request"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Pending Approval - Admin Only */}
            {isAdmin && requests.filter((r) => r.status === "pending_approval").length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-700">
                    <HourglassIcon className="h-5 w-5" />
                    Pending Your Approval
                  </CardTitle>
                  <CardDescription>
                    Review and approve invoice requests from your team members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {requests
                      .filter((r) => r.status === "pending_approval")
                      .map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-white"
                        >
                          <div>
                            <p className="font-medium">{request.request_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(request.date_range_start), "MMM d, yyyy")} -{" "}
                              {format(new Date(request.date_range_end), "MMM d, yyyy")}
                            </p>
                            {request.description && (
                              <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = prompt("Enter rejection reason (optional):")
                                handleReject(request.id, reason || "")
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button size="sm" onClick={() => handleApprove(request.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Requests */}
            <Card>
              <CardHeader>
                <CardTitle>All Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No invoice requests yet</h3>
                    <p className="text-muted-foreground">
                      Click "Request Invoice" to submit your first request
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request #</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested On</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => {
                        const invoice = getInvoiceForRequest(request.id)
                        const available = invoice && isInvoiceAvailable(invoice)

                        return (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">{request.request_number}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(request.date_range_start), "MMM d")} -{" "}
                                {format(new Date(request.date_range_end), "MMM d, yyyy")}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                            <TableCell>
                              {format(new Date(request.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              {invoice && available ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {getTimeRemaining(invoice.available_until)}
                                  </span>
                                  <Button size="sm" asChild>
                                    <a
                                      href={invoice.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Download className="h-4 w-4 mr-1" />
                                      Download
                                    </a>
                                  </Button>
                                </div>
                              ) : invoice && !available ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setIsDialogOpen(true)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Request Again
                                </Button>
                              ) : request.status === "rejected" ? (
                                <span className="text-sm text-destructive">
                                  {request.rejection_reason || "Rejected"}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
