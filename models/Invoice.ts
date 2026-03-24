import mongoose, { Schema, Document, Model } from "mongoose"

export interface IInvoice extends Document {
  _id: mongoose.Types.ObjectId
  invoice_number: string
  invoice_request_id: mongoose.Types.ObjectId
  customer_id: mongoose.Types.ObjectId
  uploaded_by: mongoose.Types.ObjectId // Accountant who uploaded
  file_url: string // Blob URL
  file_name: string
  file_size: number
  date_range_start: Date
  date_range_end: Date
  visibility_start: Date
  visibility_end: Date
  is_active: boolean
  is_deleted: boolean
  deleted_at?: Date
  download_count: number
  created_at: Date
  updated_at: Date
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoice_number: {
      type: String,
      required: true,
      unique: true,
    },
    invoice_request_id: {
      type: Schema.Types.ObjectId,
      ref: "InvoiceRequest",
      required: true,
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    uploaded_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    file_url: {
      type: String,
      required: true,
    },
    file_name: {
      type: String,
      required: true,
    },
    file_size: {
      type: Number,
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
    visibility_start: {
      type: Date,
      required: true,
    },
    visibility_end: {
      type: Date,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    deleted_at: {
      type: Date,
    },
    download_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
)

InvoiceSchema.index({ customer_id: 1 })
InvoiceSchema.index({ invoice_request_id: 1 })
InvoiceSchema.index({ visibility_end: 1 })
InvoiceSchema.index({ is_active: 1 })
InvoiceSchema.index({ is_deleted: 1 })

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema)

export default Invoice
