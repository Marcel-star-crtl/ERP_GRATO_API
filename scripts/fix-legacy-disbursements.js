const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI);

// Load models
const CashRequest = require('../models/CashRequest');
const User = require('../models/User');

async function verifyRequestData() {
  try {
    console.log('🔍 Verifying REQ-EE300B data...\n');

    // Find the specific request
    const request = await CashRequest.findOne({ 
      _id: '691dcdcd1bcb8238e7ee300b' 
    }).populate('employee', 'fullName email');

    if (!request) {
      console.log('❌ Request not found!');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log('📊 Request Details:');
    console.log('='.repeat(60));
    console.log(`ID: ${request._id}`);
    console.log(`Display ID: REQ-${request._id.toString().slice(-6).toUpperCase()}`);
    console.log(`Employee: ${request.employee?.fullName || 'Unknown'}`);
    console.log(`Status: ${request.status}`);
    console.log('');
    console.log('💰 Amounts:');
    console.log(`   amountRequested: XAF ${request.amountRequested?.toLocaleString() || 0}`);
    console.log(`   amountApproved: XAF ${request.amountApproved?.toLocaleString() || 0}`);
    console.log(`   totalDisbursed: XAF ${request.totalDisbursed?.toLocaleString() || 0}`);
    console.log(`   remainingBalance: XAF ${request.remainingBalance?.toLocaleString() || 0}`);
    console.log('');
    console.log('📋 Disbursements Array:');
    if (request.disbursements && request.disbursements.length > 0) {
      request.disbursements.forEach((d, idx) => {
        console.log(`   [${idx + 1}] Amount: XAF ${d.amount?.toLocaleString()}`);
        console.log(`       Date: ${d.date}`);
        console.log(`       Notes: ${d.notes || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️  Empty array');
    }
    console.log('');
    console.log('📋 Old disbursementDetails:');
    if (request.disbursementDetails) {
      console.log(`   Amount: XAF ${request.disbursementDetails.amount?.toLocaleString() || 0}`);
      console.log(`   Date: ${request.disbursementDetails.date}`);
    } else {
      console.log('   N/A');
    }
    console.log('');
    console.log('🎯 Expected Display:');
    console.log(`   Progress: ${request.totalDisbursed?.toLocaleString() || 0} / ${request.amountRequested?.toLocaleString() || 0}`);
    console.log(`   Percentage: ${request.amountRequested ? ((request.totalDisbursed / request.amountRequested) * 100).toFixed(0) : 0}%`);
    console.log('='.repeat(60));

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run verification
verifyRequestData();