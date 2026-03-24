import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import connectDB from "@/lib/mongodb"
import InvoiceRequest from "@/models/InvoiceRequest"
import CustomerUser from "@/models/CustomerUser"
import Customer from "@/models/Customer"
import User from "@/models/User"
import Notification from "@/models/Notification"
import CustomerAgentAssignment from "@/models/CustomerAgentAssignment"
import { sendSMS, sendWhatsApp } from "@/lib/sms"
import { logActivity } from "@/lib/activity-logger"
import { CUSTOMER_ROLES, ROLES } from "@/lib/constants"

async function getSession() {
  const cookieStore = await cookies()
  const customerSession = cookieStore.get("customer-session")
  if (!customerSession) return null

  try {
    const session = JSON.parse(customerSession.value)
    return { ...session, type: "customer" }
  } catch {
    return null
  }
}

// POST - Approve or reject invoice request
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.type !== "customer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const { id } = await params
    const body = await request.json()
    const { action, rejected_reason } = body

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Verify user is customer_admin
    const customerUser = await CustomerUser.findById(session.userId)
    if (!customerUser || customerUser.role !== CUSTOMER_ROLES.CUSTOMER_ADMIN) {
      return NextResponse.json({ error: "Only customer admins can approve requests" }, { status: 403 })
    }

    const invoiceRequest = await InvoiceRequest.findById(id).populate("customer_id")
    if (!invoiceRequest) {
      return NextResponse.json({ error: "Invoice request not found" }, { status: 404 })
    }

    // Verify request belongs to same customer
    if (invoiceRequest.customer_id._id.toString() !== session.customerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (invoiceRequest.status !== "pending_approval") {
      return NextResponse.json({ error: "Request already processed" }, { status: 400 })
    }

    if (action === "approve") {
      invoiceRequest.status = "approved"
      invoiceRequest.approved_by = session.userId
      invoiceRequest.approved_at = new Date()
      await invoiceRequest.save()

      // Find and notify all accountants and account users
      const accountants = await User.find({
        role: { $in: [ROLES.ACCOUNTANT, ROLES.ACCOUNT] },
        is_active: true,
      })

      const customer = await Customer.findById(session.customerId)
      const customerName = customer?.company_name || "Customer"
      const dateRange = `${new Date(invoiceRequest.date_range_start).toLocaleDateString()} - ${new Date(invoiceRequest.date_range_end).toLocaleDateString()}`

      for (const accountant of accountants) {
        // Create notification
        await Notification.create({
          user_id: accountant._id,
          user_type: "team",
          event_type: "invoice_request_approved",
          entity_type: "invoice_request",
          entity_id: invoiceRequest._id,
          title: "Invoice Request Approved",
          message: `Invoice request ${invoiceRequest.request_number} from ${customerName} (${dateRange}) has been approved and needs invoice upload.`,
          read: false,
        })

        // Send SMS
        if (accountant.mobile_number) {
          const smsMessage = `Invoice Request Alert!\nRequest: ${invoiceRequest.request_number}\nCustomer: ${customerName}\nPeriod: ${dateRange}\nPlease upload the invoice.`

          await sendSMS({
            to: accountant.mobile_number,
            message: smsMessage,
            type: "invoice_request_approved",
            relatedId: id,
          })

          // Send WhatsApp
          await sendWhatsApp({
            to: accountant.mobile_number,
            message: smsMessage,
            type: "invoice_request_approved",
            relatedId: id,
          })
        }
      }

      await logActivity({
        entityType: "invoice_request",
        entityId: id,
        action: "approve",
        performedBy: session.userId,
        performedByType: "customer_user",
        details: `Approved invoice request ${invoiceRequest.request_number}`,
      })

      return NextResponse.json({ success: true, status: "approved" })
    } else {
      // Reject
      if (!rejected_reason) {
        return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
      }

      invoiceRequest.status = "rejected"
      invoiceRequest.rejected_reason = rejected_reason
      await invoiceRequest.save()

      // Notify the requester
      await Notification.create({
        user_id: invoiceRequest.requested_by,
        user_type: "customer_user",
        event_type: "invoice_request_rejected",
        entity_type: "invoice_request",
        entity_id: invoiceRequest._id,
        title: "Invoice Request Rejected",
        message: `Your invoice request ${invoiceRequest.request_number} was rejected. Reason: ${rejected_reason}`,
        read: false,
      })

      await logActivity({
        entityType: "invoice_request",
        entityId: id,
        action: "reject",
        performedBy: session.userId,
        performedByType: "customer_user",
        details: `Rejected invoice request ${invoiceRequest.request_number}: ${rejected_reason}`,
      })

      return NextResponse.json({ success: true, status: "rejected" })
    }
  } catch (error) {
    console.error("[Invoice Request Approve Error]", error)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
