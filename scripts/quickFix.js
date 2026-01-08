require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

async function fixValidationIssues() {
  try {
    console.log('🔧 QUICK FIX - Validation Issues');
    console.log('='.repeat(60) + '\n');

    await connectDB();

    // Fix 1: Delete or deactivate users without position/department
    console.log('1️⃣ Finding users without position/department...\n');
    
    const invalidUsers = await User.find({
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

    if (invalidUsers.length > 0) {
      console.log(`Found ${invalidUsers.length} invalid users:\n`);
      
      for (const user of invalidUsers) {
        console.log(`  ❌ ${user.fullName || 'Unnamed'} (${user.email})`);
      }

      console.log('\nOptions:');
      console.log('  A. Delete them (recommended for test users)');
      console.log('  B. Deactivate them (keeps data but prevents login)\n');

      // For now, let's just deactivate to be safe
      const result = await User.updateMany(
        {
          role: { $ne: 'supplier' },
          $or: [
            { position: { $exists: false } },
            { position: null },
            { position: '' },
            { department: { $exists: false } },
            { department: null },
            { department: '' }
          ]
        },
        {
          $set: { isActive: false }
        }
      );

      console.log(`✅ Deactivated ${result.modifiedCount} users\n`);
    } else {
      console.log('✅ No invalid users found\n');
    }

    // Fix 2: Show users with invalid roles
    console.log('2️⃣ Checking for invalid roles...\n');
    
    const validRoles = ['employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'];
    
    const invalidRoles = await User.find({
      role: { $nin: validRoles }
    });

    if (invalidRoles.length > 0) {
      console.log(`Found ${invalidRoles.length} users with invalid roles:\n`);
      
      for (const user of invalidRoles) {
        console.log(`  ⚠️  ${user.fullName || 'Unnamed'} (${user.email}): Role = "${user.role}"`);
        
        // Fix the role
        if (user.role === 'USER') {
          user.role = 'employee';
          await user.save();
          console.log(`     Fixed: USER → employee\n`);
        }
      }
    } else {
      console.log('✅ All roles are valid\n');
    }

    // Fix 3: Show active users count
    console.log('3️⃣ Summary\n');
    
    const stats = {
      total: await User.countDocuments({ role: { $ne: 'supplier' } }),
      active: await User.countDocuments({ role: { $ne: 'supplier' }, isActive: true }),
      inactive: await User.countDocuments({ role: { $ne: 'supplier' }, isActive: false }),
      withSupervisor: await User.countDocuments({ 
        role: { $ne: 'supplier' }, 
        isActive: true,
        supervisor: { $exists: true, $ne: null }
      }),
      properStructure: await User.countDocuments({
        role: { $ne: 'supplier' },
        isActive: true,
        position: { $exists: true, $ne: null, $ne: '' },
        department: { $exists: true, $ne: null, $ne: '' }
      })
    };

    console.log('Current Status:');
    console.log(`  Total users: ${stats.total}`);
    console.log(`  Active: ${stats.active}`);
    console.log(`  Inactive: ${stats.inactive}`);
    console.log(`  With supervisor: ${stats.withSupervisor}`);
    console.log(`  Proper structure: ${stats.properStructure}\n`);

    // Fix 4: List all active users for verification
    console.log('4️⃣ Active Users by Department\n');
    
    const activeUsers = await User.aggregate([
      { 
        $match: { 
          role: { $ne: 'supplier' }, 
          isActive: true,
          position: { $exists: true, $ne: null, $ne: '' }
        } 
      },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    activeUsers.forEach(dept => {
      console.log(`  ${dept._id || 'Unknown'}: ${dept.count} users`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Fix completed!\n');
    console.log('Next steps:');
    console.log('1. Try logging in with a valid user');
    console.log('2. If issues persist, run: node scripts/fixAllInvalidRoles.js cleanup');
    console.log('3. Then re-seed: node scripts/seedAllUsers.js seed\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Delete invalid users permanently
async function deleteInvalidUsers() {
  try {
    console.log('🗑️  DELETING INVALID USERS');
    console.log('='.repeat(60));
    console.log('⚠️  WARNING: This will permanently delete users!\n');

    await connectDB();

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

    // Show remaining
    const remaining = await User.countDocuments({ 
      role: { $ne: 'supplier' },
      isActive: true 
    });
    
    console.log(`📊 Remaining active users: ${remaining}\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Delete failed:', error);
    process.exit(1);
  }
}

// Show who can login
async function showLoginableUsers() {
  try {
    console.log('👥 USERS WHO CAN LOGIN');
    console.log('='.repeat(60) + '\n');

    await connectDB();

    const loginable = await User.find({
      role: { $ne: 'supplier' },
      isActive: true,
      position: { $exists: true, $ne: null, $ne: '' },
      department: { $exists: true, $ne: null, $ne: '' }
    })
    .select('fullName email role department position')
    .sort({ department: 1, hierarchyLevel: -1 });

    if (loginable.length === 0) {
      console.log('❌ No valid users found!\n');
      console.log('Run: node scripts/seedAllUsers.js seed\n');
      process.exit(1);
    }

    const byDept = {};
    loginable.forEach(user => {
      const dept = user.department || 'Unknown';
      if (!byDept[dept]) byDept[dept] = [];
      byDept[dept].push(user);
    });

    for (const [dept, users] of Object.entries(byDept)) {
      console.log(`📁 ${dept} (${users.length} users)`);
      console.log('-'.repeat(60));
      
      users.forEach(user => {
        console.log(`✅ ${user.fullName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Password: password123`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Position: ${user.position}\n`);
      });
    }

    console.log('='.repeat(60));
    console.log(`Total: ${loginable.length} users can login\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

const command = process.argv[2];

switch (command) {
  case 'fix':
    fixValidationIssues();
    break;
  case 'delete':
    deleteInvalidUsers();
    break;
  case 'who':
    showLoginableUsers();
    break;
  default:
    console.log(`
Usage:
  node scripts/quickFix.js [command]

Commands:
  fix      - Deactivate invalid users and fix roles
  delete   - Permanently delete invalid users
  who      - Show all users who can login

Examples:
  node scripts/quickFix.js fix
  node scripts/quickFix.js who
  node scripts/quickFix.js delete
    `);
    process.exit(0);
}