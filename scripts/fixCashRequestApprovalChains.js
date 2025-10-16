const mongoose = require('mongoose');
const CashRequest = require('../models/CashRequest');
const { getCashRequestApprovalChain } = require('../config/cashRequestApprovalChain');

const fixCashRequestApprovalChains = async () => {
  try {
    console.log('🔧 Starting approval chain fix for existing cash requests...\n');

    // Find all cash requests that need fixing
    const requests = await CashRequest.find({
      status: { $in: ['pending_supervisor', 'pending_departmental_head', 'pending_head_of_business', 'pending_finance', 'approved'] }
    }).populate('employee', 'fullName department');

    console.log(`Found ${requests.length} requests to process\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const request of requests) {
      try {
        console.log(`\n📄 Processing Request ${request._id}`);
        console.log(`   Employee: ${request.employee.fullName}`);
        console.log(`   Current Status: ${request.status}`);
        console.log(`   Current Chain Length: ${request.approvalChain.length}`);

        // Check if Finance is at the correct level (should be last)
        const financeStep = request.approvalChain.find(s => 
          s.approver.email === 'ranibellmambo@gratoengineering.com'
        );

        const maxLevel = Math.max(...request.approvalChain.map(s => s.level));
        
        if (!financeStep) {
          console.log('   ⚠️  No Finance step found - needs regeneration');
        } else if (financeStep.level !== maxLevel) {
          console.log(`   ⚠️  Finance is at level ${financeStep.level} but should be at ${maxLevel}`);
        } else {
          console.log('   ✓ Finance is correctly at final level');
        }

        // Generate new approval chain
        const newChain = getCashRequestApprovalChain(
          request.employee.fullName,
          request.employee.department
        );

        console.log(`   New chain length: ${newChain.length}`);

        // Map old approvals to new chain
        const updatedChain = newChain.map(newStep => {
          const oldStep = request.approvalChain.find(s => 
            s.approver.email === newStep.approver.email
          );

          if (oldStep && oldStep.status !== 'pending') {
            // Preserve existing approval/denial
            return {
              ...newStep,
              status: oldStep.status,
              comments: oldStep.comments,
              actionDate: oldStep.actionDate,
              actionTime: oldStep.actionTime,
              decidedBy: oldStep.decidedBy
            };
          }

          return newStep;
        });

        // Determine correct status based on approvals
        let newStatus = request.status;
        const allApproved = updatedChain.every(s => s.status === 'approved');
        
        if (allApproved) {
          newStatus = 'approved';
        } else {
          // Find first pending step
          const firstPending = updatedChain.find(s => s.status === 'pending');
          if (firstPending) {
            const statusMap = {
              1: 'pending_supervisor',
              2: 'pending_departmental_head',
              3: 'pending_head_of_business',
              4: 'pending_finance'
            };
            newStatus = statusMap[firstPending.level] || 'pending_finance';
          }
        }

        console.log(`   Old Status: ${request.status}`);
        console.log(`   New Status: ${newStatus}`);

        // Update request
        request.approvalChain = updatedChain;
        request.status = newStatus;
        await request.save();

        console.log('   ✅ Fixed successfully');
        fixed++;

      } catch (error) {
        console.error(`   ❌ Error fixing request ${request._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('FIX SUMMARY:');
    console.log(`✅ Fixed: ${fixed}`);
    console.log(`⊘ Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error:', error);
  }
};

// Run if executed directly
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://marcelngong50:dp1d6ABP6ggkvQli@cluster0.9nhviyl.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('✅ Connected to MongoDB\n');
    return fixCashRequestApprovalChains();
  })
  .then(() => {
    console.log('\n✅ Fix completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = fixCashRequestApprovalChains;