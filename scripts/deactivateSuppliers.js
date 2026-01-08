const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

/**
 * Reset approved but inactive suppliers to pending state
 * Targets suppliers where accountStatus='approved' but isActive=false
 */
const resetApprovedInactiveSuppliers = async () => {
  try {
    console.log('🔄 Resetting approved but inactive suppliers to pending state...');

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Find suppliers with accountStatus='approved' but isActive=false
    const suppliers = await User.find({ 
      role: 'supplier',
      isActive: false,
      'supplierStatus.accountStatus': 'approved'
    });

    console.log(`\n📊 Found ${suppliers.length} approved but inactive suppliers:`);
    
    if (suppliers.length === 0) {
      console.log('   No suppliers match the criteria.');
      return {
        totalFound: 0,
        reset: 0,
        failed: 0,
        details: []
      };
    }

    // Display suppliers that will be reset
    console.log('=' .repeat(70));
    suppliers.forEach((supplier, index) => {
      console.log(`${index + 1}. ${supplier.fullName}`);
      console.log(`   Company: ${supplier.supplierDetails?.companyName || supplier.company || 'N/A'}`);
      console.log(`   Email: ${supplier.email}`);
      console.log(`   Current: isActive=${supplier.isActive}, accountStatus=${supplier.supplierStatus?.accountStatus}`);
      console.log(`   Approval Date: ${supplier.supplierStatus?.approvalDate || 'N/A'}`);
      console.log('   ' + '-'.repeat(60));
    });

    console.log(`\n⚠️  About to reset ${suppliers.length} suppliers:`);
    console.log('   - accountStatus: "approved" → "pending"');
    console.log('   - Clear approval date and approver');
    console.log('   - Reset currentApprovalLevel to 0');
    console.log('   - Keep isActive as false');

    const resetSuppliers = [];
    const failedResets = [];

    for (const supplier of suppliers) {
      try {
        const oldStatus = {
          accountStatus: supplier.supplierStatus?.accountStatus,
          approvalDate: supplier.supplierStatus?.approvalDate,
          approvedBy: supplier.supplierStatus?.approvedBy,
          currentApprovalLevel: supplier.currentApprovalLevel
        };

        // Reset to pending state
        supplier.supplierStatus.accountStatus = 'pending';
        supplier.supplierStatus.approvalDate = undefined;
        supplier.supplierStatus.approvedBy = undefined;
        
        // Reset approval chain to initial state
        if (supplier.supplierDetails?.supplierType) {
          const { getSupplierApprovalChain } = require('../config/supplierApprovalChain');
          supplier.approvalChain = getSupplierApprovalChain(supplier.supplierDetails.supplierType);
        } else {
          supplier.approvalChain = [];
        }
        
        supplier.currentApprovalLevel = 0;
        supplier.updatedAt = new Date();
        
        await supplier.save();

        resetSuppliers.push({
          email: supplier.email,
          fullName: supplier.fullName,
          company: supplier.supplierDetails?.companyName || supplier.company,
          oldStatus: oldStatus,
          newStatus: {
            accountStatus: 'pending',
            currentApprovalLevel: 0
          },
          resetAt: new Date()
        });

        console.log(`✅ Reset: ${supplier.fullName} (${supplier.email})`);
        console.log(`   Status: ${oldStatus.accountStatus} → pending`);

      } catch (error) {
        console.error(`❌ Failed to reset ${supplier.email}:`, error.message);
        failedResets.push({
          email: supplier.email,
          fullName: supplier.fullName,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n' + '=' .repeat(70));
    console.log('🎉 RESET PROCESS COMPLETED!');
    console.log('=' .repeat(70));
    console.log(`📈 Summary:`);
    console.log(`   - Total found: ${suppliers.length}`);
    console.log(`   - Successfully reset: ${resetSuppliers.length}`);
    console.log(`   - Failed: ${failedResets.length}`);

    if (resetSuppliers.length > 0) {
      console.log('\n✅ SUCCESSFULLY RESET:');
      resetSuppliers.forEach((s, i) => {
        console.log(`${i + 1}. ${s.fullName} (${s.company})`);
        console.log(`   Email: ${s.email}`);
        console.log(`   Status: ${s.oldStatus.accountStatus} → ${s.newStatus.accountStatus}`);
        console.log(`   Approval Level: ${s.oldStatus.currentApprovalLevel} → ${s.newStatus.currentApprovalLevel}`);
      });
    }

    if (failedResets.length > 0) {
      console.log('\n❌ FAILED RESETS:');
      failedResets.forEach((f, i) => {
        console.log(`${i + 1}. ${f.fullName} - ${f.email}`);
        console.log(`   Error: ${f.error}`);
      });
    }

    console.log('\n📋 RESULT:');
    console.log('✓ accountStatus changed from "approved" to "pending"');
    console.log('✓ Approval dates and approvers cleared');
    console.log('✓ currentApprovalLevel reset to 0');
    console.log('✓ Suppliers now need to go through approval process');

    return {
      totalFound: suppliers.length,
      reset: resetSuppliers.length,
      failed: failedResets.length,
      details: resetSuppliers,
      failures: failedResets
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n📦 Database connection closed');
  }
};

// Run the function
if (require.main === module) {
  resetApprovedInactiveSuppliers()
    .then((results) => {
      console.log('\n✨ Process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed:', error.message);
      process.exit(1);
    });
}

module.exports = { resetApprovedInactiveSuppliers };