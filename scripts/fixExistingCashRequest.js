const mongoose = require('mongoose');
require('dotenv').config();

const fixExistingRequest = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const CashRequest = mongoose.model('CashRequest', require('../models/CashRequest').schema);

    // Find the problematic request
    const requestId = '68e87029f99b359514a0295d';
    const request = await CashRequest.findById(requestId);

    if (!request) {
      console.log('❌ Request not found');
      process.exit(1);
    }

    console.log('📄 Found Request:', requestId);
    console.log('   Current Status:', request.status);
    console.log('   Approval Chain:');
    
    request.approvalChain.forEach((step, index) => {
      console.log(`   Level ${step.level}: ${step.approver.name} (${step.approver.role}) - ${step.status}`);
    });

    // Check if Finance (Level 3) is still pending
    const financeStep = request.approvalChain.find(s => 
      s.approver.email === 'ranibellmambo@gratoengineering.com'
    );

    if (!financeStep) {
      console.log('\n❌ No Finance step found in approval chain');
      process.exit(1);
    }

    console.log(`\n📋 Finance Step Status: ${financeStep.status}`);

    if (financeStep.status === 'pending') {
      console.log('\n🔧 Fixing request status...');
      
      // Change status from 'approved' to 'pending_finance'
      request.status = 'pending_finance';
      
      await request.save();
      
      console.log('✅ Request status changed to: pending_finance');
      console.log('\n📝 Summary:');
      console.log('   - Request will now appear in Finance "Pending Approval" tab');
      console.log('   - Finance can now approve/reject the request');
      console.log('   - After Finance approves, it will move to "Ready to Disburse"');
      
    } else if (financeStep.status === 'approved') {
      console.log('\n✅ Finance has already approved this request');
      console.log('   Status should be "approved" for disbursement');
      if (request.status !== 'approved') {
        request.status = 'approved';
        await request.save();
        console.log('   ✓ Status corrected to "approved"');
      }
      
    } else {
      console.log(`\n⚠️  Finance step status is: ${financeStep.status}`);
      console.log('   No changes needed');
    }

    console.log('\n✅ Fix complete\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  fixExistingRequest();
}

module.exports = fixExistingRequest;