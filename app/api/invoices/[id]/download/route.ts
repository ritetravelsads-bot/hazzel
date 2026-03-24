import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import connectDB from "@/lib/mongodb"
import Invoice from "@/models/Invoice"

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

// GET - Download invoice (track download count)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const { id } = await params

    const invoice = await Invoice.findById(id)
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // For customers, verify ownership and visibility
    if (session.type === "customer") {
      if (invoice.customer_id.toString() !== session.customerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }

      const now = new Date()
      if (!invoice.is_active || now < invoice.visibility_start || now > invoice.visibility_end) {
        return NextResponse.json({ error: "Invoice is not available for download" }, { status: 403 })
      }
    }

    // Increment download count
    await Invoice.findByIdAndUpdate(id, { $inc: { download_count: 1 } })

    return NextResponse.json({
      file_url: invoice.file_url,
      file_name: invoice.file_name,
    })
  } catch (error) {
    console.error("[Invoice Download Error]", error)
    return NextResponse.json({ error: "Failed to download invoice" }, { status: 500 })
  }
}
