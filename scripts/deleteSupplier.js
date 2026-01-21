// scripts/deleteSupplier.js
const mongoose = require('mongoose');
const User = require('../models/User'); // Adjust path to your User/Supplier model
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const SUPPLIER_EMAIL = 'sunjoasheri@gmail.com';

/**
 * Delete a file safely
 */
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`   🗑️  Deleted file: ${filePath}`);
      return true;
    } else {
      console.log(`   ⚠️  File not found: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error deleting file ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Delete supplier documents from filesystem
 */
function deleteSupplierDocuments(supplier) {
  console.log('\n📁 Deleting supplier documents...');
  
  const documents = supplier.supplierDetails?.documents;
  if (!documents) {
    console.log('   ℹ️  No documents to delete');
    return;
  }

  let deletedCount = 0;
  let failedCount = 0;

  // Delete business registration certificate
  if (documents.businessRegistrationCertificate?.url) {
    const filePath = path.join(__dirname, '..', documents.businessRegistrationCertificate.url);
    deleteFile(filePath) ? deletedCount++ : failedCount++;
  }

  // Delete tax clearance certificate
  if (documents.taxClearanceCertificate?.url) {
    const filePath = path.join(__dirname, '..', documents.taxClearanceCertificate.url);
    deleteFile(filePath) ? deletedCount++ : failedCount++;
  }

  // Delete bank statement
  if (documents.bankStatement?.url) {
    const filePath = path.join(__dirname, '..', documents.bankStatement.url);
    deleteFile(filePath) ? deletedCount++ : failedCount++;
  }

  // Delete additional documents
  if (Array.isArray(documents.additionalDocuments)) {
    for (const doc of documents.additionalDocuments) {
      if (doc.url) {
        const filePath = path.join(__dirname, '..', doc.url);
        deleteFile(filePath) ? deletedCount++ : failedCount++;
      }
    }
  }

  console.log(`   ✅ Deleted ${deletedCount} files`);
  if (failedCount > 0) {
    console.log(`   ⚠️  Failed to delete ${failedCount} files`);
  }
}

async function deleteSupplier() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the supplier
    const supplier = await User.findOne({ 
      email: SUPPLIER_EMAIL,
      role: 'supplier'
    });

    if (!supplier) {
      console.log(`❌ Supplier not found: ${SUPPLIER_EMAIL}`);
      process.exit(1);
    }

    console.log('📋 SUPPLIER DETAILS');
    console.log('='.repeat(60));
    console.log(`ID: ${supplier._id}`);
    console.log(`Email: ${supplier.email}`);
    console.log(`Full Name: ${supplier.fullName}`);
    console.log(`Company: ${supplier.supplierDetails?.companyName || 'N/A'}`);
    console.log(`Status: ${supplier.supplierStatus?.accountStatus || 'N/A'}`);
    console.log(`Created: ${supplier.createdAt}`);
    console.log('='.repeat(60));

    // Show approval chain
    if (supplier.approvalChain?.length > 0) {
      console.log('\n📊 Approval Chain:');
      supplier.approvalChain.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step.approver.name} (${step.status})`);
      });
    }

    // Show documents
    const docs = supplier.supplierDetails?.documents;
    if (docs) {
      console.log('\n📄 Documents to be deleted:');
      if (docs.businessRegistrationCertificate) {
        console.log(`   - Business Registration: ${docs.businessRegistrationCertificate.name}`);
      }
      if (docs.taxClearanceCertificate) {
        console.log(`   - Tax Clearance: ${docs.taxClearanceCertificate.name}`);
      }
      if (docs.bankStatement) {
        console.log(`   - Bank Statement: ${docs.bankStatement.name}`);
      }
      if (docs.additionalDocuments?.length > 0) {
        console.log(`   - Additional Documents: ${docs.additionalDocuments.length} file(s)`);
      }
    }

    console.log('\n⚠️  WARNING: This action cannot be undone!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');

    // Wait 5 seconds before proceeding
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete documents from filesystem
    deleteSupplierDocuments(supplier);

    // Delete supplier from database
    console.log('\n🗑️  Deleting supplier from database...');
    await User.deleteOne({ _id: supplier._id });

    console.log('\n' + '='.repeat(60));
    console.log('✅ DELETION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Supplier "${supplier.fullName}" has been permanently deleted.`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Deletion failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
deleteSupplier();