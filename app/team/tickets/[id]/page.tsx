"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TeamNav } from "@/components/team/team-nav"
import { TicketConversation } from "@/components/common/ticket-conversation"
import { toast } from "sonner"
import { ArrowLeft, Calendar, Building2, Package, AlertCircle, User, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"

export default function TicketDetailPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string
  const [user, setUser] = useState<any>(null)
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const fetchTicket = async () => {
    try {
      const ticketResponse = await fetch(`/api/tickets/${ticketId}`, {
        credentials: "include",
      })

      if (ticketResponse.ok) {
        const ticketData = await ticketResponse.json()
        setTicket(ticketData)
      }
    } catch (error) {
      console.error("[v0] Error fetching ticket:", error)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session", {
          credentials: "include",
        })

        if (!sessionResponse.ok) {
          router.push("/team/login")
          return
        }

        const sessionData = await sessionResponse.json()

        if (!sessionData.session || sessionData.type !== "team") {
          router.push("/team/login")
          return
        }

        setUser(sessionData.session)
        await fetchTicket()
      } catch (error) {
        console.error("[v0] Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, ticketId])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    router.push("/team/login")
  }

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      })

      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket)
        toast.success("Status updated successfully")
      } else {
        toast.error("Failed to update status")
      }
    } catch (error) {
      console.error("[v0] Error updating status:", error)
      toast.error("An error occurred")
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!user || !ticket) return null

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    open: "default",
    in_progress: "secondary",
    waiting_for_response: "default",
    resolved: "outline",
    closed: "outline",
  }

  const priorityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    low: "outline",
    medium: "secondary",
    high: "default",
    urgent: "destructive",
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background w-full">
        <TeamNav user={user} onLogout={handleLogout} />
        <main className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/team/tickets">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">Ticket #{ticket.id.slice(0, 8)}</h1>
                  <Badge variant={statusVariant[ticket.status] || "default"}>
                    {ticket.status.replace("-", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Badge>
                  <Badge variant={priorityVariant[ticket.priority] || "outline"}>
                    {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} Priority
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Created {format(new Date(ticket.created_at), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content - Conversation */}
              <div className="lg:col-span-2 space-y-6">
                {/* Ticket Description */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      {ticket.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
                  </CardContent>
                </Card>

                {/* Conversation */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Conversation</CardTitle>
                    <CardDescription>
                      Communicate with the customer about this ticket
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <TicketConversation
                      ticketId={ticketId}
                      senderType="agent"
                      senderId={user.id}
                      senderName={user.name || user.email}
                      ticketStatus={ticket.status}
                      onStatusChange={fetchTicket}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar - Ticket Details */}
              <div className="space-y-6">
                {/* Status Management */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Manage Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={ticket.status} onValueChange={handleStatusUpdate} disabled={updating}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting_for_response">Waiting for Response</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    {ticket.status === "waiting_for_response" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Customer can now close this ticket once their issue is resolved.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Ticket Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Ticket Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Customer</p>
                        <p className="text-sm font-medium">{ticket.customer_name || "N/A"}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Submitted By</p>
                        <p className="text-sm font-medium">{ticket.created_by_name || ticket.created_by_email || "N/A"}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Package className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Product</p>
                        <p className="text-sm font-medium">{ticket.product_name || "N/A"}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">
                          {format(new Date(ticket.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    {ticket.updated_at && (
                      <>
                        <Separator />
                        <div className="flex items-start gap-3">
                          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Last Updated</p>
                            <p className="text-sm font-medium">
                              {format(new Date(ticket.updated_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
