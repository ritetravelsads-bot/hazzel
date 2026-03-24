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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { 
  FileText, 
  Calendar, 
  Building2, 
  Download, 
  Loader2, 
  Search,
  Filter,
  X,
  Eye,
  EyeOff,
  RefreshCw
} from "lucide-react"
import { format, isWithinInterval, parseISO } from "date-fns"

interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  customer_name: string
  request_number: string
  file_url: string
  file_name: string
  file_size: number
  date_range_start: string
  date_range_end: string
  visibility_start: string
  visibility_end: string
  is_active: boolean
  download_count: number
  uploaded_by_name: string
  created_at: string
}

interface Customer {
  id: string
  company_name: string
}

export default function InvoiceHistoryPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [uploadedDateFrom, setUploadedDateFrom] = useState("")
  const [uploadedDateTo, setUploadedDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)

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
        fetchData()
      } catch (error) {
        router.push("/team/login")
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [router])

  const fetchData = async () => {
    try {
      const [invoicesRes, customersRes] = await Promise.all([
        fetch("/api/invoices", { credentials: "include" }),
        fetch("/api/customers", { credentials: "include" }),
      ])

      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        setInvoices(data)
        setFilteredInvoices(data)
      }

      if (customersRes.ok) {
        const data = await customersRes.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    }
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    router.push("/team/login")
  }

  // Apply filters
  useEffect(() => {
    let result = [...invoices]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(query) ||
          inv.customer_name?.toLowerCase().includes(query) ||
          inv.request_number?.toLowerCase().includes(query) ||
          inv.file_name.toLowerCase().includes(query)
      )
    }

    // Customer filter
    if (selectedCustomer && selectedCustomer !== "all") {
      result = result.filter((inv) => inv.customer_id === selectedCustomer)
    }

    // Status filter
    if (selectedStatus && selectedStatus !== "all") {
      const now = new Date()
      if (selectedStatus === "active") {
        result = result.filter((inv) => {
          const visEnd = new Date(inv.visibility_end)
          return inv.is_active && visEnd >= now
        })
      } else if (selectedStatus === "expired") {
        result = result.filter((inv) => {
          const visEnd = new Date(inv.visibility_end)
          return visEnd < now
        })
      } else if (selectedStatus === "inactive") {
        result = result.filter((inv) => !inv.is_active)
      }
    }

    // Invoice date range filter (date_range_start/end)
    if (dateFrom) {
      const fromDate = parseISO(dateFrom)
      result = result.filter((inv) => new Date(inv.date_range_start) >= fromDate)
    }
    if (dateTo) {
      const toDate = parseISO(dateTo)
      result = result.filter((inv) => new Date(inv.date_range_end) <= toDate)
    }

    // Upload date filter
    if (uploadedDateFrom) {
      const fromDate = parseISO(uploadedDateFrom)
      result = result.filter((inv) => new Date(inv.created_at) >= fromDate)
    }
    if (uploadedDateTo) {
      const toDate = parseISO(uploadedDateTo)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter((inv) => new Date(inv.created_at) <= toDate)
    }

    setFilteredInvoices(result)
  }, [invoices, searchQuery, selectedCustomer, selectedStatus, dateFrom, dateTo, uploadedDateFrom, uploadedDateTo])

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedCustomer("all")
    setSelectedStatus("all")
    setDateFrom("")
    setDateTo("")
    setUploadedDateFrom("")
    setUploadedDateTo("")
  }

  const hasActiveFilters = searchQuery || selectedCustomer !== "all" || selectedStatus !== "all" || dateFrom || dateTo || uploadedDateFrom || uploadedDateTo

  const getStatusBadge = (invoice: Invoice) => {
    const now = new Date()
    const visEnd = new Date(invoice.visibility_end)
    const visStart = new Date(invoice.visibility_start)

    if (!invoice.is_active) {
      return <Badge variant="secondary">Inactive</Badge>
    }
    if (visEnd < now) {
      return <Badge variant="destructive">Expired</Badge>
    }
    if (visStart > now) {
      return <Badge variant="outline">Scheduled</Badge>
    }
    return <Badge variant="default">Active</Badge>
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "-"
    return format(new Date(dateString), "MMM d, yyyy")
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "-"
    return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a")
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Stats
  const activeCount = invoices.filter((inv) => {
    const now = new Date()
    const visEnd = new Date(inv.visibility_end)
    return inv.is_active && visEnd >= now
  }).length

  const expiredCount = invoices.filter((inv) => {
    const now = new Date()
    const visEnd = new Date(inv.visibility_end)
    return visEnd < now
  }).length

  const totalDownloads = invoices.reduce((sum, inv) => sum + (inv.download_count || 0), 0)

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
            <h1 className="text-lg font-semibold">Invoice History</h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                    <p className="text-2xl font-bold">{invoices.length}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{activeCount}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <Eye className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Expired</p>
                    <p className="text-2xl font-bold">{expiredCount}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                    <EyeOff className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Downloads</p>
                    <p className="text-2xl font-bold">{totalDownloads}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Download className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Card */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Filters</CardTitle>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2">
                      {filteredInvoices.length} results
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                      <X className="h-3 w-3" />
                      Clear all
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    {showFilters ? "Hide Filters" : "Show Filters"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search - Always visible */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number, customer, request number, or file name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-2">
                  {/* Customer Filter */}
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Customers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Invoice Period From */}
                  <div className="space-y-2">
                    <Label>Invoice Period From</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>

                  {/* Invoice Period To */}
                  <div className="space-y-2">
                    <Label>Invoice Period To</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>

                  {/* Uploaded From */}
                  <div className="space-y-2">
                    <Label>Uploaded From</Label>
                    <Input
                      type="date"
                      value={uploadedDateFrom}
                      onChange={(e) => setUploadedDateFrom(e.target.value)}
                    />
                  </div>

                  {/* Uploaded To */}
                  <div className="space-y-2">
                    <Label>Uploaded To</Label>
                    <Input
                      type="date"
                      value={uploadedDateTo}
                      onChange={(e) => setUploadedDateTo(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Invoices</CardTitle>
              <CardDescription>
                Complete history of all uploaded invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Request #</TableHead>
                      <TableHead>Invoice Period</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Uploaded At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          {hasActiveFilters ? "No invoices match your filters" : "No invoices found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{invoice.customer_name || "-"}</span>
                            </div>
                          </TableCell>
                          <TableCell>{invoice.request_number || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>
                                {formatDate(invoice.date_range_start)} - {formatDate(invoice.date_range_end)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{formatDate(invoice.visibility_start)}</p>
                              <p className="text-muted-foreground">to {formatDate(invoice.visibility_end)}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Download className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{invoice.download_count || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>{invoice.uploaded_by_name || "-"}</TableCell>
                          <TableCell className="text-sm">{formatDateTime(invoice.created_at)}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="gap-1.5"
                            >
                              <a href={invoice.file_url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
