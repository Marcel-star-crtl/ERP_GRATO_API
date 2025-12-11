require('dotenv').config();
const mongoose = require('mongoose');
const CashRequest = require('../models/CashRequest');
const BudgetCode = require('../models/BudgetCode');

const fixSpecificRequest = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const requestId = '6924537fdfc03bc5b20cc1aa'; 

    // Direct database query
    const CashRequest = mongoose.model('CashRequest');
    const BudgetCode = mongoose.model('BudgetCode');

    const request = await CashRequest.findById(requestId);
    
    if (!request) {
      console.error('❌ Request not found!');
      return;
    }

    console.log('📊 CURRENT STATE:');
    console.log('═'.repeat(70));
    console.log(`Request ID: ${requestId}`);
    console.log(`Amount Requested: XAF ${request.amountRequested?.toLocaleString() || 0}`);
    console.log(`Amount Approved: XAF ${request.amountApproved?.toLocaleString() || 0}`);
    console.log(`Total Disbursed: XAF ${request.totalDisbursed?.toLocaleString() || 0}`);
    console.log(`Remaining Balance: XAF ${request.remainingBalance?.toLocaleString() || 0}`);
    console.log(`Status: ${request.status}`);
    console.log(`Disbursements: ${request.disbursements?.length || 0}`);
    
    if (request.budgetAllocation) {
      console.log(`\nBudget Allocation:`);
      console.log(`  Budget Code ID: ${request.budgetAllocation.budgetCodeId}`);
      console.log(`  Budget Code: ${request.budgetAllocation.budgetCode}`);
      console.log(`  Allocated Amount: XAF ${request.budgetAllocation.allocatedAmount?.toLocaleString() || 0}`);
    }

    // Get the budget code
    const budgetCodeId = request.budgetAllocation?.budgetCodeId;
    if (!budgetCodeId) {
      console.error('\n❌ No budget allocation found!');
      return;
    }

    const budgetCode = await BudgetCode.findById(budgetCodeId);
    if (!budgetCode) {
      console.error('\n❌ Budget code not found!');
      return;
    }

    console.log(`\n💰 Budget Code: ${budgetCode.code}`);
    console.log(`   Total: XAF ${budgetCode.budget.toLocaleString()}`);
    console.log(`   Used: XAF ${budgetCode.used.toLocaleString()}`);
    console.log(`   Remaining: XAF ${(budgetCode.budget - budgetCode.used).toLocaleString()}`);

    // Find the allocation
    const allocationIndex = budgetCode.allocations.findIndex(
      a => a.requisitionId?.toString() === requestId
    );

    if (allocationIndex === -1) {
      console.error('\n❌ No allocation found in budget code!');
      return;
    }

    const allocation = budgetCode.allocations[allocationIndex];
    console.log(`\n📊 Current Allocation:`);
    console.log(`   Amount: XAF ${allocation.amount.toLocaleString()}`);
    console.log(`   Actual Spent: XAF ${allocation.actualSpent?.toLocaleString() || 0}`);
    console.log(`   Status: ${allocation.status}`);

    // Calculate what we need
    const requestedAmount = request.amountRequested;
    const currentDisbursed = request.totalDisbursed || 0;
    const additionalNeeded = requestedAmount - allocation.amount;

    console.log('\n🔧 REQUIRED CHANGES:');
    console.log(`   Need total allocation: XAF ${requestedAmount.toLocaleString()}`);
    console.log(`   Currently allocated: XAF ${allocation.amount.toLocaleString()}`);
    console.log(`   Additional needed: XAF ${additionalNeeded.toLocaleString()}`);
    console.log(`   Already disbursed: XAF ${currentDisbursed.toLocaleString()}`);

    // Check budget availability
    const budgetRemaining = budgetCode.budget - budgetCode.used;
    if (additionalNeeded > budgetRemaining) {
      console.error(`\n❌ INSUFFICIENT BUDGET!`);
      console.error(`   Need: XAF ${additionalNeeded.toLocaleString()}`);
      console.error(`   Available: XAF ${budgetRemaining.toLocaleString()}`);
      console.error(`   Shortfall: XAF ${(additionalNeeded - budgetRemaining).toLocaleString()}`);
      return;
    }

    // ✅ APPLY FIX
    console.log('\n🔨 APPLYING FIX...');

    // 1. Update allocation amount
    budgetCode.allocations[allocationIndex].amount = requestedAmount;
    
    // 2. Fix actualSpent if wrong
    if (currentDisbursed > 0 && (!allocation.actualSpent || allocation.actualSpent === 0)) {
      budgetCode.allocations[allocationIndex].actualSpent = currentDisbursed;
      console.log(`   ✓ Fixed actualSpent: 0 → ${currentDisbursed.toLocaleString()}`);
    }

    // 3. Update request
    request.amountApproved = requestedAmount;
    request.budgetAllocation.allocatedAmount = requestedAmount;
    request.remainingBalance = requestedAmount - currentDisbursed;

    // 4. Update status if needed
    if (request.remainingBalance > 0 && request.status === 'fully_disbursed') {
      request.status = 'partially_disbursed';
      console.log(`   ✓ Status: fully_disbursed → partially_disbursed`);
    }

    // 5. Add transaction to budget
    if (!budgetCode.transactions) {
      budgetCode.transactions = [];
    }

    budgetCode.transactions.push({
      type: 'reservation',
      amount: additionalNeeded,
      requisitionId: requestId,
      description: `Allocation increased from XAF ${allocation.amount.toLocaleString()} to XAF ${requestedAmount.toLocaleString()}`,
      performedBy: request.budgetAllocation.assignedBy,
      balanceBefore: budgetRemaining,
      balanceAfter: budgetRemaining - additionalNeeded,
      timestamp: new Date()
    });

    // 6. Save everything
    await budgetCode.save();
    await request.save();

    console.log('\n✅ FIX APPLIED SUCCESSFULLY!\n');

    // Verify the fix
    const updatedRequest = await CashRequest.findById(requestId);
    const updatedBudget = await BudgetCode.findById(budgetCodeId);
    const updatedAllocation = updatedBudget.allocations.find(
      a => a.requisitionId?.toString() === requestId
    );

    console.log('📊 UPDATED STATE:');
    console.log('═'.repeat(70));
    console.log(`Request ID: ${requestId}`);
    console.log(`Amount Requested: XAF ${updatedRequest.amountRequested.toLocaleString()}`);
    console.log(`Amount Approved: XAF ${updatedRequest.amountApproved.toLocaleString()}`);
    console.log(`Budget Allocated: XAF ${updatedAllocation.amount.toLocaleString()}`);
    console.log(`Total Disbursed: XAF ${updatedRequest.totalDisbursed.toLocaleString()}`);
    console.log(`Remaining Balance: XAF ${updatedRequest.remainingBalance.toLocaleString()}`);
    console.log(`Status: ${updatedRequest.status}`);
    console.log(`\nAllocation actualSpent: XAF ${updatedAllocation.actualSpent?.toLocaleString() || 0}`);
    console.log('═'.repeat(70));

    console.log('\n💡 YOU CAN NOW DISBURSE THE REMAINING BALANCE!');
    console.log(`   Maximum: XAF ${updatedRequest.remainingBalance.toLocaleString()}`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

// Run the fix
fixSpecificRequest();