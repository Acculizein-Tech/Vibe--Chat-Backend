import PDFDocument from "pdfkit";
import fs from "fs";

export const generateInvoicePDF = (payment, filePath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(22).text("Payment Invoice", { align: "center" });
    doc.moveDown();

    doc.fontSize(14).text(`Name: ${payment.billingDetails.name}`);
    doc.text(`Email: ${payment.billingDetails.email}`);
    doc.text(`Contact: ${payment.billingDetails.contact}`);
    doc.text(`State: ${payment.billingDetails.state}`);
    doc.text(`Address: ${payment.billingDetails.address}`);
    doc.moveDown();

    doc.text(`Order ID: ${payment.orderId}`);
    doc.text(`Payment ID: ${payment.paymentId}`);
    doc.text(`Date: ${new Date(payment.createdAt).toLocaleString()}`);
    doc.moveDown();

    doc.text(`Base Amount: ₹${payment.baseAmount}`);
    if (payment.isUP) {
      doc.text(`CGST: ₹${payment.tax.cgst}`);
      doc.text(`SGST: ₹${payment.tax.sgst}`);
    } else {
      doc.text(`IGST: ₹${payment.tax.igst}`);
    }
    doc.text(`Total Amount: ₹${payment.amount}`);
    doc.moveDown();

    doc.text("Thank you for your business!", { align: "center" });

    doc.end();

    stream.on("finish", () => resolve());
    stream.on("error", (err) => reject(err));
  });
};
