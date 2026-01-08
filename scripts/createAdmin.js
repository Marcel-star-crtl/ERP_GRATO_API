require('dotenv').config();
const mongoose = require('mongoose');
const SupplierInvoice = require('../models/SupplierInvoice');

async function removeAllSupplierInvoices() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Count existing invoices
    const count = await SupplierInvoice.countDocuments();
    console.log(`\nFound ${count} supplier invoice(s) in the system`);

    if (count === 0) {
      console.log('No supplier invoices to remove.');
      return;
    }

    // Ask for confirmation (in production, you might want to add actual user input)
    console.log('\n⚠️  WARNING: This will delete ALL supplier invoices!');
    console.log('This action cannot be undone.\n');

    // Delete all supplier invoices
    const result = await SupplierInvoice.deleteMany({});
    
    console.log(`\n✅ Successfully removed ${result.deletedCount} supplier invoice(s)`);
    console.log('\nCleanup Summary:');
    console.log('---------------------');
    console.log(`Total Deleted: ${result.deletedCount}`);
    console.log('Status: All supplier invoices removed from the system');
    console.log('---------------------');

  } catch (error) {
    console.error('\n❌ Error removing supplier invoices:', error);
    console.error('Error details:', error.message);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

// Run the cleanup script
removeAllSupplierInvoices();

