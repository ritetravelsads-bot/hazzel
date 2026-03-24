"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { TeamNav } from "@/components/team/team-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { FileText, Upload, Calendar, Building2, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"

interface InvoiceRequest {
  id: string
  request_number: string
  customer_id: string
  customer_name: string
  customer_phone?: string
  requested_by_name: string
  date_range_start: string
  date_range_end: string
  description?: string
  status: string
  approved_at?: string
  invoice?: {
    id: string
    file_url: string
    file_name: string
    visibility_start: string
    visibility_end: string
  }
  created_at: string
}

export default function InvoiceRequestsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<InvoiceRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<InvoiceRequest | null>(null)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [visibilityStart, setVisibilityStart] = useState("")
  const [visibilityEnd, setVisibilityEnd] = useState("")

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/auth/session", { credentials: "include" })
        if (!response.ok) {
          router.push("/team/login")
          return
        }

        const data = await response.json()
        if (data.type !== "team") {
          router.push("/team/login")
          return
        }

        setUser(data.session)
        fetchRequests()
      } catch (error) {
        router.push("/team/login")
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [router])

  const fetchRequests = async () => {
    try {
      const response = await fetch("/api/invoice-requests", { credentials: "include" })
      if (response.ok) {
        const data = await response.json()
        setRequests(data)
      }
    } catch (error) {
      console.error("Failed to fetch invoice requests:", error)
    }
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    router.push("/team/login")
  }

  const handleOpenUpload = (request: InvoiceRequest) => {
    setSelectedRequest(request)
    // Set default visibility dates
    const today = new Date()
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    setVisibilityStart(today.toISOString().split("T")[0])
    setVisibilityEnd(thirtyDaysLater.toISOString().split("T")[0])
    setIsUploadDialogOpen(true)
  }

  const handleUploadInvoice = async () => {
    if (!uploadFile || !selectedRequest || !visibilityStart || !visibilityEnd) {
      toast.error("Please fill all required fields")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("invoice_request_id", selectedRequest.id)
      formData.append("visibility_start", visibilityStart)
      formData.append("visibility_end", visibilityEnd)

      const response = await fetch("/api/invoices", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      if (response.ok) {
        toast.success("Invoice uploaded successfully")
        setIsUploadDialogOpen(false)
        setUploadFile(null)
        setSelectedRequest(null)
        fetchRequests()
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to upload invoice")
      }
    } catch (error) {
      toast.error("Failed to upload invoice")
    } finally {
      setUploading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending_approval: { variant: "secondary", label: "Pending Approval" },
      approved: { variant: "default", label: "Ready for Upload" },
      rejected: { variant: "destructive", label: "Rejected" },
      uploaded: { variant: "outline", label: "Uploaded" },
      expired: { variant: "destructive", label: "Expired" },
    }
    const { variant, label } = config[status] || { variant: "secondary", label: status }
    return <Badge variant={variant}>{label}</Badge>
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <SidebarProvider>
      <TeamNav user={user} onLogout={handleLogout} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
          <SidebarTrigger />
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Invoice Requests</h1>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Upload</p>
                    <p className="text-2xl font-bold">
                      {requests.filter((r) => r.status === "approved").length}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Uploaded</p>
                    <p className="text-2xl font-bold">
                      {requests.filter((r) => r.status === "uploaded").length}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                    <p className="text-2xl font-bold">{requests.length}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Requests</CardTitle>
              <CardDescription>Manage and upload invoices for approved requests</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No invoice requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.request_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{request.customer_name}</p>
                              {request.customer_phone && (
                                <p className="text-xs text-muted-foreground">{request.customer_phone}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDate(request.date_range_start)} - {formatDate(request.date_range_end)}
                          </div>
                        </TableCell>
                        <TableCell>{request.requested_by_name}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>{formatDate(request.created_at)}</TableCell>
                        <TableCell>
                          {request.status === "approved" && (
                            <Button size="sm" onClick={() => handleOpenUpload(request)} className="gap-1.5">
                              <Upload className="h-3.5 w-3.5" />
                              Upload Invoice
                            </Button>
                          )}
                          {request.status === "uploaded" && request.invoice && (
                            <div className="text-sm text-muted-foreground">
                              <p>Visible until:</p>
                              <p className="font-medium">{formatDate(request.invoice.visibility_end)}</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Invoice</DialogTitle>
            <DialogDescription>
              Upload invoice for {selectedRequest?.customer_name} ({selectedRequest?.request_number})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium">Requested Period</p>
              <p className="text-sm text-muted-foreground">
                {selectedRequest && formatDate(selectedRequest.date_range_start)} -{" "}
                {selectedRequest && formatDate(selectedRequest.date_range_end)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-file">Invoice File (PDF)</Label>
              <Input
                id="invoice-file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="visibility-start">Download Available From</Label>
                <Input
                  id="visibility-start"
                  type="date"
                  value={visibilityStart}
                  onChange={(e) => setVisibilityStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility-end">Download Available Until</Label>
                <Input
                  id="visibility-end"
                  type="date"
                  value={visibilityEnd}
                  onChange={(e) => setVisibilityEnd(e.target.value)}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              The invoice will be automatically deleted and unavailable for download after the visibility end date.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadInvoice} disabled={uploading || !uploadFile}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
