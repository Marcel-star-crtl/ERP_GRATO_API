const mongoose = require('mongoose');
const CashRequest = require('../models/CashRequest');
const User = require('../models/User');

// Connect to database
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/grato_erp')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const debugApprovalChain = async () => {
  try {
    console.log('🔍 DEBUGGING APPROVAL CHAINS\n');
    
    // Find all pending requests that might be stuck
    const pendingRequests = await CashRequest.find({
      status: { $regex: /pending/ }
    }).populate('employee', 'fullName email department');

    console.log(`Found ${pendingRequests.length} pending requests\n`);

    for (const request of pendingRequests) {
      console.log(`\n📋 REQUEST: ${request._id}`);
      console.log(`   Employee: ${request.employee.fullName} (${request.employee.department})`);
      console.log(`   Status: ${request.status}`);
      console.log(`   Amount: XAF ${request.amountRequested?.toLocaleString()}`);
      console.log(`   Created: ${request.createdAt?.toLocaleDateString()}`);
      
      console.log(`\n   📊 APPROVAL CHAIN (${request.approvalChain.length} levels):`);
      request.approvalChain.forEach(step => {
        const statusIcon = step.status === 'approved' ? '✅' : 
                          step.status === 'pending' ? '⏳' : 
                          step.status === 'rejected' ? '❌' : '❓';
        
        console.log(`   ${statusIcon} Level ${step.level}: ${step.approver.name} (${step.approver.role})`);
        console.log(`      📧 ${step.approver.email}`);
        console.log(`      Status: ${step.status}`);
        if (step.actionDate) {
          console.log(`      Action Date: ${step.actionDate.toLocaleString()}`);
        }
        if (step.comments) {
          console.log(`      Comments: ${step.comments}`);
        }
        console.log('');
      });

      // Check for issues
      const issues = [];
      
      // Check if status matches the expected level
      const statusLevelMap = {
        'pending_supervisor': 1,
        'pending_departmental_head': 2,
        'pending_head_of_business': 3,
        'pending_finance': 4
      };
      
      const expectedLevel = statusLevelMap[request.status];
      if (expectedLevel) {
        const currentStep = request.approvalChain.find(s => s.level === expectedLevel);
        if (!currentStep) {
          issues.push(`❌ No approval step found for level ${expectedLevel} (status: ${request.status})`);
        } else if (currentStep.status !== 'pending') {
          issues.push(`❌ Step at level ${expectedLevel} has status '${currentStep.status}' but request status is '${request.status}'`);
        }
        
        // Check if previous levels are approved
        const previousSteps = request.approvalChain.filter(s => s.level < expectedLevel);
        const unapprovedPrevious = previousSteps.filter(s => s.status !== 'approved');
        if (unapprovedPrevious.length > 0) {
          issues.push(`❌ Previous levels not approved: ${unapprovedPrevious.map(s => `L${s.level}:${s.status}`).join(', ')}`);
        }
      }
      
      // Check for duplicate levels
      const levelCounts = {};
      request.approvalChain.forEach(step => {
        levelCounts[step.level] = (levelCounts[step.level] || 0) + 1;
      });
      
      Object.entries(levelCounts).forEach(([level, count]) => {
        if (count > 1) {
          issues.push(`❌ Duplicate approval level ${level} (${count} steps)`);
        }
      });
      
      // Check for gaps in levels
      const levels = request.approvalChain.map(s => s.level).sort((a, b) => a - b);
      for (let i = 1; i <= levels[levels.length - 1]; i++) {
        if (!levels.includes(i)) {
          issues.push(`❌ Missing approval level ${i}`);
        }
      }

      if (issues.length > 0) {
        console.log(`   🚨 ISSUES FOUND:`);
        issues.forEach(issue => console.log(`   ${issue}`));
      } else {
        console.log(`   ✅ No issues detected`);
      }
    }

    // Check for requests that should be visible to finance
    console.log(`\n\n💰 FINANCE VISIBILITY CHECK`);
    
    const financeUsers = await User.find({ role: 'finance' });
    console.log(`Found ${financeUsers.length} finance users`);
    
    for (const financeUser of financeUsers) {
      console.log(`\n👤 Finance User: ${financeUser.fullName} (${financeUser.email})`);
      
      const financeRequests = await CashRequest.find({
        $or: [
          { 
            'approvalChain': {
              $elemMatch: {
                'approver.email': financeUser.email,
                'approver.role': 'Finance Officer',
                'status': 'pending'
              }
            }
          },
          { status: 'pending_finance' },
          { status: 'approved' },
          { status: 'disbursed' },
          { status: 'completed' }
        ]
      }).populate('employee', 'fullName');
      
      console.log(`   Should see ${financeRequests.length} requests:`);
      
      financeRequests.forEach(req => {
        const financeStep = req.approvalChain.find(s => 
          s.approver.email === financeUser.email && s.approver.role === 'Finance Officer'
        );
        
        const previousSteps = req.approvalChain.filter(s => 
          financeStep ? s.level < financeStep.level : true
        );
        
        const allPreviousApproved = previousSteps.length === 0 || 
          previousSteps.every(s => s.status === 'approved');
        
        const visibilityStatus = allPreviousApproved ? '✅ VISIBLE' : '❌ HIDDEN';
        
        console.log(`   ${visibilityStatus} ${req._id} - ${req.employee.fullName} (${req.status})`);
        
        if (financeStep) {
          console.log(`      Finance step: Level ${financeStep.level}, Status: ${financeStep.status}`);
        }
        
        if (!allPreviousApproved) {
          const unapproved = previousSteps.filter(s => s.status !== 'approved');
          console.log(`      Unapproved previous: ${unapproved.map(s => `L${s.level}:${s.status}`).join(', ')}`);
        }
      });
    }

    console.log('\n🎯 SUMMARY RECOMMENDATIONS:');
    console.log('1. Check requests with status/level mismatches');
    console.log('2. Verify all previous approval levels are completed before showing to next level');
    console.log('3. Ensure approval chain generation is consistent');
    console.log('4. Consider running fixStuckRequests.js for problematic requests');

  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run if called directly
if (require.main === module) {
  debugApprovalChain();
}

module.exports = { debugApprovalChain };