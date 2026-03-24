"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Trash2, Eye, ArrowUpRight, Search, X, Filter, Calendar } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ROLES } from "@/lib/constants"

export function TicketsView({ userRole, userId }: { userRole: string; userId: string }) {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPriority, setFilterPriority] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchTickets()
    const interval = setInterval(fetchTickets, 5000)
    return () => clearInterval(interval)
  }, [filterStatus])

  const fetchTickets = async () => {
    try {
      const query = filterStatus !== "all" ? `?status=${filterStatus}` : ""
      const response = await fetch(`/api/tickets${query}`)
      if (response.ok) {
        const data = await response.json()
        setTickets(data)
      } else {
        toast.error("Failed to fetch tickets")
      }
    } catch (error) {
      console.error("[v0] Failed to fetch tickets:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewTicket = (ticketId: string) => {
    router.push(`/team/tickets/${ticketId}`)
  }

  const clearFilters = () => {
    setFilterStatus("all")
    setFilterPriority("all")
    setSearchQuery("")
    setDateFrom("")
    setDateTo("")
  }

  const hasActiveFilters = filterStatus !== "all" || filterPriority !== "all" || searchQuery || dateFrom || dateTo

  // Client-side filtering for search, priority, and date range
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          ticket.title?.toLowerCase().includes(query) ||
          ticket.ticket_number?.toLowerCase().includes(query) ||
          ticket.customer_name?.toLowerCase().includes(query) ||
          (typeof ticket.customer_id === 'object' && ticket.customer_id?.company_name?.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }

      // Priority filter
      if (filterPriority !== "all" && ticket.priority !== filterPriority) {
        return false
      }

      // Date range filter
      if (dateFrom) {
        const ticketDate = new Date(ticket.created_at)
        const fromDate = new Date(dateFrom)
        if (ticketDate < fromDate) return false
      }
      if (dateTo) {
        const ticketDate = new Date(ticket.created_at)
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (ticketDate > toDate) return false
      }

      return true
    })
  }, [tickets, searchQuery, filterPriority, dateFrom, dateTo])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const response = await fetch(`/api/tickets/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (response.ok) {
        toast.success("Ticket deleted successfully")
        fetchTickets()
      } else {
        const data = await response.json()
        toast.error(data.message || "Failed to delete ticket")
      }
    } catch (error) {
      console.error("Error deleting ticket:", error)
      toast.error("Failed to delete ticket")
    } finally {
      setDeleting(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending_approval: "bg-purple-100 text-purple-800",
      approved: "bg-teal-100 text-teal-800",
      rejected: "bg-red-100 text-red-800",
      open: "bg-yellow-100 text-yellow-800",
      "in-progress": "bg-blue-100 text-blue-800",
      in_progress: "bg-blue-100 text-blue-800",
      waiting_for_response: "bg-orange-100 text-orange-800",
      resolved: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending_approval: "Pending Approval",
      approved: "Approved",
      rejected: "Rejected",
      open: "Open",
      "in-progress": "In Progress",
      in_progress: "In Progress",
      waiting_for_response: "Waiting for Response",
      resolved: "Resolved",
      closed: "Closed",
    }
    return labels[status] || status
  }

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading tickets...</div>
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>Active Tickets</CardTitle>
            <div className="flex items-center gap-2">
              {/* Search Input */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Filter Toggle */}
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <Filter className="h-4 w-4" />
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Filters</h4>
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
                          <X className="h-3 w-3 mr-1" />
                          Clear all
                        </Button>
                      )}
                    </div>
                    
                    {/* Status Filter */}
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="pending_approval">Pending Approval</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="waiting_for_response">Waiting for Response</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority Filter */}
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={filterPriority} onValueChange={setFilterPriority}>
                        <SelectTrigger>
                          <SelectValue placeholder="All priorities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Priorities</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range Filter */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Date Range
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">From</Label>
                          <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">To</Label>
                          <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {filterStatus !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Status: {getStatusLabel(filterStatus)}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterStatus("all")} />
                </Badge>
              )}
              {filterPriority !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Priority: {filterPriority}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterPriority("all")} />
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{searchQuery}"
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                </Badge>
              )}
              {(dateFrom || dateTo) && (
                <Badge variant="secondary" className="gap-1">
                  Date: {dateFrom || "..."} - {dateTo || "..."}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { setDateFrom(""); setDateTo(""); }} />
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {tickets.length === 0 ? "No tickets found" : "No tickets match your filters"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">{ticket.ticket_number || "-"}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{ticket.title}</TableCell>
                    <TableCell>
                      {ticket.customer_name || 
                        (typeof ticket.customer_id === 'object' && ticket.customer_id?.company_name) || 
                        (typeof ticket.customer_id === 'string' ? ticket.customer_id : 'N/A')}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(ticket.status)}>{getStatusLabel(ticket.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ticket.priority}</Badge>
                    </TableCell>
                    <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewTicket(ticket.id)} className="gap-1.5">
                          <Eye className="h-4 w-4" />
                          View
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                        {userRole === ROLES.SUPER_ADMIN && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" disabled={deleting === ticket.id}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this ticket? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(ticket.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
