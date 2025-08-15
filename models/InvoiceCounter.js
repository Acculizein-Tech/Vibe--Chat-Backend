// models/InvoiceCounter.js
import mongoose from "mongoose";

const invoiceCounterSchema = new mongoose.Schema({
  financialYear: { type: String, required: true }, // e.g., "25-26"
  sequence: { type: Number, default: 0 }           // e.g., 1, 2, 3...
});

export default mongoose.model("InvoiceCounter", invoiceCounterSchema);
