const mongoose = require('mongoose');
const CashRequest = require('../models/CashRequest');
const BudgetCode = require('../models/BudgetCode');
const User = require('../models/User');
require('dotenv').config();

async function resetRequest() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const requestId = '691de6461bcb8238e7ee37e1';
    console.log(`🔄 Resetting request: ${requestId}\n`);

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email');

    if (!request) {
      console.error('❌ Request not found');
      process.exit(1);
    }

    console.log(`📄 Request: REQ-${requestId.slice(-6).toUpperCase()}`);
    console.log(`   Employee: ${request.employee.fullName}`);
    console.log(`   Current Status: ${request.status}`);
    console.log(`   Amount: XAF ${request.amountRequested.toLocaleString()}\n`);

    // Check if there are any budget allocations to clean up
    if (request.budgetAllocation && request.budgetAllocation.budgetCodeId) {
      console.log('🧹 Found budget allocation, cleaning up...');
      const budgetCode = await BudgetCode.findById(request.budgetAllocation.budgetCodeId);
      
      if (budgetCode) {
        const allocations = budgetCode.allocations.filter(
          a => a.requisitionId && a.requisitionId.toString() === requestId
        );

        console.log(`   Found ${allocations.length} allocation(s) in budget ${budgetCode.code}`);

        let totalReturned = 0;
        allocations.forEach(alloc => {
          console.log(`   - Allocation status: ${alloc.status}, amount: XAF ${alloc.amount.toLocaleString()}`);
          
          if (alloc.status === 'spent') {
            budgetCode.used -= alloc.amount;
            totalReturned += alloc.amount;
            console.log(`     ✅ Returned XAF ${alloc.amount.toLocaleString()} to budget`);
          }
          
          alloc.status = 'released';
          alloc.releaseDate = new Date();
          alloc.releaseReason = 'Manual reset to fresh pending_finance state';
        });

        if (totalReturned > 0) {
          await budgetCode.save();
          console.log(`   💰 Total returned: XAF ${totalReturned.toLocaleString()}\n`);
        }
      }
    } else {
      console.log('ℹ️  No budget allocation found (already clean)\n');
    }

    // Reset all fields
    console.log('🔄 Resetting request fields...');
    
    request.budgetAllocation = null;
    request.status = 'pending_finance';
    request.financeDecision = null;
    request.financeOfficer = null;
    request.amountApproved = null;
    request.disbursements = [];
    request.totalDisbursed = 0;
    request.remainingBalance = 0;
    request.disbursementDetails = null;

    console.log('   ✅ Cleared: budgetAllocation');
    console.log('   ✅ Cleared: financeDecision');
    console.log('   ✅ Cleared: financeOfficer');
    console.log('   ✅ Cleared: amountApproved');
    console.log('   ✅ Cleared: disbursements');
    console.log('   ✅ Status set to: pending_finance');

    // Reset finance approval chain step
    const financeSteps = request.approvalChain.filter(
      step => step.approver.role === 'Finance Officer'
    );

    console.log(`\n🔗 Resetting ${financeSteps.length} finance approval step(s)...`);
    
    financeSteps.forEach((step, index) => {
      console.log(`   Finance Step ${index + 1} (Level ${step.level}): ${step.approver.name}`);
      console.log(`     Previous status: ${step.status}`);
      console.log(`     Previous comments: "${step.comments}"`);
      
      step.status = 'pending';
      step.comments = '';
      step.actionDate = null;
      step.actionTime = null;
      step.decidedBy = null;
      
      console.log(`     ✅ Reset to: pending\n`);
    });

    // Save changes
    await request.save();
    console.log('💾 Changes saved successfully\n');

    // Verification
    console.log('✅ VERIFICATION:');
    console.log(`   Status: ${request.status}`);
    console.log(`   Budget Allocation: ${request.budgetAllocation || 'null ✅'}`);
    console.log(`   Finance Decision: ${request.financeDecision || 'null ✅'}`);
    console.log(`   Approved Amount: ${request.amountApproved || 'null ✅'}`);
    console.log(`   Disbursements: ${request.disbursements?.length || 0} ✅`);
    
    const financeStepStatus = request.approvalChain
      .filter(s => s.approver.role === 'Finance Officer')
      .map(s => s.status)
      .join(', ');
    console.log(`   Finance Steps Status: ${financeStepStatus} ✅\n`);

    console.log('🎉 Request is now in fresh pending_finance state!');
    console.log('   Finance can approve/reject as if it was never processed.\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

resetRequest();