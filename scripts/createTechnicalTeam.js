// scripts/createTechnicalTeam.js
/**
 * BULK USER CREATION SCRIPT
 * Creates technical team members and NOC operators with proper hierarchy
 * 
 * IMPORTANT: Backup database before running!
 * 
 * Usage: node scripts/createTechnicalTeam.js
 */

const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

// Technical team data from the contact list
const TECHNICAL_TEAM = [
  // Bonaberi 1
  {
    fullName: 'Boris Kamgang',
    email: 'kamgang.junior@gratoglobal.com',
    phone: '672037042',
    cluster: 'Bonaberi 1',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  {
    fullName: 'Sunday',
    email: 'sunday@gratoglobal.com', // Create appropriate email
    phone: '671308804',
    cluster: 'Bonaberi 1',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  
  // Bonaberi 2
  {
    fullName: 'Urich MOUMI',
    email: 'ulrich.vitrand@gratoglobal.com',
    phone: '681475120',
    cluster: 'Bonaberi 2',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  {
    fullName: 'Abeeb',
    email: 'abeeb@gratoglobal.com', // Create appropriate email
    phone: '680986406',
    cluster: 'Bonaberi 2',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  
  // Edea
  {
    fullName: 'Paul EM Nyomb',
    email: 'paul.nyomb@gratoglobal.com',
    phone: '670079389',
    cluster: 'Edea',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  {
    fullName: 'EDIDIE François',
    email: 'dedidie.francois@gratoglobal.com',
    phone: '659906661',
    cluster: 'Edea',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  
  // Kotto
  {
    fullName: 'Berthin DEFFO',
    email: 'mba.berthin@gratoglobal.com',
    phone: '694205176',
    cluster: 'Kotto',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  
  // Ndogbong
  {
    fullName: 'Allassane',
    email: 'allassane@gratoglobal.com', // Create appropriate email
    phone: '657138377',
    cluster: 'Ndogbong',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  {
    fullName: 'Alioum Moussa',
    email: 'alioum.moussa@gratoglobal.com',
    phone: '650543244',
    cluster: 'Ndogbong',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  
  // Pouma 1
  {
    fullName: 'Kenfack Jacques',
    email: 'kenfack.jacques@gratoglobal.com',
    phone: '651470751',
    cluster: 'Pouma 1',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  
  // Pouma 2
  {
    fullName: 'Djackba Marcel',
    email: 'djackba.marcel@gratoglobal.com',
    phone: '650160759',
    cluster: 'Pouma 2',
    position: 'Field Technician',
    department: 'Technical',
    role: 'employee'
  },
  
  // Supervisors
  {
    fullName: 'Joseph TAYOU',
    email: 'joseph.tayou@gratoglobal.com',
    phone: '673464096',
    cluster: 'Douala',
    position: 'Site Supervisor',
    department: 'Technical',
    role: 'supervisor'
  },
  {
    fullName: 'Felix Tientcheu',
    email: 'felix.tientcheu@gratoglobal.com',
    phone: '650592048',
    cluster: 'Edea',
    position: 'Site Supervisor',
    department: 'Technical',
    role: 'supervisor'
  }
];

// NOC Operators
const NOC_OPERATORS = [
  {
    fullName: 'Junior Mukudi',
    email: 'junior.mukudi@gratoglobal.com',
    position: 'NOC Operator',
    department: 'Technical',
    role: 'employee'
  },
  {
    fullName: 'Danick Djiyap',
    email: 'djiyap.danick@gratoglobal.com',
    position: 'NOC Operator',
    department: 'Technical',
    role: 'employee'
  },
  {
    fullName: 'Wilfried Kamegni',
    email: 'kamegni.wilfried@gratoglobal.com',
    position: 'NOC Operator',
    department: 'Technical',
    role: 'employee'
  },
  {
    fullName: 'Yves Yossa',
    email: 'yossa.yves@gratoglobal.com',
    position: 'NOC Operator',
    department: 'Technical',
    role: 'employee'
  },
  {
    fullName: 'Ervine Mbezele',
    email: 'ervine.mbezele@gratoglobal.com',
    position: 'NOC Operator',
    department: 'Technical',
    role: 'employee'
  }
];

// Receptionist
const RECEPTIONIST = {
  fullName: 'Carmel Dafny',
  email: 'carmel.dafny@gratoglobal.com',
  position: 'Receptionist',
  department: 'HR & Admin',
  role: 'employee'
};

// Default password for all new users (they should change on first login)
const DEFAULT_PASSWORD = 'GratoGlobal2024!';

/**
 * Find supervisor for field technicians based on cluster
 */
const findSupervisorByCluster = async (cluster) => {
  const supervisorMap = {
    'Bonaberi 1': 'joseph.tayou@gratoglobal.com',
    'Bonaberi 2': 'joseph.tayou@gratoglobal.com',
    'Kotto': 'joseph.tayou@gratoglobal.com',
    'Ndogbong': 'joseph.tayou@gratoglobal.com',
    'Pouma 1': 'joseph.tayou@gratoglobal.com',
    'Pouma 2': 'joseph.tayou@gratoglobal.com',
    'Douala': 'joseph.tayou@gratoglobal.com',
    'Edea': 'felix.tientcheu@gratoglobal.com'
  };

  const supervisorEmail = supervisorMap[cluster];
  if (!supervisorEmail) return null;

  return await User.findOne({ email: supervisorEmail });
};

/**
 * Create a single user with hierarchy
 */
const createUser = async (userData, supervisorEmail = null) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      console.log(`⚠️  User ${userData.email} already exists - skipping`);
      return { success: false, reason: 'exists' };
    }

    // Find supervisor
    let supervisor = null;
    let departmentHead = null;

    if (supervisorEmail) {
      supervisor = await User.findOne({ email: supervisorEmail });
    } else if (userData.position === 'Field Technician' && userData.cluster) {
      supervisor = await findSupervisorByCluster(userData.cluster);
    } else if (userData.position === 'Site Supervisor') {
      // Site supervisors report to Operations Manager
      supervisor = await User.findOne({ email: 'pascal.rodrique@gratoglobal.com' });
    } else if (userData.position === 'NOC Operator') {
      // NOC Operators report to NOC Coordinator
      supervisor = await User.findOne({ email: 'rodrigue.nono@gratoglobal.com' });
    } else if (userData.position === 'Receptionist') {
      // Receptionist reports to HR & Admin Head
      supervisor = await User.findOne({ email: 'bruiline.tsitoh@gratoglobal.com' });
    }

    // Find department head
    if (userData.department === 'Technical') {
      departmentHead = await User.findOne({ email: 'didier.oyong@gratoengineering.com' });
    } else if (userData.department === 'HR & Admin') {
      departmentHead = await User.findOne({ email: 'bruiline.tsitoh@gratoglobal.com' });
    }

    // Determine hierarchy level and permissions
    const hierarchyLevel = userData.position === 'Site Supervisor' ? 2 : 1;
    const departmentRole = userData.position === 'Site Supervisor' ? 'supervisor' : 'staff';
    
    const permissions = userData.position === 'Site Supervisor'
      ? ['team_management', 'approvals', 'team_data_access', 'basic_access']
      : ['basic_access', 'submit_requests', 'view_own_data'];

    // Create user object
    const newUser = new User({
      email: userData.email,
      password: DEFAULT_PASSWORD,
      fullName: userData.fullName,
      role: userData.role,
      department: userData.department,
      position: userData.position,
      phone: userData.phone,
      departmentRole,
      hierarchyLevel,
      supervisor: supervisor?._id,
      departmentHead: departmentHead?._id,
      permissions,
      isActive: true,
      emailVerified: true
    });

    await newUser.save();

    // Add to supervisor's directReports
    if (supervisor) {
      if (!supervisor.directReports.includes(newUser._id)) {
        supervisor.directReports.push(newUser._id);
        await supervisor.save();
      }
    }

    console.log(`✅ Created: ${userData.fullName.padEnd(25)} | ${userData.position.padEnd(20)} | ${userData.email}`);
    if (supervisor) {
      console.log(`   └─ Supervisor: ${supervisor.fullName}`);
    }
    if (userData.cluster) {
      console.log(`   └─ Cluster: ${userData.cluster}`);
    }

    return { success: true, user: newUser };

  } catch (error) {
    console.error(`❌ Failed to create ${userData.email}:`, error.message);
    return { success: false, reason: 'error', error: error.message };
  }
};

/**
 * Main execution function
 */
const createTechnicalTeam = async () => {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 BULK USER CREATION - TECHNICAL TEAM & SUPPORT STAFF');
    console.log('='.repeat(80) + '\n');

    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    const results = {
      created: 0,
      existed: 0,
      failed: 0
    };

    // ========================================
    // STEP 1: Create Site Supervisors first
    // ========================================
    console.log('📋 STEP 1: Creating Site Supervisors...');
    console.log('-'.repeat(80));

    const supervisors = TECHNICAL_TEAM.filter(u => u.position === 'Site Supervisor');
    for (const supervisor of supervisors) {
      const result = await createUser(supervisor);
      if (result.success) results.created++;
      else if (result.reason === 'exists') results.existed++;
      else results.failed++;
    }

    console.log('\n');

    // ========================================
    // STEP 2: Create Field Technicians
    // ========================================
    console.log('📋 STEP 2: Creating Field Technicians...');
    console.log('-'.repeat(80));

    const technicians = TECHNICAL_TEAM.filter(u => u.position === 'Field Technician');
    for (const tech of technicians) {
      const result = await createUser(tech);
      if (result.success) results.created++;
      else if (result.reason === 'exists') results.existed++;
      else results.failed++;
    }

    console.log('\n');

    // ========================================
    // STEP 3: Create NOC Operators
    // ========================================
    console.log('📋 STEP 3: Creating NOC Operators...');
    console.log('-'.repeat(80));

    for (const operator of NOC_OPERATORS) {
      const result = await createUser(operator);
      if (result.success) results.created++;
      else if (result.reason === 'exists') results.existed++;
      else results.failed++;
    }

    console.log('\n');

    // ========================================
    // STEP 4: Create Receptionist
    // ========================================
    console.log('📋 STEP 4: Creating Receptionist...');
    console.log('-'.repeat(80));

    const receptionistResult = await createUser(RECEPTIONIST);
    if (receptionistResult.success) results.created++;
    else if (receptionistResult.reason === 'exists') results.existed++;
    else results.failed++;

    console.log('\n');

    // ========================================
    // VERIFICATION & SUMMARY
    // ========================================
    console.log('='.repeat(80));
    console.log('📊 CREATION SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log(`✅ Successfully Created: ${results.created}`);
    console.log(`⚠️  Already Existed: ${results.existed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📝 Total Processed: ${results.created + results.existed + results.failed}\n`);

    // Show supervisor hierarchies
    console.log('👥 SUPERVISOR HIERARCHIES:\n');
    console.log('-'.repeat(80));

    const allSupervisors = await User.find({
      directReports: { $exists: true, $ne: [] }
    })
    .populate('directReports', 'fullName email position')
    .sort({ hierarchyLevel: -1 });

    for (const sup of allSupervisors) {
      if (sup.directReports.length > 0) {
        console.log(`\n📌 ${sup.fullName} (${sup.position || sup.role})`);
        console.log(`   ${sup.email}`);
        console.log(`   Direct Reports (${sup.directReports.length}):`);
        
        sup.directReports.forEach((report, idx) => {
          console.log(`      ${idx + 1}. ${report.fullName} - ${report.position}`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ BULK USER CREATION COMPLETED!');
    console.log('='.repeat(80) + '\n');

    console.log('📝 NEXT STEPS:');
    console.log('   1. All users created with default password: "GratoGlobal2024!"');
    console.log('   2. Users should change password on first login');
    console.log('   3. Verify supervisor relationships in the admin panel');
    console.log('   4. Send welcome emails to new users\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ BULK CREATION FAILED:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
};

// Confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n⚠️  WARNING: This script will create multiple user accounts!');
console.log('   Default password for all users: "GratoGlobal2024!"\n');

rl.question('Do you want to continue? (yes/no): ', (answer) => {
  rl.close();
  
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    createTechnicalTeam();
  } else {
    console.log('\n❌ User creation cancelled\n');
    process.exit(0);
  }
});