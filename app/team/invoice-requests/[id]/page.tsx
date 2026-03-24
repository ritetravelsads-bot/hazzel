"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { TeamNav } from "@/components/team/team-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { ArrowLeft, Upload, Calendar, Building2, User, FileText, Clock, Download } from "lucide-react"
import { format } from "date-fns"

interface InvoiceRequest {
  id: string
  request_number: string
  customer_id: string
  customer_name: string
  requested_by: string
  requested_by_name: string
  date_from: string
  date_to: string
  status: string
  notes?: string
  created_at: string
}

interface Invoice {
  id: string
  file_url: string
  file_name: string
  available_until: string
  notes?: string
  uploaded_at: string
}

export default function InvoiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [request, setRequest] = useState<InvoiceRequest | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [availableDays, setAvailableDays] = useState("7")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session", { credentials: "include" })
        if (!sessionResponse.ok) {
          router.push("/team/login")
          return
        }

        const sessionData = await sessionResponse.json()
        if (sessionData.type !== "team") {
          router.push("/team/login")
          return
        }

        setUser(sessionData.session)

        // Fetch request details
        const requestResponse = await fetch(`/api/invoice-requests?id=${id}`)
        if (requestResponse.ok) {
          const data = await requestResponse.json()
          if (data.length > 0) {
            setRequest(data[0])
          }
        }

        // Fetch invoice if exists
        const invoiceResponse = await fetch(`/api/invoices?request_id=${id}`)
        if (invoiceResponse.ok) {
          const invoices = await invoiceResponse.json()
          if (invoices.length > 0) {
            setInvoice(invoices[0])
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast.error("Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, router])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file")
      return
    }

    setUploading(true)
    try {
      // Calculate visibility dates
      const visibilityStart = new Date()
      const visibilityEnd = new Date()
      visibilityEnd.setDate(visibilityEnd.getDate() + parseInt(availableDays))

      // Upload directly to invoices API with FormData
      const formData = new FormData()
      formData.append("file", file)
      formData.append("invoice_request_id", id)
      formData.append("visibility_start", visibilityStart.toISOString())
      formData.append("visibility_end", visibilityEnd.toISOString())
      if (notes) {
        formData.append("notes", notes)
      }

      const invoiceResponse = await fetch("/api/invoices", {
        method: "POST",
        body: formData,
      })

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json()
        throw new Error(errorData.error || "Failed to upload invoice")
      }

      const newInvoice = await invoiceResponse.json()
      setInvoice({
        id: newInvoice.id,
        file_url: newInvoice.file_url,
        file_name: file.name,
        available_until: visibilityEnd.toISOString(),
        notes: notes || undefined,
        uploaded_at: new Date().toISOString(),
      })
      setRequest((prev) => prev ? { ...prev, status: "uploaded" } : null)
      toast.success("Invoice uploaded successfully")
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to upload invoice")
    } finally {
      setUploading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending_approval: { variant: "secondary", label: "Pending Approval" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
      uploaded: { variant: "outline", label: "Invoice Sent" },
      expired: { variant: "destructive", label: "Expired" },
    }
    const { variant, label } = config[status] || { variant: "secondary", label: status }
    return <Badge variant={variant}>{label}</Badge>
  }

  if (loading) {
    return (
      <SidebarProvider>
        <TeamNav user={user} onLogout={() => {
              fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => router.push("/team/login"))
            }} />
        <SidebarInset>
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (!request) {
    return (
      <SidebarProvider>
        <TeamNav user={user} onLogout={() => {
              fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => router.push("/team/login"))
            }} />
        <SidebarInset>
          <div className="flex items-center justify-center h-screen">
            <p>Request not found</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <TeamNav user={user} onLogout={() => {
              fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => router.push("/team/login"))
            }} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{request.request_number}</h1>
                <p className="text-muted-foreground">Invoice Request Details</p>
              </div>
              {getStatusBadge(request.status)}
            </div>

            {/* Request Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Request Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Customer</Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{request.customer_name}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Requested By</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{request.requested_by_name}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Date Range</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {format(new Date(request.date_from), "MMM d, yyyy")} - {format(new Date(request.date_to), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Requested On</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                  </div>
                </div>
                {request.notes && (
                  <div className="col-span-2 space-y-1">
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="text-sm">{request.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload Section - Only show for approved requests without invoice */}
            {request.status === "approved" && !invoice && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Invoice
                  </CardTitle>
                  <CardDescription>
                    Upload the invoice document for the customer to download
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">Invoice File (PDF, Word, Excel)</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleFileSelect}
                    />
                    <p className="text-xs text-muted-foreground">
                      Supported formats: PDF, DOC, DOCX, XLS, XLSX (max 10MB)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="days">Available for (days)</Label>
                    <Input
                      id="days"
                      type="number"
                      min="1"
                      max="90"
                      value={availableDays}
                      onChange={(e) => setAvailableDays(e.target.value)}
                      placeholder="Number of days"
                    />
                    <p className="text-xs text-muted-foreground">
                      The invoice will be available for download until this period expires
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes for Customer (optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes for the customer..."
                    />
                  </div>
                  <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Invoice
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Invoice Details - Show if invoice exists */}
            {invoice && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Invoice Uploaded
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">File Name</Label>
                      <p className="font-medium">{invoice.file_name}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Uploaded On</Label>
                      <p className="font-medium">{format(new Date(invoice.uploaded_at), "MMM d, yyyy 'at' h:mm a")}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Available Until</Label>
                      <p className="font-medium text-amber-600">
                        {format(new Date(invoice.available_until), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    {invoice.notes && (
                      <div className="col-span-2 space-y-1">
                        <Label className="text-muted-foreground">Notes</Label>
                        <p className="text-sm">{invoice.notes}</p>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" asChild className="w-full">
                    <a href={invoice.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download Invoice
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
