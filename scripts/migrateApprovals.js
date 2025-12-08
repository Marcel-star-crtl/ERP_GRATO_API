require('dotenv').config();
const mongoose = require('mongoose');
const CashRequest = require('../models/CashRequest');

async function migrateLegacyApprovals() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your_db_name', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to database');
    console.log('\n=== LEGACY APPROVAL MIGRATION ===\n');

    // Find legacy requests
    const legacyRequests = await CashRequest.find({
      status: 'approved',
      amountApproved: { $exists: true },
      $or: [
        { disbursements: { $exists: false } },
        { disbursements: { $size: 0 } },
        { totalDisbursed: { $exists: false } },
        { remainingBalance: { $exists: false } }
      ]
    });

    console.log(`📋 Found ${legacyRequests.length} legacy request(s) to migrate\n`);

    if (legacyRequests.length === 0) {
      console.log('✅ No legacy requests found. All data is up to date!');
      await mongoose.connection.close();
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const request of legacyRequests) {
      try {
        const requestId = `REQ-${request._id.toString().slice(-6).toUpperCase()}`;
        
        console.log(`Processing ${requestId}...`);
        console.log(`  Requested: XAF ${request.amountRequested.toLocaleString()}`);
        console.log(`  Approved: XAF ${request.amountApproved.toLocaleString()}`);

        // Initialize disbursement tracking
        request.remainingBalance = request.amountApproved;
        request.totalDisbursed = 0;
        
        if (!request.disbursements) {
          request.disbursements = [];
        }

        // Status stays 'approved' (Finance can now disburse)
        await request.save();

        console.log(`  ✅ Migrated successfully`);
        console.log(`  Remaining Balance: XAF ${request.remainingBalance.toLocaleString()}\n`);
        
        successCount++;

      } catch (error) {
        console.error(`  ❌ Failed to migrate REQ-${request._id.toString().slice(-6).toUpperCase()}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n=== MIGRATION COMPLETE ===');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total processed: ${legacyRequests.length}\n`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateLegacyApprovals();