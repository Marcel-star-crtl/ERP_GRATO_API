/**
 * Script to delete a Purchase Order by PO number
 * Run: node scripts/deletePOByNumber.js <PO_NUMBER>
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PurchaseOrder = require('../models/PurchaseOrder');

async function deletePurchaseOrder() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get PO number from command line argument
    const poNumber = process.argv[2];

    if (!poNumber) {
      console.log('Usage: node scripts/deletePOByNumber.js <PO_NUMBER>');
      console.log('Example: node scripts/deletePOByNumber.js PO-2026-000050');
      await mongoose.disconnect();
      return;
    }

    console.log(`🔍 Searching for Purchase Orders with number: ${poNumber}\n`);

    // Find POs to delete
    const purchaseOrders = await PurchaseOrder.find({ poNumber });

    if (purchaseOrders.length === 0) {
      console.log(`ℹ️  No Purchase Orders found with number: ${poNumber}`);
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${purchaseOrders.length} Purchase Order(s):\n`);
    purchaseOrders.forEach((po, idx) => {
      console.log(`  ${idx + 1}. ID:              ${po._id}`);
      console.log(`     PO#:             ${po.poNumber}`);
      console.log(`     Supplier:        ${po.supplierName}`);
      console.log(`     Total Amount:    ${po.currency} ${po.totalAmount}`);
      console.log(`     Status:          ${po.status}`);
      console.log(`     Stage:           ${po.currentStage}`);
      console.log(`     Created By:      ${po.createdBy}`);
      console.log(`     Created:         ${po.creationDate}`);
      console.log();
    });

    // Delete the purchase orders
    const result = await PurchaseOrder.deleteMany({ poNumber });

    console.log(`✅ Deleted ${result.deletedCount} Purchase Order(s)\n`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run deletion
deletePurchaseOrder();