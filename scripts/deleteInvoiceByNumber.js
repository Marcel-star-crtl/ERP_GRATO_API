/**
 * Script to delete invoices by invoice number
 * Run: node scripts/deleteInvoiceByNumber.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Invoice = require('../models/Invoice');

async function deleteInvoices() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get invoice number from command line argument
    const invoiceNumber = process.argv[2];
    
    if (!invoiceNumber) {
      console.log('Usage: node scripts/deleteInvoiceByNumber.js <INVOICE_NUMBER>');
      console.log('Example: node scripts/deleteInvoiceByNumber.js GRAE-INV-IHS-2026-001');
      await mongoose.disconnect();
      return;
    }

    console.log(`🔍 Searching for invoices with number: ${invoiceNumber}\n`);

    // Find invoices to delete
    const invoices = await Invoice.find({ invoiceNumber });

    if (invoices.length === 0) {
      console.log(`ℹ️  No invoices found with number: ${invoiceNumber}`);
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${invoices.length} invoice(s):\n`);
    invoices.forEach((inv, idx) => {
      console.log(`  ${idx + 1}. ID: ${inv._id}`);
      console.log(`     Invoice#: ${inv.invoiceNumber}`);
      console.log(`     PO#: ${inv.poNumber}`);
      console.log(`     Amount: ${inv.totalAmount}`);
      console.log(`     Status: ${inv.status}`);
      console.log(`     Created: ${inv.createdAt}`);
      console.log();
    });

    // Delete the invoices
    const result = await Invoice.deleteMany({ invoiceNumber });

    console.log(`✅ Deleted ${result.deletedCount} invoice(s)\n`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run deletion
deleteInvoices();
