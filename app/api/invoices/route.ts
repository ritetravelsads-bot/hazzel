import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { put, del } from "@vercel/blob"
import connectDB from "@/lib/mongodb"
import Invoice from "@/models/Invoice"
import InvoiceRequest from "@/models/InvoiceRequest"
import Customer from "@/models/Customer"
import CustomerUser from "@/models/CustomerUser"
import User from "@/models/User"
import Notification from "@/models/Notification"
import { getNextSequence } from "@/models/Counter"
import { logActivity } from "@/lib/activity-logger"
import { sendSMS, sendWhatsApp } from "@/lib/sms"
import { ROLES } from "@/lib/constants"
import mongoose from "mongoose"

async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("session")
  if (!sessionCookie) return null

  try {
    return JSON.parse(sessionCookie.value)
  } catch {
    return null
  }
}

// GET - List invoices
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")

    const query: any = {}

    // For customers, only show their active invoices within visibility period
    if (session.type === "customer") {
      query.customer_id = session.customerId
      query.is_active = true
      query.visibility_start = { $lte: new Date() }
      query.visibility_end = { $gte: new Date() }
    }

    // For team (accountant), show all or filter
    if (session.type === "team") {
      if (customerId) {
        query.customer_id = new mongoose.Types.ObjectId(customerId)
      }
    }

    const invoices = await Invoice.find(query)
      .populate("customer_id", "company_name email")
      .populate("invoice_request_id", "request_number date_range_start date_range_end")
      .populate("uploaded_by", "full_name")
      .sort({ created_at: -1 })
      .lean()

    const transformed = invoices.map((inv: any) => ({
      id: inv._id.toString(),
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id?._id?.toString(),
      customer_name: inv.customer_id?.company_name,
      request_number: inv.invoice_request_id?.request_number,
      file_url: inv.file_url,
      file_name: inv.file_name,
      file_size: inv.file_size,
      date_range_start: inv.date_range_start,
      date_range_end: inv.date_range_end,
      visibility_start: inv.visibility_start,
      visibility_end: inv.visibility_end,
      is_active: inv.is_active,
      download_count: inv.download_count,
      uploaded_by_name: inv.uploaded_by?.full_name,
      created_at: inv.created_at,
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("[Invoices GET Error]", error)
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
  }
}

// POST - Upload invoice (accountant only)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.type !== "team") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    // Verify user is accountant
    const user = await User.findById(session.userId)
    if (!user || user.role !== ROLES.ACCOUNTANT) {
      return NextResponse.json({ error: "Only accountants can upload invoices" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const invoiceRequestId = formData.get("invoice_request_id") as string
    const visibilityStart = formData.get("visibility_start") as string
    const visibilityEnd = formData.get("visibility_end") as string

    if (!file || !invoiceRequestId || !visibilityStart || !visibilityEnd) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify invoice request exists and is approved
    const invoiceRequest = await InvoiceRequest.findById(invoiceRequestId).populate("customer_id")
    if (!invoiceRequest) {
      return NextResponse.json({ error: "Invoice request not found" }, { status: 404 })
    }

    if (invoiceRequest.status !== "approved") {
      return NextResponse.json({ error: "Invoice request is not approved" }, { status: 400 })
    }

    // Upload file to Blob
    const blob = await put(`invoices/${invoiceRequestId}/${file.name}`, file, {
      access: "public",
    })

    // Generate invoice number
    const sequence = await getNextSequence("invoice")
    const invoiceNumber = `INV-${String(sequence).padStart(6, "0")}`

    // Create invoice
    const invoice = await Invoice.create({
      invoice_number: invoiceNumber,
      invoice_request_id: invoiceRequestId,
      customer_id: invoiceRequest.customer_id._id,
      uploaded_by: session.userId,
      file_url: blob.url,
      file_name: file.name,
      file_size: file.size,
      date_range_start: invoiceRequest.date_range_start,
      date_range_end: invoiceRequest.date_range_end,
      visibility_start: new Date(visibilityStart),
      visibility_end: new Date(visibilityEnd),
      is_active: true,
    })

    // Update invoice request
    invoiceRequest.status = "uploaded"
    invoiceRequest.invoice_id = invoice._id
    await invoiceRequest.save()

    // Notify customer users
    const customerUsers = await CustomerUser.find({
      customer_id: invoiceRequest.customer_id._id,
      is_active: true,
    })

    const customer = await Customer.findById(invoiceRequest.customer_id._id)
    const dateRange = `${new Date(invoiceRequest.date_range_start).toLocaleDateString()} - ${new Date(invoiceRequest.date_range_end).toLocaleDateString()}`
    const visibilityPeriod = `${new Date(visibilityStart).toLocaleDateString()} - ${new Date(visibilityEnd).toLocaleDateString()}`

    for (const customerUser of customerUsers) {
      await Notification.create({
        user_id: customerUser._id,
        user_type: "customer_user",
        event_type: "invoice_uploaded",
        entity_type: "invoice",
        entity_id: invoice._id,
        title: "Invoice Available",
        message: `Invoice for period ${dateRange} is now available for download. Available until ${new Date(visibilityEnd).toLocaleDateString()}.`,
        read: false,
      })

      // Send SMS
      if (customerUser.mobile_number) {
        await sendSMS({
          to: customerUser.mobile_number,
          message: `Your invoice for ${dateRange} is ready for download. Download before ${new Date(visibilityEnd).toLocaleDateString()}.`,
          type: "invoice_uploaded",
          relatedId: invoice._id.toString(),
        })
      }
    }

    await logActivity({
      entityType: "invoice",
      entityId: invoice._id.toString(),
      action: "create",
      performedBy: session.userId,
      performedByType: "user",
      details: `Uploaded invoice ${invoiceNumber} for request ${invoiceRequest.request_number}`,
    })

    return NextResponse.json(
      {
        id: invoice._id.toString(),
        invoice_number: invoice.invoice_number,
        file_url: invoice.file_url,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("[Invoice POST Error]", error)
    return NextResponse.json({ error: "Failed to upload invoice" }, { status: 500 })
  }
}
