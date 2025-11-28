require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas\n');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

async function getAllUsers(options = {}) {
  try {
    console.log('📊 FETCHING ALL USERS FROM DATABASE');
    console.log('='.repeat(80) + '\n');

    await connectDB();

    // Build query based on options
    const query = {};
    
    if (options.role) {
      query.role = options.role;
    }
    
    if (options.isActive !== undefined) {
      query.isActive = options.isActive;
    }
    
    if (options.department) {
      query.department = options.department;
    }

    // Fetch users with populated references
    const users = await User.find(query)
      .populate('supervisor', 'fullName email position department')
      .populate('departmentHead', 'fullName email position')
      .populate('directReports', 'fullName email position department')
      .populate('supplierStatus.approvedBy', 'fullName email')
      .populate('hierarchyUpdatedBy', 'fullName email')
      .lean()
      .sort({ department: 1, hierarchyLevel: -1, fullName: 1 });

    console.log(`Found ${users.length} users\n`);

    // Display summary
    displaySummary(users);

    // Display detailed info if requested
    if (options.detailed) {
      displayDetailedUsers(users);
    }

    // Export to JSON if requested
    if (options.export) {
      exportToJSON(users, options.export);
    }

    // Export to CSV if requested
    if (options.csv) {
      exportToCSV(users, options.csv);
    }

    return users;

  } catch (error) {
    console.error('\n❌ Error fetching users:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

function displaySummary(users) {
  console.log('📈 SUMMARY');
  console.log('-'.repeat(80));
  
  // Count by role
  const byRole = {};
  users.forEach(user => {
    byRole[user.role] = (byRole[user.role] || 0) + 1;
  });
  
  console.log('\n👥 Users by Role:');
  Object.entries(byRole).sort((a, b) => b[1] - a[1]).forEach(([role, count]) => {
    console.log(`   ${role.padEnd(20)}: ${count}`);
  });

  // Count by department (non-suppliers)
  const byDept = {};
  users.filter(u => u.role !== 'supplier' && u.department).forEach(user => {
    byDept[user.department] = (byDept[user.department] || 0) + 1;
  });
  
  if (Object.keys(byDept).length > 0) {
    console.log('\n🏢 Users by Department:');
    Object.entries(byDept).sort((a, b) => b[1] - a[1]).forEach(([dept, count]) => {
      console.log(`   ${dept.padEnd(20)}: ${count}`);
    });
  }

  // Active vs Inactive
  const active = users.filter(u => u.isActive).length;
  const inactive = users.filter(u => !u.isActive).length;
  
  console.log('\n📊 Status:');
  console.log(`   Active               : ${active}`);
  console.log(`   Inactive             : ${inactive}`);

  // Suppliers stats
  const suppliers = users.filter(u => u.role === 'supplier');
  if (suppliers.length > 0) {
    const suppliersByStatus = {};
    suppliers.forEach(s => {
      const status = s.supplierStatus?.accountStatus || 'unknown';
      suppliersByStatus[status] = (suppliersByStatus[status] || 0) + 1;
    });
    
    console.log('\n🏪 Supplier Status:');
    Object.entries(suppliersByStatus).forEach(([status, count]) => {
      console.log(`   ${status.padEnd(20)}: ${count}`);
    });
  }

  // Buyers stats
  const buyers = users.filter(u => u.role === 'buyer');
  if (buyers.length > 0) {
    console.log('\n🛒 Buyers:');
    console.log(`   Total buyers         : ${buyers.length}`);
    const availableBuyers = buyers.filter(b => b.buyerDetails?.availability?.isAvailable);
    console.log(`   Available            : ${availableBuyers.length}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

function displayDetailedUsers(users) {
  console.log('📋 DETAILED USER LIST');
  console.log('='.repeat(80) + '\n');

  // Group by department
  const grouped = {};
  users.forEach(user => {
    const key = user.role === 'supplier' ? 'SUPPLIERS' : (user.department || 'NO DEPARTMENT');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(user);
  });

  // Display each group
  Object.entries(grouped).sort().forEach(([dept, deptUsers]) => {
    console.log(`\n${'▼'.repeat(40)}`);
    console.log(`📁 ${dept.toUpperCase()} (${deptUsers.length} users)`);
    console.log('▼'.repeat(40));
    
    deptUsers.forEach((user, idx) => {
      console.log(`\n${idx + 1}. ${user.fullName || 'Unnamed'}`);
      console.log(`   Email            : ${user.email}`);
      console.log(`   Role             : ${user.role}`);
      console.log(`   Active           : ${user.isActive ? '✅' : '❌'}`);
      
      if (user.role !== 'supplier') {
        console.log(`   Position         : ${user.position || 'N/A'}`);
        console.log(`   Hierarchy Level  : ${user.hierarchyLevel || 1}`);
        
        if (user.supervisor) {
          console.log(`   Supervisor       : ${user.supervisor.fullName} (${user.supervisor.position})`);
        }
        
        if (user.departmentHead) {
          console.log(`   Dept Head        : ${user.departmentHead.fullName}`);
        }
        
        if (user.directReports && user.directReports.length > 0) {
          console.log(`   Direct Reports   : ${user.directReports.length}`);
          user.directReports.forEach(report => {
            console.log(`      - ${report.fullName} (${report.position})`);
          });
        }
        
        if (user.approvalCapacities && user.approvalCapacities.length > 0) {
          console.log(`   Approval Powers  : ${user.approvalCapacities.join(', ')}`);
        }
      }
      
      // Supplier specific
      if (user.role === 'supplier' && user.supplierDetails) {
        console.log(`   Company          : ${user.supplierDetails.companyName}`);
        console.log(`   Type             : ${user.supplierDetails.supplierType}`);
        console.log(`   Status           : ${user.supplierStatus?.accountStatus || 'unknown'}`);
        console.log(`   Verified         : ${user.supplierStatus?.emailVerified ? '✅' : '❌'}`);
      }
      
      // Buyer specific
      if (user.role === 'buyer' && user.buyerDetails) {
        if (user.buyerDetails.specializations?.length > 0) {
          console.log(`   Specializations  : ${user.buyerDetails.specializations.join(', ')}`);
        }
        console.log(`   Max Order Value  : ${user.buyerDetails.maxOrderValue?.toLocaleString()} XAF`);
        console.log(`   Available        : ${user.buyerDetails.availability?.isAvailable ? '✅' : '❌'}`);
      }
      
      console.log(`   Created          : ${new Date(user.createdAt).toLocaleDateString()}`);
      if (user.lastLogin) {
        console.log(`   Last Login       : ${new Date(user.lastLogin).toLocaleDateString()}`);
      }
    });
  });
  
  console.log('\n' + '='.repeat(80) + '\n');
}

function exportToJSON(users, filename = 'users_export') {
  try {
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filepath = path.join(exportDir, `${filename}_${timestamp}.json`);

    // Remove sensitive data
    const sanitizedUsers = users.map(user => {
      const { password, verificationToken, ...safeUser } = user;
      return safeUser;
    });

    fs.writeFileSync(filepath, JSON.stringify(sanitizedUsers, null, 2));
    
    console.log(`✅ Exported to JSON: ${filepath}`);
    console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB\n`);
  } catch (error) {
    console.error('❌ Export to JSON failed:', error.message);
  }
}

function exportToCSV(users, filename = 'users_export') {
  try {
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filepath = path.join(exportDir, `${filename}_${timestamp}.csv`);

    // CSV headers
    const headers = [
      'Full Name', 'Email', 'Role', 'Department', 'Position', 
      'Active', 'Hierarchy Level', 'Supervisor', 'Direct Reports Count',
      'Approval Capacities', 'Created At', 'Last Login'
    ];

    // Build CSV rows
    const rows = users.map(user => [
      `"${user.fullName || ''}"`,
      `"${user.email}"`,
      `"${user.role}"`,
      `"${user.department || ''}"`,
      `"${user.position || ''}"`,
      user.isActive ? 'Yes' : 'No',
      user.hierarchyLevel || 1,
      `"${user.supervisor?.fullName || ''}"`,
      user.directReports?.length || 0,
      `"${user.approvalCapacities?.join(', ') || ''}"`,
      new Date(user.createdAt).toISOString(),
      user.lastLogin ? new Date(user.lastLogin).toISOString() : ''
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    fs.writeFileSync(filepath, csv);
    
    console.log(`✅ Exported to CSV: ${filepath}`);
    console.log(`   Rows: ${users.length}`);
    console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB\n`);
  } catch (error) {
    console.error('❌ Export to CSV failed:', error.message);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    detailed: false,
    export: false,
    csv: false,
    role: null,
    isActive: undefined,
    department: null
  };

  args.forEach(arg => {
    if (arg === '--detailed' || arg === '-d') {
      options.detailed = true;
    } else if (arg === '--export' || arg === '-e') {
      options.export = 'users_export';
    } else if (arg === '--csv' || arg === '-c') {
      options.csv = 'users_export';
    } else if (arg.startsWith('--role=')) {
      options.role = arg.split('=')[1];
    } else if (arg === '--active') {
      options.isActive = true;
    } else if (arg === '--inactive') {
      options.isActive = false;
    } else if (arg.startsWith('--department=')) {
      options.department = arg.split('=')[1];
    }
  });

  return options;
}

// Run the script
if (require.main === module) {
  const options = parseArgs();
  
  getAllUsers(options)
    .then(() => {
      console.log('✅ Done!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { getAllUsers };