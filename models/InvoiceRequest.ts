import mongoose, { Schema, Document, Model } from "mongoose"

export interface IInvoiceRequest extends Document {
  _id: mongoose.Types.ObjectId
  request_number: string
  customer_id: mongoose.Types.ObjectId
  requested_by: mongoose.Types.ObjectId // CustomerUser who created the request
  date_range_start: Date
  date_range_end: Date
  description?: string
  status: "pending_approval" | "approved" | "rejected" | "uploaded" | "expired"
  approved_by?: mongoose.Types.ObjectId // CustomerUser admin who approved
  approved_at?: Date
  rejected_reason?: string
  invoice_id?: mongoose.Types.ObjectId // Reference to uploaded invoice
  created_at: Date
  updated_at: Date
}

const InvoiceRequestSchema = new Schema<IInvoiceRequest>(
  {
    request_number: {
      type: String,
      required: true,
      unique: true,
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    requested_by: {
      type: Schema.Types.ObjectId,
      ref: "CustomerUser",
      required: true,
    },
    date_range_start: {
      type: Date,
      required: true,
    },
    date_range_end: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending_approval", "approved", "rejected", "uploaded", "expired"],
      default: "pending_approval",
    },
    approved_by: {
      type: Schema.Types.ObjectId,
      ref: "CustomerUser",
    },
    approved_at: {
      type: Date,
    },
    rejected_reason: {
      type: String,
      trim: true,
    },
    invoice_id: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
)

InvoiceRequestSchema.index({ customer_id: 1 })
InvoiceRequestSchema.index({ requested_by: 1 })
InvoiceRequestSchema.index({ status: 1 })
InvoiceRequestSchema.index({ created_at: -1 })

const InvoiceRequest: Model<IInvoiceRequest> =
  mongoose.models.InvoiceRequest || mongoose.model<IInvoiceRequest>("InvoiceRequest", InvoiceRequestSchema)

export default InvoiceRequest
