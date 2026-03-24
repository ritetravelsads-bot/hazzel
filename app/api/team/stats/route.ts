import { connectToDatabase } from "@/lib/mongodb"
import { Customer, Ticket, Product, ActivityLog } from "@/models"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const teamSession = cookieStore.get("team-session")

    if (!teamSession) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    await connectToDatabase()

    const [
      totalCustomers,
      openTickets,
      inProgressTickets,
      closedTickets,
      totalProducts,
      recentTickets,
      recentCustomers,
      recentActivity,
    ] = await Promise.all([
      Customer.countDocuments({ isActive: true }),
      Ticket.countDocuments({ status: "open" }),
      Ticket.countDocuments({ status: "in_progress" }),
      Ticket.countDocuments({ status: "closed" }),
      Product.countDocuments({ status: "active" }),
      // Recent tickets
      Ticket.find()
        .sort({ created_at: -1 })
        .limit(3)
        .populate("customer_id", "company_name")
        .lean(),
      // Recent customers with ticket count
      Customer.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: "tickets",
            localField: "_id",
            foreignField: "customer_id",
            as: "tickets",
          },
        },
        {
          $project: {
            company_name: 1,
            ticketCount: { $size: "$tickets" },
          },
        },
        { $sort: { ticketCount: -1 } },
        { $limit: 3 },
      ]),
      // Recent activity
      ActivityLog.find()
        .sort({ created_at: -1 })
        .limit(3)
        .lean(),
    ])

    const stats = {
      totalCustomers,
      openTickets,
      inProgressTickets,
      closedTickets,
      totalProducts,
      recentTickets: recentTickets.map((t: any) => ({
        id: t._id.toString(),
        ticketNumber: t.ticket_number,
        title: t.title,
        status: t.status,
        priority: t.priority,
        customerName: t.customer_id?.company_name || "Unknown",
        createdAt: t.created_at,
      })),
      recentCustomers: recentCustomers.map((c: any) => ({
        id: c._id.toString(),
        companyName: c.company_name,
        ticketCount: c.ticketCount,
      })),
      recentActivity: recentActivity.map((a: any) => ({
        id: a._id.toString(),
        action: a.action,
        entityType: a.entity_type,
        performedByName: a.performed_by_name,
        details: a.details,
        createdAt: a.created_at,
      })),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("[v0] Error fetching stats:", error)
    return NextResponse.json({ message: "Error fetching stats" }, { status: 500 })
  }
}
