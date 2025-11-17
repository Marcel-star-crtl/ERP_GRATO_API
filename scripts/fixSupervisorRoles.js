// scripts/fixSupervisorRoles.js - Fix Invalid Supervisor Roles
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Fix Script: Convert 'supervisor' role to appropriate valid roles
 * 
 * The 'supervisor' is a RELATIONSHIP (who reports to whom), NOT a role.
 * This script determines the correct role based on position/department.
 * 
 * Run with: node scripts/fixSupervisorRoles.js
 */

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// Determine correct role based on position and department
function determineCorrectRole(position, department, email) {
  // Technical Department
  if (department === 'Technical') {
    if (position.includes('Director')) return 'technical';
    if (position.includes('HSE')) return 'hse';
    if (position.includes('Manager')) return 'technical';
    if (position.includes('Coordinator')) return 'technical';
    if (position.includes('Supervisor')) return 'employee'; // Site Supervisors are employees who supervise
    return 'employee';
  }
  
  // Business Development & Supply Chain
  if (department === 'Business Development & Supply Chain') {
    if (position.includes('President') || position.includes('Head of Business')) return 'admin';
    if (position.includes('Finance')) return 'finance';
    if (position.includes('Supply Chain Coordinator')) return 'supply_chain';
    if (position.includes('Buyer')) return 'buyer';
    if (position.includes('Warehouse Coordinator')) return 'buyer';
    return 'employee';
  }
  
  // HR & Admin
  if (department === 'HR & Admin') {
    if (position.includes('Head')) return 'hr';
    if (position.includes('IT')) return 'it';
    return 'employee';
  }
  
  // Specific email overrides
  const emailRoleMap = {
    'minka.kevin@gratoglobal.com': 'technical', // Diesel Coordinator
    'rodrigue.nono@gratoglobal.com': 'technical', // NOC Coordinator
    'joseph.tayou@gratoglobal.com': 'employee', // Site Supervisor
    'felix.tientcheu@gratoglobal.com': 'employee' // Site Supervisor
  };
  
  if (emailRoleMap[email]) {
    return emailRoleMap[email];
  }
  
  // Default
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

// Fix all users with invalid roles
async function fixSupervisorRoles() {
  const startTime = Date.now();
  
  try {
    console.log('🔧 FIXING INVALID SUPERVISOR ROLES');
    console.log('=' .repeat(60));
    
    await connectDB();

    // Find all users with 'supervisor' role (which is invalid)
    const invalidUsers = await User.find({ 
      role: 'supervisor'
    }).select('fullName email position department role');

    if (invalidUsers.length === 0) {
      console.log('✅ No users with invalid "supervisor" role found.\n');
      
      // Also check for any other invalid roles
      const allUsers = await User.find({ 
        role: { $ne: 'supplier' } 
      }).select('fullName email role');
      
      const validRoles = ['employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'];
      const usersWithInvalidRoles = allUsers.filter(u => !validRoles.includes(u.role));
      
      if (usersWithInvalidRoles.length > 0) {
        console.log('⚠️  Found users with other invalid roles:');
        usersWithInvalidRoles.forEach(u => {
          console.log(`  - ${u.fullName}: "${u.role}"`);
        });
      }
      
      process.exit(0);
    }

    console.log(`Found ${invalidUsers.length} users with invalid "supervisor" role:\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of invalidUsers) {
      try {
        const correctRole = determineCorrectRole(
          user.position, 
          user.department, 
          user.email
        );

        console.log(`\n📝 ${user.fullName}`);
        console.log(`   Position: ${user.position}`);
        console.log(`   Department: ${user.department}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Current Role: supervisor (INVALID)`);
        console.log(`   New Role: ${correctRole}`);

        // Update the user
        user.role = correctRole;
        await user.save();

        console.log(`   ✅ Updated successfully`);
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
    console.log(`📝 Total processed: ${invalidUsers.length}`);
    console.log(`⏱️  Duration: ${duration} seconds\n`);

    // Validation check
    console.log('🔍 VALIDATION');
    console.log('='.repeat(60));
    
    const stillInvalid = await User.find({ role: 'supervisor' }).select('fullName email');
    
    if (stillInvalid.length === 0) {
      console.log('✅ All users now have valid roles!\n');
    } else {
      console.log(`⚠️  ${stillInvalid.length} users still have invalid roles:`);
      stillInvalid.forEach(u => {
        console.log(`  - ${u.fullName} (${u.email})`);
      });
    }

    // Show role distribution
    const roleStats = await User.aggregate([
      { $match: { role: { $ne: 'supplier' }, isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📊 ROLE DISTRIBUTION');
    console.log('='.repeat(60));
    roleStats.forEach(stat => {
      console.log(`${stat._id}: ${stat.count} users`);
    });

    console.log('\n🎉 Fix completed!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ FIX FAILED:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Also fix users with missing position/department (from the error log)
async function fixMissingFields() {
  try {
    console.log('🔧 FIXING USERS WITH MISSING REQUIRED FIELDS');
    console.log('=' .repeat(60));
    
    await connectDB();

    // Find users without position or department (but not suppliers)
    const usersWithMissingFields = await User.find({
      role: { $ne: 'supplier' },
      $or: [
        { position: { $exists: false } },
        { position: null },
        { position: '' },
        { department: { $exists: false } },
        { department: null },
        { department: '' }
      ]
    }).select('fullName email role position department');

    if (usersWithMissingFields.length === 0) {
      console.log('✅ No users with missing fields found.\n');
      process.exit(0);
    }

    console.log(`Found ${usersWithMissingFields.length} users with missing fields:\n`);

    for (const user of usersWithMissingFields) {
      console.log(`\n⚠️  ${user.fullName || 'Unnamed User'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Position: ${user.position || 'MISSING'}`);
      console.log(`   Department: ${user.department || 'MISSING'}`);
      console.log(`   Action: Should be manually reviewed or deleted`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Options:');
    console.log('1. Manually fix these users in the database');
    console.log('2. Delete them if they are test/invalid users');
    console.log('\nTo delete these users, run:');
    console.log('node scripts/fixSupervisorRoles.js cleanup\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

// Cleanup invalid test users
async function cleanupInvalidUsers() {
  try {
    console.log('🗑️  CLEANING UP INVALID USERS');
    console.log('=' .repeat(60));
    console.log('⚠️  WARNING: This will delete users without position/department\n');
    
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

    console.log(`Found ${usersToDelete.length} invalid users:\n`);
    usersToDelete.forEach(u => {
      console.log(`  - ${u.fullName || 'Unnamed'} (${u.email})`);
    });

    console.log('\nDeleting...\n');

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

    console.log(`✅ Deleted ${result.deletedCount} invalid users\n`);
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
    fixSupervisorRoles();
    break;
  case 'check':
    fixMissingFields();
    break;
  case 'cleanup':
    cleanupInvalidUsers();
    break;
  default:
    console.log(`
Usage:
  node scripts/fixSupervisorRoles.js [command]

Commands:
  fix       - Fix users with invalid "supervisor" role
  check     - Check for users with missing position/department
  cleanup   - Delete users with missing required fields (CAREFUL!)

Examples:
  node scripts/fixSupervisorRoles.js fix
  node scripts/fixSupervisorRoles.js check
  node scripts/fixSupervisorRoles.js cleanup
    `);
    process.exit(0);
}

module.exports = { fixSupervisorRoles, fixMissingFields, cleanupInvalidUsers };