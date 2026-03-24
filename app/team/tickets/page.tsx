"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { TeamNav } from "@/components/team/team-nav"
import { TicketsView } from "@/components/team/tickets-view"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Ticket, AlertCircle, Clock, CheckCircle2 } from "lucide-react"

interface TicketStats {
  open: number
  inProgress: number
  resolved: number
  closed: number
  total: number
  pendingApproval: number
}

export default function TicketsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<TicketStats>({
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    total: 0,
    pendingApproval: 0,
  })

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/tickets/stats", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("[v0] Stats fetch error:", error)
    }
  }

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        })

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
        fetchStats()
      } catch (error) {
        console.error("[v0] Session error:", error)
        router.push("/team/login")
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [router])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
    toast.success("Logged out successfully")
    router.push("/team/login")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading tickets...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        <TeamNav user={user} onLogout={handleLogout} />
        <SidebarInset className="flex-1 flex flex-col">
          {/* Mobile Header */}
          <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 md:hidden">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Tickets</h1>
            </div>
          </header>
          
          <main className="flex-1 overflow-auto">
            <div className="container max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
              {/* Page Header */}
              <div className="flex flex-col gap-2 mb-8">
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Ticket className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                      Support Tickets
                    </h1>
                    <p className="text-muted-foreground">
                      Manage and respond to customer support requests
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="card-hover">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Open</p>
                        <p className="text-2xl font-bold">{stats.open}</p>
                      </div>
                      <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-hover">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">In Progress</p>
                        <p className="text-2xl font-bold">{stats.inProgress}</p>
                      </div>
                      <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-hover">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Closed</p>
                        <p className="text-2xl font-bold">{stats.closed}</p>
                      </div>
                      <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-hover">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold">{stats.total}</p>
                      </div>
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tickets Content */}
              <Card>
                <CardHeader>
                  <CardTitle>All Tickets</CardTitle>
                  <CardDescription>
                    View, filter, and manage support tickets from all customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TicketsView userRole={user?.role} userId={user?.userId} />
                </CardContent>
              </Card>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
