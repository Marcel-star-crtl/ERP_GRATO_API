require('dotenv').config();
const mongoose = require('mongoose');
const CashRequest = require('../models/CashRequest');
const BudgetCode = require('../models/BudgetCode');
const User = require('../models/User');

/**
 * Universal fix script that can handle any cash request with allocation issues
 * Usage: node scripts/universal-fix.js <requestId>
 */

const fixCashRequestAllocation = async (requestId) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    if (!requestId) {
      console.error('❌ Please provide a request ID');
      console.log('Usage: node scripts/universal-fix.js <requestId>');
      return;
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      console.error('❌ Invalid request ID format');
      return;
    }

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email');
    
    if (!request) {
      console.error('❌ Request not found');
      return;
    }

    console.log('📊 CURRENT STATE:');
    console.log('═'.repeat(70));
    console.log(`Request ID: ${requestId} (REQ-${requestId.slice(-6).toUpperCase()})`);
    console.log(`Employee: ${request.employee?.fullName || 'N/A'}`);
    console.log(`Amount Requested: XAF ${request.amountRequested?.toLocaleString() || 0}`);
    console.log(`Amount Approved: XAF ${(request.amountApproved || 0).toLocaleString()}`);
    console.log(`Total Disbursed: XAF ${(request.totalDisbursed || 0).toLocaleString()}`);
    console.log(`Remaining Balance: XAF ${(request.remainingBalance || 0).toLocaleString()}`);
    console.log(`Status: ${request.status}`);
    
    if (request.budgetAllocation) {
      console.log(`Budget Allocated: XAF ${request.budgetAllocation.allocatedAmount?.toLocaleString() || 0}`);
      console.log(`Budget Code: ${request.budgetAllocation.budgetCode || 'N/A'}`);
    } else {
      console.log('⚠️  No budget allocation found!');
    }
    console.log('═'.repeat(70));

    // Check if there's actually a problem
    const requestedAmount = request.amountRequested || 0;
    const approvedAmount = request.amountApproved || 0;
    const allocatedAmount = request.budgetAllocation?.allocatedAmount || 0;
    const disbursedAmount = request.totalDisbursed || 0;

    // Detect issues
    const issues = [];
    if (approvedAmount < requestedAmount) {
      issues.push(`Approved (${approvedAmount.toLocaleString()}) < Requested (${requestedAmount.toLocaleString()})`);
    }
    if (allocatedAmount < approvedAmount) {
      issues.push(`Allocated (${allocatedAmount.toLocaleString()}) < Approved (${approvedAmount.toLocaleString()})`);
    }
    if (allocatedAmount < requestedAmount) {
      issues.push(`Allocated (${allocatedAmount.toLocaleString()}) < Requested (${requestedAmount.toLocaleString()})`);
    }

    if (issues.length === 0) {
      console.log('\n✅ No issues detected! All amounts are properly aligned.');
      console.log(`   Requested = Approved = Allocated = XAF ${requestedAmount.toLocaleString()}`);
      return;
    }

    console.log('\n⚠️  ISSUES DETECTED:');
    issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));

    // Determine target amount (should be the highest of all)
    const targetAmount = Math.max(requestedAmount, approvedAmount, allocatedAmount);
    
    console.log(`\n💡 SOLUTION:`);
    console.log(`   Set all amounts to: XAF ${targetAmount.toLocaleString()}`);
    console.log(`   This ensures: Requested = Approved = Allocated`);

    // Get budget code
    if (!request.budgetAllocation || !request.budgetAllocation.budgetCode) {
      console.error('\n❌ Cannot proceed: No budget code assigned to this request');
      return;
    }

    const budgetCodeStr = request.budgetAllocation.budgetCode;
    const budgetCode = await BudgetCode.findOne({ code: budgetCodeStr });
    
    if (!budgetCode) {
      console.error(`\n❌ Budget code ${budgetCodeStr} not found!`);
      return;
    }

    console.log(`\n💰 BUDGET INFORMATION: ${budgetCode.code}`);
    console.log(`   Total Budget: XAF ${budgetCode.budget.toLocaleString()}`);
    console.log(`   Currently Used: XAF ${budgetCode.used.toLocaleString()}`);
    console.log(`   Available: XAF ${budgetCode.remaining.toLocaleString()}`);

    // Find allocation
    const allocation = budgetCode.allocations.find(
      a => a.requisitionId?.toString() === requestId.toString()
    );

    if (!allocation) {
      console.error('   ❌ No allocation found in budget code!');
      return;
    }

    console.log(`\n   Current Allocation:`);
    console.log(`   - Amount: XAF ${allocation.amount.toLocaleString()}`);
    console.log(`   - Actual Spent: XAF ${(allocation.actualSpent || 0).toLocaleString()}`);
    console.log(`   - Status: ${allocation.status}`);

    // Calculate additional budget needed
    const additionalNeeded = targetAmount - allocation.amount;
    
    if (additionalNeeded > 0) {
      console.log(`\n   Additional budget needed: XAF ${additionalNeeded.toLocaleString()}`);
      
      if (budgetCode.remaining < additionalNeeded) {
        console.error(`\n❌ INSUFFICIENT BUDGET!`);
        console.error(`   Need: XAF ${additionalNeeded.toLocaleString()}`);
        console.error(`   Available: XAF ${budgetCode.remaining.toLocaleString()}`);
        console.error(`   Shortfall: XAF ${(additionalNeeded - budgetCode.remaining).toLocaleString()}`);
        console.log(`\n💡 Options:`);
        console.log(`   1. Reduce the request amount to XAF ${(allocation.amount + budgetCode.remaining).toLocaleString()}`);
        console.log(`   2. Add more funds to budget ${budgetCodeStr}`);
        console.log(`   3. Use a different budget code`);
        return;
      }
    }

    // ============================================
    // APPLY FIXES
    // ============================================
    console.log(`\n🔧 APPLYING FIXES...`);

    let changesApplied = false;

    // Fix 1: Update approval amount
    if (request.amountApproved !== targetAmount) {
      const oldApproved = request.amountApproved;
      request.amountApproved = targetAmount;
      request.remainingBalance = targetAmount - disbursedAmount;
      
      console.log(`   ✅ Updated Approval:`);
      console.log(`      ${oldApproved.toLocaleString()} → ${targetAmount.toLocaleString()}`);
      changesApplied = true;
    }

    // Fix 2: Update requested amount (ensure consistency)
    if (request.amountRequested !== targetAmount) {
      const oldRequested = request.amountRequested;
      request.amountRequested = targetAmount;
      
      console.log(`   ✅ Updated Requested:`);
      console.log(`      ${oldRequested.toLocaleString()} → ${targetAmount.toLocaleString()}`);
      changesApplied = true;
    }

    // Fix 3: Update budget allocation
    if (allocation.amount !== targetAmount) {
      const oldAllocationAmount = allocation.amount;
      allocation.amount = targetAmount;
      
      console.log(`   ✅ Updated Allocation:`);
      console.log(`      ${oldAllocationAmount.toLocaleString()} → ${targetAmount.toLocaleString()}`);

      // Update request's budget allocation reference
      request.budgetAllocation.allocatedAmount = targetAmount;

      // Add transaction record
      if (!budgetCode.transactions) {
        budgetCode.transactions = [];
      }

      if (additionalNeeded !== 0) {
        budgetCode.transactions.push({
          type: 'adjustment',
          amount: Math.abs(additionalNeeded),
          requisitionId: requestId,
          description: `Allocation adjusted from XAF ${oldAllocationAmount.toLocaleString()} to XAF ${targetAmount.toLocaleString()} (${additionalNeeded > 0 ? 'additional' : 'reduced by'} XAF ${Math.abs(additionalNeeded).toLocaleString()})`,
          performedBy: allocation.allocatedBy || request.budgetAllocation.assignedBy,
          balanceBefore: budgetCode.remaining,
          balanceAfter: budgetCode.remaining,
          timestamp: new Date()
        });
      }

      await budgetCode.save();
      changesApplied = true;
    }

    // Fix 4: Update status if fully disbursed but has remaining balance
    if (request.status === 'fully_disbursed' && request.remainingBalance > 0) {
      request.status = 'partially_disbursed';
      console.log(`   ✅ Status updated: fully_disbursed → partially_disbursed`);
      changesApplied = true;
    }

    if (changesApplied) {
      await request.save();
    }

    // Refresh data
    const updatedBudget = await BudgetCode.findOne({ code: budgetCodeStr });
    const updatedRequest = await CashRequest.findById(requestId);

    // ============================================
    // FINAL SUMMARY
    // ============================================
    console.log('\n✅ FIX COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(70));
    console.log('📊 FINAL STATE:');
    console.log(`Request ID: ${requestId}`);
    console.log(`Amount Requested: XAF ${updatedRequest.amountRequested.toLocaleString()}`);
    console.log(`Amount Approved: XAF ${updatedRequest.amountApproved.toLocaleString()}`);
    console.log(`Budget Allocated: XAF ${updatedRequest.budgetAllocation.allocatedAmount.toLocaleString()}`);
    console.log(`Total Disbursed: XAF ${updatedRequest.totalDisbursed.toLocaleString()}`);
    console.log(`Remaining Balance: XAF ${updatedRequest.remainingBalance.toLocaleString()}`);
    console.log(`Status: ${updatedRequest.status}`);
    console.log(`\nBudget: ${budgetCodeStr}`);
    console.log(`   Available: XAF ${updatedBudget.remaining.toLocaleString()}`);
    console.log('═'.repeat(70));

    if (updatedRequest.remainingBalance > 0) {
      console.log('\n💡 READY TO DISBURSE:');
      console.log(`   You can now disburse up to: XAF ${updatedRequest.remainingBalance.toLocaleString()}`);
    } else {
      console.log('\n✅ Request fully disbursed!');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

// Get request ID from command line argument
const requestId = process.argv[2];

if (!requestId) {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         Universal Budget Allocation Fixer                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('\nUsage:');
  console.log('  node scripts/universal-fix.js <requestId>');
  console.log('\nExample:');
  console.log('  node scripts/universal-fix.js 6924537fdfc03bc5b20cc1aa');
  console.log('\nWhat it does:');
  console.log('  • Analyzes the cash request and its budget allocation');
  console.log('  • Detects any inconsistencies in amounts');
  console.log('  • Fixes approval, allocation, and status issues');
  console.log('  • Ensures: Requested = Approved = Allocated');
  console.log('  • Validates sufficient budget availability\n');
  process.exit(1);
}

// Run the fix
fixCashRequestAllocation(requestId);