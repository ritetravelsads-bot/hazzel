"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CustomerNav } from "@/components/customer/customer-nav"
import { TicketConversation } from "@/components/common/ticket-conversation"
import { toast } from "sonner"
import { 
  ArrowLeft, 
  Package, 
  Calendar, 
  User, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare
} from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
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
import { format } from "date-fns"

export default function CustomerTicketDetailPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string
  const [customer, setCustomer] = useState<any>(null)
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [hasTeamReplied, setHasTeamReplied] = useState(false)

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

  const checkTeamReplies = async () => {
    try {
      const response = await fetch(`/api/messages?ticketId=${ticketId}`)
      if (response.ok) {
        const messages = await response.json()
        const teamReplied = messages.some((msg: any) => msg.sender_type === "agent")
        setHasTeamReplied(teamReplied)
      }
    } catch (error) {
      console.error("[v0] Error checking team replies:", error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session", {
          credentials: "include",
        })

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

        await fetchTicket()
        await checkTeamReplies()
      } catch (error) {
        console.error("[v0] Load ticket error:", error)
        toast.error("Failed to load ticket")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, ticketId])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
    toast.success("Logged out successfully")
    router.push("/customer/login")
  }

  const handleCloseTicket = async () => {
    setClosing(true)
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
        credentials: "include",
      })

      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket)
        toast.success("Ticket closed successfully")
      } else {
        toast.error("Failed to close ticket")
      }
    } catch (error) {
      console.error("[v0] Close ticket error:", error)
      toast.error("An error occurred")
    } finally {
      setClosing(false)
    }
  }

  const handleConversationUpdate = () => {
    checkTeamReplies()
    fetchTicket()
  }

  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
    pending_approval: { variant: "secondary", label: "Pending Approval", icon: <Clock className="h-3.5 w-3.5" /> },
    approved: { variant: "default", label: "Approved", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    rejected: { variant: "destructive", label: "Rejected", icon: <XCircle className="h-3.5 w-3.5" /> },
    open: { variant: "default", label: "Open", icon: <AlertCircle className="h-3.5 w-3.5" /> },
    in_progress: { variant: "secondary", label: "In Progress", icon: <Clock className="h-3.5 w-3.5" /> },
    waiting_for_response: { variant: "default", label: "Waiting for Response", icon: <MessageSquare className="h-3.5 w-3.5" /> },
    resolved: { variant: "outline", label: "Resolved", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    closed: { variant: "outline", label: "Closed", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  }

  const priorityConfig: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    low: "outline",
    medium: "secondary",
    high: "default",
    urgent: "destructive",
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!ticket) {
    return <div className="flex items-center justify-center h-screen">Ticket not found</div>
  }

  const status = statusConfig[ticket.status] || { variant: "outline" as const, label: ticket.status, icon: null }
  // Customer can only close ticket when status is "waiting_for_response"
  const canCloseTicket = ticket.status === "waiting_for_response"

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background w-full">
        <CustomerNav customer={customer} onLogout={handleLogout} />
        <SidebarInset>
          <header className="flex items-center gap-2 border-b p-4 md:hidden">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">Ticket Details</h1>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="p-4 md:p-8 max-w-6xl mx-auto">
              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/customer/tickets">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl md:text-2xl font-bold">{ticket.title}</h1>
                    <Badge variant={status.variant} className="gap-1.5">
                      {status.icon}
                      {status.label}
                    </Badge>
                    <Badge variant={priorityConfig[ticket.priority] || "outline"}>
                      {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} Priority
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">
                    Ticket #{ticket.id.slice(0, 8)} - Created {format(new Date(ticket.created_at), "MMMM d, yyyy")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Ticket Description */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Issue Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>

                      {ticket.product_code && (
                        <>
                          <Separator />
                          <div className="flex items-center gap-3">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Related Product</p>
                              <p className="text-sm font-medium">
                                <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs">{ticket.product_code}</code>
                                {ticket.product_name && ` - ${ticket.product_name}`}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Pending Approval Notice */}
                  {ticket.status === "pending_approval" && (
                    <Card className="border-amber-200 bg-amber-50">
                      <CardContent className="py-6">
                        <div className="flex items-start gap-3">
                          <Clock className="text-amber-600 mt-0.5" size={20} />
                          <div>
                            <p className="font-medium text-amber-800">Awaiting Approval</p>
                            <p className="text-sm text-amber-700 mt-1">
                              This ticket is waiting for approval from your customer admin before it can be processed by the support team.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Rejected Notice */}
                  {ticket.status === "rejected" && (
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="py-6">
                        <div className="flex items-start gap-3">
                          <XCircle className="text-red-600 mt-0.5" size={20} />
                          <div>
                            <p className="font-medium text-red-800">Ticket Rejected</p>
                            <p className="text-sm text-red-700 mt-1">
                              {ticket.approval_notes || "This ticket was rejected by your customer admin."}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Conversation Section */}
                  {ticket.status !== "pending_approval" && ticket.status !== "rejected" && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <MessageSquare className="h-5 w-5" />
                              Support Conversation
                            </CardTitle>
                            <CardDescription className="mt-1">
                              Communicate with our support team
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <TicketConversation
                          ticketId={ticketId}
                          senderType={customer?.customerUserId ? "customer_user" : "customer"}
                          senderId={customer?.customerUserId || customer?.customerId}
                          senderName={customer?.name || customer?.email}
                          ticketStatus={ticket.status}
                          hasTeamReplied={hasTeamReplied}
                          onStatusChange={handleConversationUpdate}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Close Ticket Action */}
                  {canCloseTicket && (
                    <Card className="border-green-200 bg-green-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-green-800">Issue Resolved?</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-green-700 mb-4">
                          If your issue has been resolved, you can close this ticket.
                        </p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button className="w-full" variant="default" disabled={closing}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Close Ticket
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Close this ticket?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will mark the ticket as closed. You can still view the ticket history, but you won't be able to send more messages.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleCloseTicket}>
                                Yes, close ticket
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </CardContent>
                    </Card>
                  )}

                  {/* Status Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Current Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge variant={status.variant} className="gap-1.5">
                          {status.icon}
                          {status.label}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Priority</span>
                        <Badge variant={priorityConfig[ticket.priority] || "outline"}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Timeline Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">
                          {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>

                      {ticket.approval_date && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {ticket.status === "rejected" ? "Rejected" : "Approved"}
                            </p>
                            <p className="text-sm font-medium">
                              {format(new Date(ticket.approval_date), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </>
                      )}

                      {ticket.updated_at && ticket.updated_at !== ticket.created_at && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs text-muted-foreground">Last Updated</p>
                            <p className="text-sm font-medium">
                              {format(new Date(ticket.updated_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Assigned Agent */}
                  {ticket.assigned_to_name && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Assigned Agent
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-medium">{ticket.assigned_to_name}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
