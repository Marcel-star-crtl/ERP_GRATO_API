const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fixStuckRequests = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI not found');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // Load models
    const CashRequest = require('../models/CashRequest');
    const User = require('../models/User');

    console.log('🔍 Finding requests with mismatched status...\n');

    // Find all active requests (not completed/denied/cancelled)
    const requests = await CashRequest.find({
      status: { 
        $in: [
          'pending_supervisor',
          'pending_departmental_head',
          'pending_head_of_business',
          'pending_finance'
        ] 
      }
    }).populate('employee', 'fullName');

    console.log(`Found ${requests.length} active requests\n`);

    let fixed = 0;
    let alreadyCorrect = 0;
    let errors = 0;

    for (const request of requests) {
      try {
        const requestId = request._id.toString().slice(-6).toUpperCase();
        const employeeName = request.employee?.fullName || 'Unknown';

        console.log(`\n📄 Checking: ${requestId} (${employeeName})`);
        console.log(`   Current status: ${request.status}`);

        // Show approval chain
        console.log(`   Approval chain:`);
        request.approvalChain.forEach(step => {
          const icon = step.status === 'approved' ? '✅' : 
                       step.status === 'pending' ? '⏳' : 
                       step.status === 'rejected' ? '❌' : '❓';
          console.log(`     ${icon} L${step.level}: ${step.approver.role} - ${step.status}`);
        });

        // Find the next pending approver
        const nextPendingStep = request.approvalChain.find(s => s.status === 'pending');

        if (!nextPendingStep) {
          // No pending steps - check if all approved
          const allApproved = request.approvalChain.every(s => s.status === 'approved');
          
          if (allApproved && request.status !== 'approved') {
            console.log(`   ⚠️  All levels approved but status is "${request.status}"`);
            console.log(`   ✏️  Fixing: ${request.status} → approved`);
            
            request.status = 'approved';
            await request.save();
            fixed++;
            console.log(`   ✅ Fixed`);
          } else if (allApproved) {
            console.log(`   ✓ Status is correct (all approved)`);
            alreadyCorrect++;
          } else {
            console.log(`   ⚠️  No pending steps but not all approved - may need manual review`);
            errors++;
          }
          continue;
        }

        // Determine correct status based on role
        const roleToStatusMap = {
          'Supervisor': 'pending_supervisor',
          'Departmental Head': 'pending_departmental_head',
          'Head of Business': 'pending_head_of_business',
          'Finance Officer': 'pending_finance'
        };

        const correctStatus = roleToStatusMap[nextPendingStep.approver.role];

        if (!correctStatus) {
          console.warn(`   ⚠️  Unknown role: "${nextPendingStep.approver.role}"`);
          errors++;
          continue;
        }

        console.log(`   Next pending: ${nextPendingStep.approver.role} (Level ${nextPendingStep.level})`);
        console.log(`   Expected status: ${correctStatus}`);

        if (request.status !== correctStatus) {
          console.log(`   ⚠️  STATUS MISMATCH DETECTED`);
          console.log(`   ✏️  Fixing: ${request.status} → ${correctStatus}`);

          request.status = correctStatus;
          await request.save();
          fixed++;
          console.log(`   ✅ Fixed`);
        } else {
          console.log(`   ✓ Status is correct`);
          alreadyCorrect++;
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('FIX SUMMARY:');
    console.log('='.repeat(70));
    console.log(`✅ Fixed:           ${fixed} request(s)`);
    console.log(`✓  Already correct: ${alreadyCorrect} request(s)`);
    console.log(`❌ Errors:          ${errors} request(s)`);
    console.log('='.repeat(70));

    if (fixed > 0) {
      console.log('\n📌 NEXT STEPS:');
      console.log('   1. Restart your backend server');
      console.log('   2. Clear browser cache (Ctrl+Shift+Delete)');
      console.log('   3. Login as Finance and check dashboard');
      console.log('   4. The fixed requests should now appear correctly\n');
    } else {
      console.log('\n✅ All requests have correct status - no fixes needed\n');
    }

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error('Stack:', error.stack);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  fixStuckRequests();
}

module.exports = fixStuckRequests;