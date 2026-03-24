import connectDB from "@/lib/mongodb"
import Ticket from "@/models/Ticket"
import CustomerAgentAssignment from "@/models/CustomerAgentAssignment"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { ROLES } from "@/lib/constants"
import mongoose from "mongoose"

export async function GET() {
  try {
    await connectDB()
    
    const cookieStore = await cookies()
    const teamSession = cookieStore.get("team-session")
    const customerSession = cookieStore.get("customer-session")

    if (!teamSession && !customerSession) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    let sessionData
    let userType = "team"
    
    try {
      if (teamSession) {
        sessionData = JSON.parse(teamSession.value)
        userType = "team"
      } else if (customerSession) {
        sessionData = JSON.parse(customerSession.value)
        userType = "customer"
      }
    } catch {
      return NextResponse.json({ message: "Invalid session" }, { status: 401 })
    }

    let matchStage: any = {}

    if (userType === "customer") {
      const custId = sessionData.customerId
      matchStage.customer_id = new mongoose.Types.ObjectId(custId)
    } else if (sessionData.role === ROLES.AGENT) {
      // Team agents only see tickets for assigned customers
      const assignments = await CustomerAgentAssignment.find({ agent_id: sessionData.userId })
      const customerIds = assignments.map((a: any) => new mongoose.Types.ObjectId(a.customer_id))

      if (customerIds.length === 0) {
        return NextResponse.json({
          open: 0,
          inProgress: 0,
          resolved: 0,
          closed: 0,
          total: 0,
          pendingApproval: 0,
        })
      }

      matchStage.customer_id = { $in: customerIds }
    }
    // Super admin, admin, manager can see all tickets - no filter needed

    const stats = await Ticket.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: {
            $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] }
          },
          inProgress: {
            $sum: { 
              $cond: [
                { $or: [
                  { $eq: ["$status", "in-progress"] },
                  { $eq: ["$status", "in_progress"] }
                ]}, 
                1, 
                0
              ] 
            }
          },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
          },
          closed: {
            $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] }
          },
          pendingApproval: {
            $sum: { $cond: [{ $eq: ["$status", "pending_approval"] }, 1, 0] }
          },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
          },
        }
      }
    ])

    if (stats.length === 0) {
      return NextResponse.json({
        open: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        total: 0,
        pendingApproval: 0,
        approved: 0,
        rejected: 0,
      })
    }

    const result = stats[0]
    return NextResponse.json({
      open: result.open || 0,
      inProgress: result.inProgress || 0,
      resolved: result.resolved || 0,
      closed: result.closed || 0,
      total: result.total || 0,
      pendingApproval: result.pendingApproval || 0,
      approved: result.approved || 0,
      rejected: result.rejected || 0,
    })
  } catch (error) {
    console.error("[v0] Error fetching ticket stats:", error)
    return NextResponse.json({ message: "Error fetching ticket stats" }, { status: 500 })
  }
}
