import connectDB from "@/lib/mongodb"
import SMSLog from "@/models/SMSLog"

interface SendSMSParams {
  to: string
  message: string
  type: "ticket_created" | "ticket_approved" | "ticket_rejected" | "user_created" | "invoice_uploaded" | "invoice_approved" | "general"
  relatedId?: string
}

interface SMSResponse {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendSMS({ to, message, type, relatedId }: SendSMSParams): Promise<SMSResponse> {
  await connectDB()
  
  const apiKey = process.env.FAST2SMS_API_KEY

  // Clean phone number - remove spaces, dashes, and country code if present
  const cleanPhone = to.replace(/[\s-]/g, "").replace(/^\+91/, "")

  // Create SMS log entry
  const smsLog = await SMSLog.create({
    phone_number: cleanPhone,
    message,
    sms_type: type,
    related_id: relatedId || null,
    status: "pending",
  })

  // If no API key, log and return mock success
  if (!apiKey) {
    console.log(`[SMS Mock] To: ${cleanPhone}, Message: ${message}`)
    await SMSLog.findByIdAndUpdate(smsLog._id, { status: "mock_sent" })
    return { success: true, messageId: `mock-${smsLog._id}` }
  }

  try {
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        route: "q", // Quick SMS route
        message,
        language: "english",
        flash: 0,
        numbers: cleanPhone,
      }),
    })

    const data = await response.json()

    if (data.return === true) {
      await SMSLog.findByIdAndUpdate(smsLog._id, {
        status: "sent",
        provider_response: data,
        sent_at: new Date(),
      })
      return { success: true, messageId: data.request_id }
    } else {
      await SMSLog.findByIdAndUpdate(smsLog._id, {
        status: "failed",
        provider_response: data,
      })
      return { success: false, error: data.message || "Failed to send SMS" }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    await SMSLog.findByIdAndUpdate(smsLog._id, {
      status: "failed",
      provider_response: { error: errorMessage },
    })
    console.error("[SMS Error]", error)
    return { success: false, error: errorMessage }
  }
}

export function formatTicketCreatedSMS(ticketId: string, productName: string, customerName: string): string {
  return `New ticket #${ticketId} created for ${productName} by ${customerName}. Please review and approve.`
}

export function formatTicketApprovedSMS(ticketId: string, productName: string): string {
  return `Ticket #${ticketId} for ${productName} has been approved and is now assigned to the support team.`
}

export function formatTicketApprovedForAgentSMS(
  ticketNumber: string, 
  productId: string, 
  ticketTitle: string, 
  customerName: string
): string {
  return `New Ticket Alert!\nTicket: ${ticketNumber}\nProduct: ${productId}\nTitle: ${ticketTitle}\nCustomer: ${customerName}\nPlease respond within 2 hours.`
}

export function formatTicketClosedByCustomerSMS(ticketNumber: string, customerName: string): string {
  return `Ticket ${ticketNumber} has been closed by ${customerName}. No further action required.`
}

export function formatWaitingForResponseSMS(ticketNumber: string, agentName: string): string {
  return `Ticket ${ticketNumber}: ${agentName} has replied and is waiting for your response. You can now close this ticket if resolved.`
}

// WhatsApp message sender (using WhatsApp Business API or similar)
export async function sendWhatsApp({ to, message, type, relatedId }: SendSMSParams): Promise<SMSResponse> {
  await connectDB()

  const apiKey = process.env.WHATSAPP_API_KEY
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  // Clean phone number
  const cleanPhone = to.replace(/[\s-]/g, "").replace(/^\+91/, "")
  const fullPhone = `91${cleanPhone}`

  // Create log entry
  const smsLog = await SMSLog.create({
    phone_number: cleanPhone,
    message,
    sms_type: type,
    related_id: relatedId || null,
    status: "pending",
  })

  // If no API key, log and return mock success
  if (!apiKey || !phoneNumberId) {
    console.log(`[WhatsApp Mock] To: ${fullPhone}, Message: ${message}`)
    await SMSLog.findByIdAndUpdate(smsLog._id, { status: "mock_sent" })
    return { success: true, messageId: `whatsapp-mock-${smsLog._id}` }
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: fullPhone,
          type: "text",
          text: { body: message },
        }),
      }
    )

    const data = await response.json()

    if (data.messages && data.messages[0]?.id) {
      await SMSLog.findByIdAndUpdate(smsLog._id, {
        status: "sent",
        provider_response: data,
        sent_at: new Date(),
      })
      return { success: true, messageId: data.messages[0].id }
    } else {
      await SMSLog.findByIdAndUpdate(smsLog._id, {
        status: "failed",
        provider_response: data,
      })
      return { success: false, error: data.error?.message || "Failed to send WhatsApp" }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    await SMSLog.findByIdAndUpdate(smsLog._id, {
      status: "failed",
      provider_response: { error: errorMessage },
    })
    console.error("[WhatsApp Error]", error)
    return { success: false, error: errorMessage }
  }
}

export function formatTicketRejectedSMS(ticketId: string, reason: string): string {
  return `Ticket #${ticketId} has been rejected. Reason: ${reason}`
}

export function formatNewUserSMS(userName: string, tempPassword: string): string {
  return `Welcome ${userName}! Your account has been created. Temp password: ${tempPassword}. Please change it on first login.`
}

// Invoice SMS formatters
export function formatInvoiceRequestApprovedSMS(
  requestNumber: string,
  customerName: string,
  dateFrom: string,
  dateTo: string
): string {
  return `Invoice Request Alert!\nRequest: ${requestNumber}\nCustomer: ${customerName}\nPeriod: ${dateFrom} - ${dateTo}\nPlease prepare and upload the invoice.`
}

export function formatInvoiceUploadedSMS(requestNumber: string, availableUntil: string): string {
  return `Your invoice (${requestNumber}) is ready for download. Available until ${availableUntil}. Login to download.`
}
