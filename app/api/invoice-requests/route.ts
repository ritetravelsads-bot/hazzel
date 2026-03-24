import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import connectDB from "@/lib/mongodb"
import InvoiceRequest from "@/models/InvoiceRequest"
import CustomerUser from "@/models/CustomerUser"
import Customer from "@/models/Customer"
import User from "@/models/User"
import Notification from "@/models/Notification"
import { getNextSequence } from "@/models/Counter"
import { logActivity } from "@/lib/activity-logger"
import { CUSTOMER_ROLES, ROLES } from "@/lib/constants"
import mongoose from "mongoose"

async function getSession() {
  const cookieStore = await cookies()
  
  // Check for team session first
  const teamSession = cookieStore.get("team-session")
  if (teamSession) {
    try {
      const session = JSON.parse(teamSession.value)
      return { ...session, type: "team" }
    } catch {
      // continue to check customer session
    }
  }

  // Check for customer session
  const customerSession = cookieStore.get("customer-session")
  if (customerSession) {
    try {
      const session = JSON.parse(customerSession.value)
      return { ...session, type: "customer" }
    } catch {
      return null
    }
  }

  return null
}

// GET - List invoice requests
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const customerId = searchParams.get("customerId")

    const query: any = {}

    // For customer users, only show their customer's requests
    if (session.type === "customer") {
      query.customer_id = session.customerId
    }

    // For team users (accountant), show all approved requests or filter by customer
    if (session.type === "team") {
      const user = await User.findById(session.userId)
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      // Accountants and Account users can only see approved requests
      if (user.role === ROLES.ACCOUNTANT || user.role === ROLES.ACCOUNT) {
        query.status = { $in: ["approved", "uploaded"] }
      }

      if (customerId) {
        query.customer_id = new mongoose.Types.ObjectId(customerId)
      }
    }

    if (status && status !== "all") {
      query.status = status
    }

    const requests = await InvoiceRequest.find(query)
      .populate("customer_id", "company_name email phone")
      .populate("requested_by", "full_name email")
      .populate("approved_by", "full_name email")
      .populate("invoice_id")
      .sort({ created_at: -1 })
      .lean()

    const transformed = requests.map((req: any) => ({
      id: req._id.toString(),
      request_number: req.request_number,
      customer_id: req.customer_id?._id?.toString(),
      customer_name: req.customer_id?.company_name,
      customer_email: req.customer_id?.email,
      customer_phone: req.customer_id?.phone,
      requested_by_id: req.requested_by?._id?.toString(),
      requested_by_name: req.requested_by?.full_name,
      date_range_start: req.date_range_start,
      date_range_end: req.date_range_end,
      description: req.description,
      status: req.status,
      approved_by_name: req.approved_by?.full_name,
      approved_at: req.approved_at,
      rejected_reason: req.rejected_reason,
      invoice: req.invoice_id
        ? {
            id: req.invoice_id._id.toString(),
            file_url: req.invoice_id.file_url,
            file_name: req.invoice_id.file_name,
            visibility_start: req.invoice_id.visibility_start,
            visibility_end: req.invoice_id.visibility_end,
            is_active: req.invoice_id.is_active,
          }
        : null,
      created_at: req.created_at,
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("[Invoice Requests GET Error]", error)
    return NextResponse.json({ error: "Failed to fetch invoice requests" }, { status: 500 })
  }
}

// POST - Create invoice request
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.type !== "customer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const body = await request.json()
    const { date_range_start, date_range_end, description } = body

    if (!date_range_start || !date_range_end) {
      return NextResponse.json({ error: "Date range is required" }, { status: 400 })
    }

    // Generate request number
    const sequence = await getNextSequence("invoice_request")
    const requestNumber = `INV-REQ-${String(sequence).padStart(6, "0")}`

    // Determine initial status based on who creates the request
    // customer_admin: auto-approved, customer_agent: needs approval
    const isAdmin = session.role === CUSTOMER_ROLES.CUSTOMER_ADMIN
    const initialStatus = isAdmin ? "approved" : "pending_approval"

    const invoiceRequest = await InvoiceRequest.create({
      request_number: requestNumber,
      customer_id: session.customerId,
      requested_by: session.userId,
      date_range_start: new Date(date_range_start),
      date_range_end: new Date(date_range_end),
      description,
      status: initialStatus,
      // If admin creates, auto-approve
      approved_by: isAdmin ? session.userId : undefined,
      approved_at: isAdmin ? new Date() : undefined,
    })

    if (isAdmin) {
      // Auto-approved - notify accountants and account users directly
      const { sendSMS, sendWhatsApp, formatInvoiceRequestApprovedSMS } = await import("@/lib/sms")
      
      const customer = await Customer.findById(session.customerId)
      const accountants = await User.find({ 
        role: { $in: [ROLES.ACCOUNTANT, ROLES.ACCOUNT] }, 
        is_active: true 
      })

      const dateFrom = new Date(date_range_start).toLocaleDateString()
      const dateTo = new Date(date_range_end).toLocaleDateString()

      for (const accountant of accountants) {
        // Send SMS notification
        if (accountant.mobile_number) {
          await sendSMS({
            to: accountant.mobile_number,
            message: formatInvoiceRequestApprovedSMS(
              requestNumber,
              customer?.company_name || "Customer",
              dateFrom,
              dateTo
            ),
            type: "invoice_request_approved",
            relatedId: invoiceRequest._id.toString(),
          })

          // Send WhatsApp notification
          await sendWhatsApp({
            to: accountant.mobile_number,
            message: formatInvoiceRequestApprovedSMS(
              requestNumber,
              customer?.company_name || "Customer",
              dateFrom,
              dateTo
            ),
            type: "invoice_request_approved",
            relatedId: invoiceRequest._id.toString(),
          })
        }

        // Create in-app notification
        await Notification.create({
          user_id: accountant._id,
          user_type: "team",
          event_type: "invoice_request_approved",
          entity_type: "invoice_request",
          entity_id: invoiceRequest._id,
          title: "New Invoice Request Approved",
          message: `Invoice request ${requestNumber} from ${customer?.company_name || "Customer"} is ready for processing.`,
          read: false,
        })
      }

      await logActivity({
        entityType: "invoice_request",
        entityId: invoiceRequest._id.toString(),
        action: "create",
        performedBy: session.userId,
        performedByType: "customer_user",
        details: `Created and auto-approved invoice request ${requestNumber}`,
      })

      return NextResponse.json(
        {
          id: invoiceRequest._id.toString(),
          request_number: invoiceRequest.request_number,
          status: invoiceRequest.status,
          message: "Invoice request created and sent to accountant.",
        },
        { status: 201 }
      )
    } else {
      // Needs approval - notify customer_admin users
      const customerAdmins = await CustomerUser.find({
        customer_id: session.customerId,
        role: CUSTOMER_ROLES.CUSTOMER_ADMIN,
        is_active: true,
      })

      for (const admin of customerAdmins) {
        await Notification.create({
          user_id: admin._id,
          user_type: "customer_user",
          event_type: "invoice_request_pending",
          entity_type: "invoice_request",
          entity_id: invoiceRequest._id,
          title: "New Invoice Request",
          message: `New invoice request ${requestNumber} needs your approval.`,
          read: false,
        })
      }

      await logActivity({
        entityType: "invoice_request",
        entityId: invoiceRequest._id.toString(),
        action: "create",
        performedBy: session.userId,
        performedByType: "customer_user",
        details: `Created invoice request ${requestNumber} (pending approval)`,
      })

      return NextResponse.json(
        {
          id: invoiceRequest._id.toString(),
          request_number: invoiceRequest.request_number,
          status: invoiceRequest.status,
          message: "Invoice request submitted for approval.",
        },
        { status: 201 }
      )
    }
  } catch (error) {
    console.error("[Invoice Request POST Error]", error)
    return NextResponse.json({ error: "Failed to create invoice request" }, { status: 500 })
  }
}
