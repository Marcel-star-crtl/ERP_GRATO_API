const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI);

// Load models
const CashRequest = require('../models/CashRequest');
const User = require('../models/User'); // Add this line to register the User model

async function fixLegacyDisbursements() {
  try {
    console.log('🔍 Starting legacy disbursement fix...\n');

    // Find all requests with old disbursement structure OR incorrect calculations
    const legacyRequests = await CashRequest.find({
      $and: [
        { disbursementDetails: { $exists: true } },
        {
          $or: [
            // Old structure: disbursed status with empty disbursements array
            {
              status: 'disbursed',
              $or: [
                { disbursements: { $exists: false } },
                { disbursements: { $size: 0 } }
              ]
            },
            // Incorrectly marked as fully_disbursed when it should be partial
            {
              status: 'fully_disbursed',
              $expr: { $gt: ['$amountRequested', '$totalDisbursed'] }
            },
            // Has disbursementDetails but totalDisbursed is 0
            {
              totalDisbursed: 0,
              'disbursementDetails.amount': { $gt: 0 }
            }
          ]
        }
      ]
    }).populate('employee', 'fullName email');

    console.log(`📊 Found ${legacyRequests.length} legacy request(s) to fix\n`);

    if (legacyRequests.length === 0) {
      console.log('✅ No legacy requests found. All good!');
      await mongoose.connection.close();
      process.exit(0);
    }

    let fixedCount = 0;

    for (const request of legacyRequests) {
      console.log(`\n📝 Processing: REQ-${request._id.toString().slice(-6).toUpperCase()}`);
      console.log(`   Employee: ${request.employee?.fullName || 'Unknown'}`);
      console.log(`   Requested: XAF ${request.amountRequested.toLocaleString()}`);
      console.log(`   Approved: XAF ${(request.amountApproved || request.amountRequested).toLocaleString()}`);

      const amountRequested = request.amountRequested;
      const disbursedAmount = request.disbursementDetails?.amount || 0;

      console.log(`   Old disbursementDetails.amount: XAF ${disbursedAmount.toLocaleString()}`);

      if (disbursedAmount === 0) {
        console.log('   ⚠️  No disbursement found, skipping...');
        continue;
      }

      // Create proper disbursements array
      request.disbursements = [{
        amount: disbursedAmount,
        date: request.disbursementDetails.date || new Date(),
        disbursedBy: request.disbursementDetails.disbursedBy || request.financeOfficer,
        notes: 'Migrated from legacy disbursementDetails',
        disbursementNumber: 1
      }];

      // Update totals (remainingBalance = amountRequested - totalDisbursed)
      request.totalDisbursed = disbursedAmount;
      request.remainingBalance = amountRequested - disbursedAmount;

      // Determine correct status based on remaining balance
      const isFullyDisbursed = request.remainingBalance === 0;
      const newStatus = isFullyDisbursed ? 'fully_disbursed' : 'partially_disbursed';

      console.log(`   ✅ New totalDisbursed: XAF ${request.totalDisbursed.toLocaleString()}`);
      console.log(`   ✅ New remainingBalance: XAF ${request.remainingBalance.toLocaleString()}`);
      console.log(`   ✅ New status: ${newStatus} (was: ${request.status})`);

      request.status = newStatus;

      // Save changes
      await request.save();
      fixedCount++;

      console.log('   💾 Saved successfully!');
    }

    console.log(`\n✅ Migration complete! Fixed ${fixedCount} request(s).`);
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
fixLegacyDisbursements();