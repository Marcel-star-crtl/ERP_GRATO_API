const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');

const fixPurchaseOrderTax = async () => {
  try {
    console.log('🔧 Starting tax calculation fix for purchase orders...\n');

    // Find all purchase orders with tax applicable
    const orders = await PurchaseOrder.find({
      taxApplicable: true,
      taxRate: { $exists: true, $gt: 0 }
    });

    console.log(`Found ${orders.length} purchase orders with tax applicable\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        console.log(`\n📄 Processing PO ${order.poNumber}`);
        console.log(`   Order ID: ${order._id}`);
        console.log(`   Current Total: ${order.totalAmount?.toLocaleString() || 0} ${order.currency}`);
        console.log(`   Tax Rate: ${order.taxRate}%`);

        // Calculate subtotal from items
        const subtotal = order.items.reduce((sum, item) => {
          // Recalculate item total in case it's wrong
          const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
          return sum + itemTotal;
        }, 0);

        console.log(`   Items Subtotal: ${subtotal.toLocaleString()} ${order.currency}`);

        // Calculate tax amount
        const taxAmount = subtotal * (order.taxRate / 100);
        console.log(`   Tax Amount: ${taxAmount.toLocaleString()} ${order.currency}`);

        // Calculate correct total with tax
        const correctTotal = subtotal + taxAmount;
        console.log(`   Correct Total (with tax): ${correctTotal.toLocaleString()} ${order.currency}`);

        // Check if fix is needed
        const difference = Math.abs((order.totalAmount || 0) - correctTotal);
        if (difference < 1) { // Allow for minor rounding differences
          console.log('   ✓ Total is already correct - skipping');
          skipped++;
          continue;
        }

        console.log(`   ⚠️  Difference: ${difference.toLocaleString()} ${order.currency}`);

        // Update all tax-related fields
        const oldTotal = order.totalAmount;
        order.subtotalAmount = subtotal;
        order.taxAmount = taxAmount;
        order.totalAmount = correctTotal;

        // Ensure each item has correct totalPrice
        order.items.forEach(item => {
          item.totalPrice = (item.quantity || 0) * (item.unitPrice || 0);
        });

        // Add activity log for the fix
        order.activities.push({
          type: 'updated',
          description: `Tax calculation corrected: ${oldTotal?.toLocaleString() || 0} → ${correctTotal.toLocaleString()} ${order.currency} (Subtotal: ${subtotal.toLocaleString()}, Tax ${order.taxRate}%: ${taxAmount.toLocaleString()})`,
          timestamp: new Date(),
          user: 'System (Tax Fix Script)'
        });

        // Update lastModifiedDate
        order.lastModifiedDate = new Date();

        // Save with validation disabled to bypass the pre-save hook
        await order.save({ validateBeforeSave: true });

        console.log('   ✅ Fixed successfully');
        console.log(`   Old Total: ${oldTotal?.toLocaleString() || 0} ${order.currency}`);
        console.log(`   New Subtotal: ${subtotal.toLocaleString()} ${order.currency}`);
        console.log(`   New Tax: ${taxAmount.toLocaleString()} ${order.currency}`);
        console.log(`   New Total: ${correctTotal.toLocaleString()} ${order.currency}`);
        fixed++;

      } catch (error) {
        console.error(`   ❌ Error fixing order ${order.poNumber}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('TAX FIX SUMMARY:');
    console.log(`✅ Fixed: ${fixed}`);
    console.log(`⊘ Skipped (already correct): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(60));

    return { fixed, skipped, errors };

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  }
};

// Function to fix a specific purchase order by ID
const fixSpecificPurchaseOrder = async (poId) => {
  try {
    console.log(`🔧 Fixing specific purchase order: ${poId}\n`);

    const order = await PurchaseOrder.findById(poId);

    if (!order) {
      console.error(`❌ Purchase order not found: ${poId}`);
      return { success: false, message: 'Purchase order not found' };
    }

    console.log(`📄 Processing PO ${order.poNumber}`);
    console.log(`   Current Total: ${order.totalAmount?.toLocaleString() || 0} ${order.currency}`);
    console.log(`   Tax Rate: ${order.taxRate}%`);

    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => {
      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + itemTotal;
    }, 0);

    console.log(`   Items Subtotal: ${subtotal.toLocaleString()} ${order.currency}`);

    // Calculate tax amount
    const taxAmount = subtotal * (order.taxRate / 100);
    console.log(`   Tax Amount: ${taxAmount.toLocaleString()} ${order.currency}`);

    // Calculate correct total with tax
    const correctTotal = subtotal + taxAmount;
    console.log(`   Correct Total (with tax): ${correctTotal.toLocaleString()} ${order.currency}`);

    // Update all fields
    const oldTotal = order.totalAmount;
    order.subtotalAmount = subtotal;
    order.taxAmount = taxAmount;
    order.totalAmount = correctTotal;

    // Fix item totals
    order.items.forEach(item => {
      item.totalPrice = (item.quantity || 0) * (item.unitPrice || 0);
    });

    // Add activity log
    order.activities.push({
      type: 'updated',
      description: `Tax calculation corrected: ${oldTotal?.toLocaleString() || 0} → ${correctTotal.toLocaleString()} ${order.currency} (Subtotal: ${subtotal.toLocaleString()}, Tax ${order.taxRate}%: ${taxAmount.toLocaleString()})`,
      timestamp: new Date(),
      user: 'System (Tax Fix Script)'
    });

    order.lastModifiedDate = new Date();
    await order.save();

    console.log('\n✅ Fixed successfully');
    console.log(`Old Total: ${oldTotal?.toLocaleString() || 0} ${order.currency}`);
    console.log(`New Subtotal: ${subtotal.toLocaleString()} ${order.currency}`);
    console.log(`New Tax: ${taxAmount.toLocaleString()} ${order.currency}`);
    console.log(`New Total: ${correctTotal.toLocaleString()} ${order.currency}`);

    return { 
      success: true, 
      data: {
        oldTotal,
        subtotal,
        taxAmount,
        newTotal: correctTotal
      }
    };

  } catch (error) {
    console.error('Error:', error);
    return { success: false, message: error.message };
  }
};

// Run if executed directly
if (require.main === module) {
  const specificId = process.argv[2];

  mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://marcelngong50:dp1d6ABP6ggkvQli@cluster0.9nhviyl.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('✅ Connected to MongoDB\n');
    
    if (specificId) {
      return fixSpecificPurchaseOrder(specificId);
    } else {
      return fixPurchaseOrderTax();
    }
  })
  .then((result) => {
    console.log('\n✅ Fix completed');
    if (result && !result.success) {
      console.log('Result:', result);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { fixPurchaseOrderTax, fixSpecificPurchaseOrder };
