// scripts/fixAllInvalidRoles.js - Fix ALL Invalid User Roles
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Comprehensive Fix: Handle all invalid roles
 * - USER (uppercase) → employee
 * - supervisor → appropriate role
 * - Any other invalid role
 * 
 * Run with: node scripts/fixAllInvalidRoles.js
 */

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// Valid roles from your User schema
const VALID_ROLES = [
  'employee',
  'finance',
  'admin',
  'buyer',
  'hr',
  'supply_chain',
  'technical',
  'hse',
  'supplier',
  'it',
  'project'
];

// Determine correct role based on available data
function determineCorrectRole(user) {
  const position = user.position || '';
  const department = user.department || '';
  const email = user.email || '';
  
  // Handle specific known cases
  if (email.includes('kelvin.eyong')) return 'admin';
  if (email.includes('didier.oyong')) return 'technical';
  if (email.includes('bruiline.tsitoh')) return 'hr';
  if (email.includes('lukong.lambert')) return 'supply_chain';
  if (email.includes('ranibellmambo')) return 'finance';
  
  // Based on position keywords
  if (position) {
    if (position.includes('President') || position.includes('Director')) return 'admin';
    if (position.includes('Finance')) return 'finance';
    if (position.includes('Buyer')) return 'buyer';
    if (position.includes('IT')) return 'it';
    if (position.includes('HSE')) return 'hse';
    if (position.includes('Supply Chain')) return 'supply_chain';
    if (position.includes('HR') || position.includes('Head') && department === 'HR & Admin') return 'hr';
  }
  
  // Based on department
  if (department === 'Technical') {
    if (position.includes('Manager') || position.includes('Coordinator')) return 'technical';
  }
  
  // Default to employee
  return 'employee';
}

// Connect to database
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

// Main fix function
async function fixAllInvalidRoles() {
  const startTime = Date.now();
  
  try {
    console.log('🔧 FIXING ALL INVALID ROLES');
    console.log('=' .repeat(60));
    console.log('Valid roles:', VALID_ROLES.join(', '));
    console.log('=' .repeat(60) + '\n');
    
    await connectDB();

    // Find all users with invalid roles
    const allUsers = await User.find({
      role: { $nin: VALID_ROLES }
    }).select('fullName email position department role isActive');

    if (allUsers.length === 0) {
      console.log('✅ All users have valid roles!\n');
      
      // Show role distribution
      await showRoleDistribution();
      process.exit(0);
    }

    console.log(`Found ${allUsers.length} users with invalid roles:\n`);

    let successCount = 0;
    let errorCount = 0;
    const changes = [];

    for (const user of allUsers) {
      try {
        const oldRole = user.role;
        const newRole = determineCorrectRole(user);

        console.log(`\n📝 ${user.fullName || 'Unnamed User'}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Position: ${user.position || 'N/A'}`);
        console.log(`   Department: ${user.department || 'N/A'}`);
        console.log(`   Current Role: "${oldRole}" (INVALID)`);
        console.log(`   New Role: "${newRole}"`);

        // Update the user
        user.role = newRole;
        await user.save();

        console.log(`   ✅ Updated successfully`);
        
        changes.push({
          name: user.fullName || 'Unnamed',
          email: user.email,
          oldRole,
          newRole
        });
        
        successCount++;

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully fixed: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Total processed: ${allUsers.length}`);
    console.log(`⏱️  Duration: ${duration} seconds\n`);

    // Show changes made
    if (changes.length > 0) {
      console.log('📋 CHANGES MADE');
      console.log('='.repeat(60));
      changes.forEach(change => {
        console.log(`${change.name} (${change.email})`);
        console.log(`  ${change.oldRole} → ${change.newRole}\n`);
      });
    }

    // Validation check
    console.log('🔍 VALIDATION');
    console.log('='.repeat(60));
    
    const stillInvalid = await User.find({ 
      role: { $nin: VALID_ROLES } 
    }).select('fullName email role');
    
    if (stillInvalid.length === 0) {
      console.log('✅ All users now have valid roles!\n');
    } else {
      console.log(`⚠️  ${stillInvalid.length} users still have invalid roles:`);
      stillInvalid.forEach(u => {
        console.log(`  - ${u.fullName || 'Unnamed'} (${u.email}): "${u.role}"`);
      });
      console.log('');
    }

    // Show role distribution
    await showRoleDistribution();

    console.log('🎉 Fix completed!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ FIX FAILED:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Show current role distribution
async function showRoleDistribution() {
  const roleStats = await User.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  console.log('📊 CURRENT ROLE DISTRIBUTION');
  console.log('='.repeat(60));
  roleStats.forEach(stat => {
    const isValid = VALID_ROLES.includes(stat._id);
    const marker = isValid ? '✅' : '❌';
    console.log(`${marker} ${stat._id}: ${stat.count} users`);
  });
  console.log('');
}

// Check for users with missing critical fields
async function checkMissingFields() {
  try {
    console.log('🔍 CHECKING FOR USERS WITH MISSING FIELDS');
    console.log('=' .repeat(60) + '\n');
    
    await connectDB();

    // Check for missing position/department
    const missingFields = await User.find({
      role: { $ne: 'supplier' },
      $or: [
        { position: { $exists: false } },
        { position: null },
        { position: '' },
        { department: { $exists: false } },
        { department: null },
        { department: '' },
        { fullName: { $exists: false } },
        { fullName: null },
        { fullName: '' }
      ]
    }).select('fullName email role position department isActive');

    if (missingFields.length === 0) {
      console.log('✅ All users have required fields!\n');
      process.exit(0);
    }

    console.log(`⚠️  Found ${missingFields.length} users with missing fields:\n`);

    const issues = {
      noPosition: [],
      noDepartment: [],
      noName: [],
      multiple: []
    };

    for (const user of missingFields) {
      const missing = [];
      if (!user.fullName) missing.push('fullName');
      if (!user.position) missing.push('position');
      if (!user.department) missing.push('department');

      console.log(`\n${user.fullName || 'UNNAMED USER'}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Active: ${user.isActive}`);
      console.log(`  Missing: ${missing.join(', ')}`);

      if (missing.length > 1) {
        issues.multiple.push(user);
      } else if (!user.fullName) {
        issues.noName.push(user);
      } else if (!user.position) {
        issues.noPosition.push(user);
      } else if (!user.department) {
        issues.noDepartment.push(user);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 ISSUE BREAKDOWN');
    console.log('='.repeat(60));
    console.log(`Missing fullName only: ${issues.noName.length}`);
    console.log(`Missing position only: ${issues.noPosition.length}`);
    console.log(`Missing department only: ${issues.noDepartment.length}`);
    console.log(`Missing multiple fields: ${issues.multiple.length}`);

    console.log('\n💡 RECOMMENDATIONS');
    console.log('='.repeat(60));
    console.log('1. Review these users manually in the database');
    console.log('2. Delete test/invalid users with: node scripts/fixAllInvalidRoles.js cleanup');
    console.log('3. Or manually update them with correct information\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

// Cleanup users with missing required fields
async function cleanupInvalidUsers() {
  try {
    console.log('🗑️  CLEANING UP INVALID USERS');
    console.log('=' .repeat(60));
    console.log('⚠️  WARNING: This will delete users with missing required fields\n');
    
    await connectDB();

    const usersToDelete = await User.find({
      role: { $ne: 'supplier' },
      $or: [
        { position: { $exists: false } },
        { position: null },
        { position: '' },
        { department: { $exists: false } },
        { department: null },
        { department: '' }
      ]
    }).select('fullName email role');

    if (usersToDelete.length === 0) {
      console.log('✅ No invalid users to delete.\n');
      process.exit(0);
    }

    console.log(`Found ${usersToDelete.length} users to delete:\n`);
    usersToDelete.forEach(u => {
      console.log(`  ❌ ${u.fullName || 'Unnamed'} (${u.email}) - Role: ${u.role}`);
    });

    console.log('\n⚠️  Deleting in 3 seconds... (Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const result = await User.deleteMany({
      role: { $ne: 'supplier' },
      $or: [
        { position: { $exists: false } },
        { position: null },
        { position: '' },
        { department: { $exists: false } },
        { department: null },
        { department: '' }
      ]
    });

    console.log(`\n✅ Deleted ${result.deletedCount} invalid users\n`);
    
    // Show remaining users
    const remaining = await User.countDocuments({ 
      role: { $ne: 'supplier' },
      isActive: true 
    });
    console.log(`📊 Remaining active users: ${remaining}\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

// Show all users with their roles
async function listAllUsers() {
  try {
    console.log('📋 ALL USERS LIST');
    console.log('=' .repeat(60) + '\n');
    
    await connectDB();

    const users = await User.find({ 
      role: { $ne: 'supplier' } 
    })
    .select('fullName email role department position isActive')
    .sort({ department: 1, role: 1, fullName: 1 });

    const byDepartment = {};
    
    users.forEach(user => {
      const dept = user.department || 'Unknown';
      if (!byDepartment[dept]) {
        byDepartment[dept] = [];
      }
      byDepartment[dept].push(user);
    });

    for (const [dept, deptUsers] of Object.entries(byDepartment)) {
      console.log(`\n📁 ${dept} (${deptUsers.length} users)`);
      console.log('-'.repeat(60));
      
      deptUsers.forEach(user => {
        const statusIcon = user.isActive ? '✅' : '❌';
        const roleIcon = VALID_ROLES.includes(user.role) ? '✓' : '✗';
        console.log(`${statusIcon} ${user.fullName || 'Unnamed'}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role} ${roleIcon}`);
        console.log(`   Position: ${user.position || 'N/A'}\n`);
      });
    }

    console.log('=' .repeat(60));
    console.log(`Total: ${users.length} users\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

// Run based on command
const command = process.argv[2];

switch (command) {
  case 'fix':
    fixAllInvalidRoles();
    break;
  case 'check':
    checkMissingFields();
    break;
  case 'cleanup':
    cleanupInvalidUsers();
    break;
  case 'list':
    listAllUsers();
    break;
  default:
    console.log(`
Usage:
  node scripts/fixAllInvalidRoles.js [command]

Commands:
  fix       - Fix ALL users with invalid roles (USER, supervisor, etc.)
  check     - Check for users with missing position/department
  cleanup   - Delete users with missing required fields (CAREFUL!)
  list      - List all users with their current roles

Examples:
  node scripts/fixAllInvalidRoles.js fix
  node scripts/fixAllInvalidRoles.js check
  node scripts/fixAllInvalidRoles.js list
  node scripts/fixAllInvalidRoles.js cleanup
    `);
    process.exit(0);
}

module.exports = { fixAllInvalidRoles, checkMissingFields, cleanupInvalidUsers, listAllUsers };