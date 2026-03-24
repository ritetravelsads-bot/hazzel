import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Invoice from "@/models/Invoice"
import InvoiceRequest from "@/models/InvoiceRequest"
import { del } from "@vercel/blob"

// This endpoint should be called by a cron job to clean up expired invoices
// Set up a Vercel Cron Job to call this endpoint daily
// vercel.json: { "crons": [{ "path": "/api/cron/cleanup-invoices", "schedule": "0 0 * * *" }] }

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // Allow in development or with valid cron secret
  if (process.env.NODE_ENV === "production" && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await connectDB()

    const now = new Date()

    // Find all expired invoices
    const expiredInvoices = await Invoice.find({
      available_until: { $lt: now },
      is_deleted: false,
    })

    let deletedCount = 0
    let errorCount = 0

    for (const invoice of expiredInvoices) {
      try {
        // Delete file from blob storage
        if (invoice.file_url) {
          try {
            await del(invoice.file_url)
          } catch (blobError) {
            console.error(`Failed to delete blob for invoice ${invoice._id}:`, blobError)
            // Continue even if blob deletion fails
          }
        }

        // Mark invoice as deleted
        await Invoice.findByIdAndUpdate(invoice._id, {
          is_deleted: true,
          deleted_at: now,
          file_url: null, // Clear the URL
        })

        // Update request status to expired
        await InvoiceRequest.findByIdAndUpdate(invoice.request_id, {
          status: "expired",
        })

        deletedCount++
      } catch (error) {
        console.error(`Error processing invoice ${invoice._id}:`, error)
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed. Deleted: ${deletedCount}, Errors: ${errorCount}`,
      deleted: deletedCount,
      errors: errorCount,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error("Cron cleanup error:", error)
    return NextResponse.json(
      { error: "Cleanup failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
