import { connectToDatabase } from "@/lib/mongodb"
import { CustomerProduct, Ticket, Product } from "@/models"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const cookieStore = await cookies()
    const customerSession = cookieStore.get("customer-session")

    if (!customerSession) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
      const session = JSON.parse(customerSession.value)
      if (session.customerId !== id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    await connectToDatabase()

    const [totalProducts, openTickets, inProgressTickets, closedTickets, recentTickets] = await Promise.all([
      CustomerProduct.countDocuments({ customer_id: id, isActive: true }),
      Ticket.countDocuments({ customer_id: id, status: "open" }),
      Ticket.countDocuments({ customer_id: id, status: "in_progress" }),
      Ticket.countDocuments({ customer_id: id, status: "closed" }),
      Ticket.find({ customer_id: id })
        .sort({ created_at: -1 })
        .limit(3)
        .populate("product_id", "name productCode")
        .lean(),
    ])

    return NextResponse.json({
      totalProducts,
      openTickets,
      inProgressTickets,
      closedTickets,
      recentTickets: recentTickets.map((t: any) => ({
        id: t._id.toString(),
        ticketNumber: t.ticket_number,
        title: t.title,
        status: t.status,
        priority: t.priority,
        productName: t.product_id?.name || null,
        createdAt: t.created_at,
      })),
    })
  } catch (error) {
    console.error("[v0] Error fetching customer stats:", error)
    return NextResponse.json(
      {
        totalProducts: 0,
        openTickets: 0,
        inProgressTickets: 0,
        closedTickets: 0,
        recentTickets: [],
      },
      { status: 200 },
    )
  }
}
