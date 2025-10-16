const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config();

const resetRequest = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGODB_URI not found');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected\n');

    const cashRequestSchema = require('../models/CashRequest').schema;
    const CashRequest = mongoose.models.CashRequest || mongoose.model('CashRequest', cashRequestSchema);

    const requestId = '68e87029f99b359514a0295d';
    
    console.log('🔍 Finding request:', requestId);
    const request = await CashRequest.findById(requestId);

    if (!request) {
      console.log('❌ Request not found');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log('✅ Found request');
    console.log('   Current status:', request.status);
    console.log('\n📋 Current Approval Chain:');
    
    request.approvalChain.forEach((step, index) => {
      const icon = step.status === 'approved' ? '✅' : 
                   step.status === 'pending' ? '⏳' : 
                   step.status === 'rejected' ? '❌' : '❓';
      console.log(`   ${icon} Level ${step.level}: ${step.approver.name} (${step.approver.role}) - ${step.status}`);
    });

    // Find Finance step
    const financeStepIndex = request.approvalChain.findIndex(s => 
      s.approver.email === 'ranibellmambo@gratoengineering.com'
    );

    if (financeStepIndex === -1) {
      console.log('\n❌ No Finance step found');
      await mongoose.connection.close();
      process.exit(1);
    }

    const financeStep = request.approvalChain[financeStepIndex];
    console.log(`\n📊 Finance Step:`);
    console.log(`   Level: ${financeStep.level}`);
    console.log(`   Status: ${financeStep.status}`);

    if (financeStep.status === 'rejected') {
      console.log('\n🔧 RESETTING rejected finance approval...');
      
      // Reset finance step to pending
      request.approvalChain[financeStepIndex].status = 'pending';
      request.approvalChain[financeStepIndex].comments = undefined;
      request.approvalChain[financeStepIndex].actionDate = undefined;
      request.approvalChain[financeStepIndex].actionTime = undefined;
      request.approvalChain[financeStepIndex].decidedBy = undefined;

      // Reset request status to pending_finance
      request.status = 'pending_finance';

      // Clear any finance decision
      request.financeDecision = undefined;

      await request.save();

      console.log('✅ Request reset successfully!');
      console.log('\n📝 Changes made:');
      console.log('   ✓ Finance step status: rejected → pending');
      console.log('   ✓ Request status: denied → pending_finance');
      console.log('   ✓ Finance decision cleared');
      console.log('   ✓ Action date/time cleared');
      console.log('\n📋 Updated Approval Chain:');
      
      request.approvalChain.forEach((step, index) => {
        const icon = step.status === 'approved' ? '✅' : 
                     step.status === 'pending' ? '⏳' : 
                     step.status === 'rejected' ? '❌' : '❓';
        console.log(`   ${icon} Level ${step.level}: ${step.approver.name} (${step.approver.role}) - ${step.status}`);
      });

      console.log('\n✅ Request is now ready for Finance approval again!');
      console.log('   Finance can now approve/disburse this request in the dashboard.');

    } else {
      console.log(`\n✅ Finance step is already ${financeStep.status}`);
      console.log('   No reset needed');
    }

    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  resetRequest();
}

module.exports = resetRequest;