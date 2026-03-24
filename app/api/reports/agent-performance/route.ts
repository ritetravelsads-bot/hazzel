import connectDB from "@/lib/mongodb"
import { User, Ticket, CustomerAgentAssignment, Message, Customer } from "@/models"
import ExcelUpload from "@/models/ExcelUpload"
import { cookies } from "next/headers"

export async function GET() {
  try {
    await connectDB()
    
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie?.value) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    let session
    try {
      session = JSON.parse(sessionCookie.value)
    } catch {
      return Response.json({ error: "Invalid session" }, { status: 401 })
    }

    // Check if user is team and has super_admin role
    if (session.type !== "team" || session.session?.role !== "super_admin") {
      return Response.json({ error: "Forbidden: Only super admins can access reports" }, { status: 403 })
    }

    // Get all agents
    const agents = await User.find({
      role: { $in: ["agent", "manager", "super_admin", "accountant"] },
      is_active: true,
    })
      .sort({ created_at: -1 })
      .lean()

    // Get ticket counts per agent
    const ticketAggregation = await Ticket.aggregate([
      { $match: { assigned_agent_id: { $ne: null } } },
      {
        $group: {
          _id: "$assigned_agent_id",
          totalTickets: { $sum: 1 },
          openTickets: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
          inProgressTickets: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
          resolvedTickets: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
          closedTickets: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },
        },
      },
    ])

    // Get client assignments per agent
    const clientAggregation = await CustomerAgentAssignment.aggregate([
      {
        $group: {
          _id: "$agent_id",
          totalClients: { $addToSet: "$customer_id" },
        },
      },
      {
        $project: {
          _id: 1,
          totalClients: { $size: "$totalClients" },
        },
      },
    ])

    // Get excel uploads per agent
    const excelAggregation = await ExcelUpload.aggregate([
      { $match: { uploaded_by: { $ne: null } } },
      {
        $group: {
          _id: "$uploaded_by",
          totalExcelUploads: { $sum: 1 },
        },
      },
    ])

    // Calculate average response time per agent
    const responseTimeAggregation = await Ticket.aggregate([
      { $match: { assigned_agent_id: { $ne: null } } },
      {
        $lookup: {
          from: "messages",
          let: { ticketId: "$_id", agentId: "$assigned_agent_id", ticketCreated: "$created_at" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ticket_id", "$$ticketId"] },
                    { $eq: ["$sender_id", "$$agentId"] },
                    { $eq: ["$sender_type", "agent"] },
                  ],
                },
              },
            },
            { $sort: { created_at: 1 } },
            { $limit: 1 },
          ],
          as: "firstAgentMessage",
        },
      },
      { $unwind: { path: "$firstAgentMessage", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$assigned_agent_id",
          avgResponseTimeHours: {
            $avg: {
              $divide: [
                { $subtract: ["$firstAgentMessage.created_at", "$created_at"] },
                1000 * 60 * 60,
              ],
            },
          },
        },
      },
    ])

    // Combine agent data with metrics
    const agentMetrics = agents.map((agent: any) => {
      const tickets = ticketAggregation.find((t) => t._id?.toString() === agent._id.toString()) || {
        totalTickets: 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        closedTickets: 0,
      }
      const clients = clientAggregation.find((c) => c._id?.toString() === agent._id.toString()) || {
        totalClients: 0,
      }
      const excel = excelAggregation.find((e) => e._id?.toString() === agent._id.toString()) || {
        totalExcelUploads: 0,
      }
      const response = responseTimeAggregation.find((r) => r._id?.toString() === agent._id.toString()) || {
        avgResponseTimeHours: 0,
      }

      return {
        id: agent._id.toString(),
        full_name: agent.full_name,
        email: agent.email,
        gmail_address: agent.gmail_address,
        role: agent.role,
        created_at: agent.created_at,
        total_tickets: tickets.totalTickets,
        open_tickets: tickets.openTickets,
        in_progress_tickets: tickets.inProgressTickets,
        resolved_tickets: tickets.resolvedTickets,
        closed_tickets: tickets.closedTickets,
        total_clients: clients.totalClients,
        total_excel_uploads: excel.totalExcelUploads,
        avg_response_time_hours: Number((response.avgResponseTimeHours || 0).toFixed(2)),
      }
    })

    // Get detailed agent-client information
    const assignments = await CustomerAgentAssignment.find()
      .populate("agent_id", "full_name")
      .populate("customer_id", "company_name contact_person email")
      .lean()

    const agentClientDetails = await Promise.all(
      assignments.map(async (assignment: any) => {
        if (!assignment.customer_id || !assignment.agent_id) return null

        const tickets = await Ticket.find({
          customer_id: assignment.customer_id._id,
          assigned_agent_id: assignment.agent_id._id,
        }).lean()

        const excelCount = await ExcelUpload.countDocuments({
          uploaded_by: assignment.agent_id._id,
          customer_id: assignment.customer_id._id,
        })

        const lastMessage = await Message.findOne({
          ticket_id: { $in: tickets.map((t: any) => t._id) },
        })
          .sort({ created_at: -1 })
          .lean()

        return {
          agent_id: assignment.agent_id._id.toString(),
          agent_name: assignment.agent_id.full_name,
          customer_id: assignment.customer_id._id.toString(),
          company_name: assignment.customer_id.company_name,
          contact_person: assignment.customer_id.contact_person,
          customer_email: assignment.customer_id.email,
          tickets_count: tickets.length,
          resolved_count: tickets.filter((t: any) => t.status === "resolved").length,
          closed_count: tickets.filter((t: any) => t.status === "closed").length,
          in_progress_count: tickets.filter((t: any) => t.status === "in_progress").length,
          open_count: tickets.filter((t: any) => t.status === "open").length,
          excel_files_count: excelCount,
          last_message_time: lastMessage?.created_at || null,
        }
      })
    )

    // Filter out null entries
    const filteredAgentClientDetails = agentClientDetails.filter(Boolean)

    // Calculate summary statistics
    const totalTickets = agentMetrics.reduce((sum, agent: any) => sum + (agent.total_tickets || 0), 0)
    const totalResolvedTickets = agentMetrics.reduce((sum, agent: any) => sum + (agent.resolved_tickets || 0), 0)
    const totalClosedTickets = agentMetrics.reduce((sum, agent: any) => sum + (agent.closed_tickets || 0), 0)
    const totalOpenTickets = agentMetrics.reduce((sum, agent: any) => sum + (agent.open_tickets || 0), 0)
    const totalInProgressTickets = agentMetrics.reduce((sum, agent: any) => sum + (agent.in_progress_tickets || 0), 0)
    const avgResponseTimeAcrossAgents =
      agentMetrics.reduce((sum, agent: any) => sum + (agent.avg_response_time_hours || 0), 0) /
      Math.max(agentMetrics.length, 1)

    const uniqueCustomerIds = [...new Set(filteredAgentClientDetails.map((item: any) => item.customer_id))]

    return Response.json({
      agentMetrics,
      agentClientDetails: filteredAgentClientDetails,
      summary: {
        totalAgents: agentMetrics.length,
        totalTickets,
        totalResolvedTickets,
        totalClosedTickets,
        totalOpenTickets,
        totalInProgressTickets,
        totalClients: uniqueCustomerIds.length,
        avgResponseTime: Number(avgResponseTimeAcrossAgents.toFixed(2)),
      },
    })
  } catch (error) {
    console.error("Error fetching agent performance metrics:", error)
    return Response.json(
      { error: "Failed to fetch agent performance metrics", details: String(error) },
      { status: 500 }
    )
  }
}
