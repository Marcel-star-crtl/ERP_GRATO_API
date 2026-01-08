// scripts/fetchAllSuppliers.js

const mongoose = require('mongoose');
require('dotenv').config();

// Import User model
const User = require('../models/User');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  divider: () => console.log(`${colors.dim}${'='.repeat(80)}${colors.reset}`)
};

async function fetchAllSuppliers() {
  try {
    // Connect to MongoDB
    log.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    log.success('Connected to MongoDB');
    log.divider();

    // Fetch all suppliers
    log.info('Fetching all suppliers...');
    const suppliers = await User.find({ role: 'supplier' })
      .select('-password') // Exclude password
      .sort({ createdAt: -1 })
      .lean();

    log.success(`Found ${suppliers.length} supplier(s)`);
    log.divider();

    if (suppliers.length === 0) {
      log.warning('No suppliers found in the database');
      return;
    }

    // Group by status
    const grouped = {
      pending: [],
      pending_supply_chain: [],
      pending_head_of_business: [],
      pending_finance: [],
      approved: [],
      rejected: [],
      suspended: [],
      inactive: []
    };

    suppliers.forEach(supplier => {
      const status = supplier.supplierStatus?.accountStatus || 'unknown';
      if (grouped[status]) {
        grouped[status].push(supplier);
      }
    });

    // Display summary
    log.header('📊 SUPPLIER SUMMARY');
    console.log(`Total Suppliers: ${colors.bright}${suppliers.length}${colors.reset}`);
    console.log(`Pending Review: ${colors.yellow}${grouped.pending.length}${colors.reset}`);
    console.log(`Pending Supply Chain: ${colors.yellow}${grouped.pending_supply_chain.length}${colors.reset}`);
    console.log(`Pending Executive: ${colors.blue}${grouped.pending_head_of_business.length}${colors.reset}`);
    console.log(`Pending Finance: ${colors.magenta}${grouped.pending_finance.length}${colors.reset}`);
    console.log(`Approved: ${colors.green}${grouped.approved.length}${colors.reset}`);
    console.log(`Rejected: ${colors.red}${grouped.rejected.length}${colors.reset}`);
    console.log(`Suspended: ${colors.red}${grouped.suspended.length}${colors.reset}`);
    log.divider();

    // Display detailed information for each supplier
    log.header('📋 DETAILED SUPPLIER LIST');
    
    suppliers.forEach((supplier, index) => {
      console.log(`\n${colors.bright}${index + 1}. ${supplier.supplierDetails?.companyName || 'N/A'}${colors.reset}`);
      console.log(`   ID: ${supplier._id}`);
      console.log(`   Email: ${supplier.email}`);
      console.log(`   Contact: ${supplier.supplierDetails?.contactName || 'N/A'}`);
      console.log(`   Phone: ${supplier.supplierDetails?.phoneNumber || 'N/A'}`);
      console.log(`   Type: ${supplier.supplierDetails?.supplierType || 'N/A'}`);
      
      const status = supplier.supplierStatus?.accountStatus || 'unknown';
      let statusColor = colors.white;
      if (status === 'approved') statusColor = colors.green;
      else if (status === 'rejected') statusColor = colors.red;
      else if (status.includes('pending')) statusColor = colors.yellow;
      
      console.log(`   Status: ${statusColor}${status}${colors.reset}`);
      console.log(`   Active: ${supplier.isActive ? colors.green + 'Yes' : colors.red + 'No'}${colors.reset}`);
      console.log(`   Email Verified: ${supplier.supplierStatus?.emailVerified ? colors.green + 'Yes' : colors.red + 'No'}${colors.reset}`);
      
      // Approval chain info
      if (supplier.approvalChain && supplier.approvalChain.length > 0) {
        console.log(`   Approval Progress: ${supplier.currentApprovalLevel || 0}/${supplier.approvalChain.length}`);
        
        const approvedCount = supplier.approvalChain.filter(s => s.status === 'approved').length;
        const progress = Math.round((approvedCount / supplier.approvalChain.length) * 100);
        console.log(`   Progress: ${progress}%`);
        
        console.log(`   Approval Chain:`);
        supplier.approvalChain.forEach(step => {
          let stepColor = colors.white;
          if (step.status === 'approved') stepColor = colors.green;
          else if (step.status === 'rejected') stepColor = colors.red;
          else if (step.status === 'pending') stepColor = colors.yellow;
          
          console.log(`      Level ${step.level}: ${step.approver.name} (${step.approver.role}) - ${stepColor}${step.status}${colors.reset}`);
        });
      } else {
        console.log(`   ${colors.red}No approval chain initialized${colors.reset}`);
      }
      
      // Registration date
      console.log(`   Registered: ${new Date(supplier.createdAt).toLocaleDateString('en-GB')} ${new Date(supplier.createdAt).toLocaleTimeString('en-GB')}`);
      
      // Business details
      if (supplier.supplierDetails?.businessRegistrationNumber) {
        console.log(`   Business Reg: ${supplier.supplierDetails.businessRegistrationNumber}`);
      }
      if (supplier.supplierDetails?.taxIdNumber) {
        console.log(`   Tax ID: ${supplier.supplierDetails.taxIdNumber}`);
      }
      
      // Documents
      if (supplier.supplierDetails?.documents) {
        const docs = supplier.supplierDetails.documents;
        const docCount = 
          (docs.businessRegistrationCertificate ? 1 : 0) +
          (docs.taxClearanceCertificate ? 1 : 0) +
          (docs.bankStatement ? 1 : 0) +
          (docs.insuranceCertificate ? 1 : 0) +
          (docs.additionalDocuments?.length || 0);
        
        console.log(`   Documents: ${docCount} uploaded`);
      }
    });

    log.divider();

    // Display by status
    log.header('📊 SUPPLIERS BY STATUS');
    
    Object.keys(grouped).forEach(status => {
      if (grouped[status].length > 0) {
        console.log(`\n${colors.bright}${status.toUpperCase().replace(/_/g, ' ')}:${colors.reset}`);
        grouped[status].forEach(supplier => {
          console.log(`   • ${supplier.supplierDetails?.companyName || 'N/A'} (${supplier.email})`);
        });
      }
    });

    log.divider();

    // Export options
    log.header('💾 EXPORT OPTIONS');
    console.log('Run with flags:');
    console.log('  node scripts/fetchAllSuppliers.js --json      Export to JSON');
    console.log('  node scripts/fetchAllSuppliers.js --csv       Export to CSV');
    console.log('  node scripts/fetchAllSuppliers.js --emails    List all emails');
    
    // Check for command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--json')) {
      const fs = require('fs');
      const filename = `suppliers-export-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(suppliers, null, 2));
      log.success(`Exported to ${filename}`);
    }
    
    if (args.includes('--csv')) {
      const fs = require('fs');
      const filename = `suppliers-export-${Date.now()}.csv`;
      
      const csvHeaders = [
        'ID', 'Email', 'Company Name', 'Contact Name', 'Phone', 
        'Supplier Type', 'Status', 'Active', 'Email Verified', 
        'Approval Progress', 'Created Date'
      ].join(',');
      
      const csvRows = suppliers.map(s => {
        const approvedCount = s.approvalChain?.filter(step => step.status === 'approved').length || 0;
        const totalLevels = s.approvalChain?.length || 0;
        const progress = totalLevels > 0 ? Math.round((approvedCount / totalLevels) * 100) : 0;
        
        return [
          s._id,
          s.email,
          `"${s.supplierDetails?.companyName || 'N/A'}"`,
          `"${s.supplierDetails?.contactName || 'N/A'}"`,
          s.supplierDetails?.phoneNumber || 'N/A',
          s.supplierDetails?.supplierType || 'N/A',
          s.supplierStatus?.accountStatus || 'unknown',
          s.isActive ? 'Yes' : 'No',
          s.supplierStatus?.emailVerified ? 'Yes' : 'No',
          `${progress}%`,
          new Date(s.createdAt).toISOString()
        ].join(',');
      }).join('\n');
      
      fs.writeFileSync(filename, csvHeaders + '\n' + csvRows);
      log.success(`Exported to ${filename}`);
    }
    
    if (args.includes('--emails')) {
      console.log('\n📧 All Supplier Emails:');
      suppliers.forEach(s => {
        console.log(`   ${s.email} - ${s.supplierDetails?.companyName || 'N/A'}`);
      });
    }

  } catch (error) {
    log.error('Error fetching suppliers:');
    console.error(error);
  } finally {
    // Close connection
    await mongoose.connection.close();
    log.info('Database connection closed');
  }
}

// Run the script
fetchAllSuppliers().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});