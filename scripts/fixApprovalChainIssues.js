const mongoose = require('mongoose');
const CashRequest = require('../models/CashRequest');
const User = require('../models/User');
const { getCashRequestApprovalChain } = require('../config/cashRequestApprovalChain');

// Connect to database
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/grato_erp')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const fixApprovalChainIssues = async (dryRun = true) => {
  try {
    console.log(`🔧 ${dryRun ? 'DRY RUN - ' : ''}FIXING APPROVAL CHAIN ISSUES\n`);
    
    const pendingRequests = await CashRequest.find({
      status: { $regex: /pending/ }
    }).populate('employee', 'fullName email department');

    console.log(`Found ${pendingRequests.length} pending requests\n`);
    
    let fixedCount = 0;
    
    for (const request of pendingRequests) {
      console.log(`\n📋 Checking Request: ${request._id}`);
      console.log(`   Employee: ${request.employee.fullName}`);
      console.log(`   Current Status: ${request.status}`);
      
      const fixes = [];
      let shouldUpdate = false;
      
      // 1. Fix status/level mismatches
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
          fixes.push(`❌ Missing step for level ${expectedLevel}`);
          
          // Try to regenerate approval chain
          try {
            const newChain = getCashRequestApprovalChain(
              request.employee.fullName, 
              request.employee.department
            );
            
            if (newChain && newChain.length > 0) {
              // Preserve existing approvals
              const existingApprovals = {};
              request.approvalChain.forEach(step => {
                if (step.status === 'approved') {
                  existingApprovals[step.level] = step;
                }
              });
              
              // Apply existing approvals to new chain
              newChain.forEach(step => {
                if (existingApprovals[step.level]) {
                  step.status = 'approved';
                  step.actionDate = existingApprovals[step.level].actionDate;
                  step.comments = existingApprovals[step.level].comments;
                  step.decidedBy = existingApprovals[step.level].decidedBy;
                }
              });
              
              request.approvalChain = newChain;
              fixes.push(`✅ Regenerated approval chain with ${newChain.length} levels`);
              shouldUpdate = true;
            }
          } catch (chainError) {
            fixes.push(`❌ Failed to regenerate approval chain: ${chainError.message}`);
          }
        } else if (currentStep.status !== 'pending') {
          fixes.push(`❌ Step level ${expectedLevel} has status '${currentStep.status}' but should be 'pending'`);
          currentStep.status = 'pending';
          fixes.push(`✅ Fixed step status to 'pending'`);
          shouldUpdate = true;
        }
      }
      
      // 2. Fix requests stuck at head of business -> finance transition
      if (request.status === 'pending_head_of_business') {
        const level3Step = request.approvalChain.find(s => s.level === 3);
        if (level3Step && level3Step.status === 'approved') {
          const level4Step = request.approvalChain.find(s => s.level === 4);
          if (level4Step && level4Step.status === 'pending') {
            request.status = 'pending_finance';
            fixes.push(`✅ Fixed status: pending_head_of_business → pending_finance`);
            shouldUpdate = true;
          }
        }
      }
      
      // 3. Renumber approval levels if there are gaps
      const levels = request.approvalChain.map(s => s.level).sort((a, b) => a - b);
      let hasGaps = false;
      for (let i = 1; i <= levels[levels.length - 1]; i++) {
        if (!levels.includes(i)) {
          hasGaps = true;
          break;
        }
      }
      
      if (hasGaps) {
        fixes.push(`❌ Gaps found in approval levels: ${levels.join(', ')}`);
        
        // Renumber to remove gaps
        request.approvalChain.sort((a, b) => a.level - b.level);
        request.approvalChain.forEach((step, index) => {
          step.level = index + 1;
        });
        
        fixes.push(`✅ Renumbered approval levels: ${request.approvalChain.map(s => s.level).join(', ')}`);
        shouldUpdate = true;
      }
      
      // 4. Ensure all previous levels are approved for current status
      if (expectedLevel && expectedLevel > 1) {
        const previousSteps = request.approvalChain.filter(s => s.level < expectedLevel);
        const unapprovedPrevious = previousSteps.filter(s => s.status !== 'approved');
        
        if (unapprovedPrevious.length > 0) {
          fixes.push(`❌ Previous levels not approved: ${unapprovedPrevious.map(s => `L${s.level}:${s.status}`).join(', ')}`);
          
          // Check if we should move the request back
          const lastApprovedLevel = previousSteps
            .filter(s => s.status === 'approved')
            .map(s => s.level)
            .sort((a, b) => b - a)[0] || 0;
          
          const correctStatus = Object.entries(statusLevelMap).find(([, level]) => level === lastApprovedLevel + 1)?.[0];
          
          if (correctStatus && correctStatus !== request.status) {
            request.status = correctStatus;
            fixes.push(`✅ Corrected status to: ${correctStatus}`);
            shouldUpdate = true;
          }
        }
      }
      
      if (fixes.length > 0) {
        console.log(`   🔧 FIXES NEEDED:`);
        fixes.forEach(fix => console.log(`   ${fix}`));
        
        if (shouldUpdate && !dryRun) {
          await request.save();
          fixedCount++;
          console.log(`   ✅ REQUEST UPDATED`);
        } else if (shouldUpdate && dryRun) {
          console.log(`   🔍 Would update request (dry run)`);
        }
      } else {
        console.log(`   ✅ No issues found`);
      }
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total requests checked: ${pendingRequests.length}`);
    console.log(`   Requests ${dryRun ? 'that would be' : ''} fixed: ${fixedCount}`);
    
    if (dryRun) {
      console.log(`\n⚠️  This was a DRY RUN. To apply fixes, run:`);
      console.log(`   node scripts/fixApprovalChainIssues.js --apply`);
    } else {
      console.log(`\n✅ Fixes applied to database`);
    }

  } catch (error) {
    console.error('Fix script error:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Command line handling
const args = process.argv.slice(2);
const shouldApply = args.includes('--apply') || args.includes('-a');

if (require.main === module) {
  fixApprovalChainIssues(!shouldApply);
}

module.exports = { fixApprovalChainIssues };