require('dotenv').config(); // Load environment variables
const mongoose = require('mongoose');
const User = require('../models/User');
const { DEPARTMENT_STRUCTURE, findPersonByEmail } = require('../config/departmentStructure');
const HierarchyService = require('../services/hierarchyService');

/**
 * Migration Script: Update existing users with new hierarchy structure
 * 
 * Run this ONCE after deploying new schema:
 * node scripts/migrateHierarchy.js
 */

// Validate MongoDB URI
if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  console.error('❌ ERROR: MongoDB URI not found in environment variables!');
  console.error('\nPlease ensure you have one of these in your .env file:');
  console.error('  - MONGODB_URI=mongodb://...');
  console.error('  - MONGO_URI=mongodb://...');
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function migrateUserHierarchy() {
  try {
    console.log('🚀 Starting hierarchy migration...\n');

    // Connect to database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ Connected to database\n');
    }

    // Get all non-supplier users
    const users = await User.find({ 
      role: { $ne: 'supplier' },
      isActive: true 
    });

    console.log(`Found ${users.length} users to migrate\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const user of users) {
      try {
        console.log(`\n📝 Processing: ${user.fullName} (${user.email})`);

        // Find user in structure
        const structureData = findPersonByEmail(user.email);
        
        if (!structureData) {
          console.log(`⚠️  Not found in structure, skipping...`);
          continue;
        }

        const updates = {
          lastHierarchyUpdate: new Date()
        };

        // 1. Add position if missing
        if (!user.position && structureData.position) {
          updates.position = structureData.position;
          console.log(`  ✓ Added position: ${structureData.position}`);
        }

        // 2. Determine approval capacities
        if (!user.approvalCapacities || user.approvalCapacities.length === 0) {
          const capacities = HierarchyService.determineApprovalCapacities(
            user.position || structureData.position,
            user.department,
            structureData.isDepartmentHead
          );
          updates.approvalCapacities = capacities;
          console.log(`  ✓ Added capacities: ${capacities.join(', ')}`);
        }

        // 3. Find and set supervisor
        if (structureData.reportsTo && !user.supervisor) {
          const supervisor = await User.findOne({ 
            email: structureData.reportsTo,
            isActive: true 
          });

          if (supervisor) {
            updates.supervisor = supervisor._id;
            console.log(`  ✓ Set supervisor: ${supervisor.fullName}`);

            // Add to supervisor's directReports
            if (!supervisor.directReports.includes(user._id)) {
              await User.findByIdAndUpdate(supervisor._id, {
                $addToSet: { directReports: user._id }
              });
              console.log(`  ✓ Added to ${supervisor.fullName}'s direct reports`);
            }
          } else {
            console.log(`  ⚠️  Supervisor not found: ${structureData.reportsTo}`);
          }
        }

        // 4. Set department head
        if (!user.departmentHead && user.department) {
          const deptHead = await HierarchyService.getDepartmentHead(user.department);
          if (deptHead && deptHead._id.toString() !== user._id.toString()) {
            updates.departmentHead = deptHead._id;
            console.log(`  ✓ Set department head: ${deptHead.fullName}`);
          }
        }

        // 5. Update hierarchy level from structure
        if (structureData.hierarchyLevel && user.hierarchyLevel !== structureData.hierarchyLevel) {
          updates.hierarchyLevel = structureData.hierarchyLevel;
          console.log(`  ✓ Updated hierarchy level: ${structureData.hierarchyLevel}`);
        }

        // 6. Fix role if it's 'supervisor' (legacy)
        if (user.role === 'supervisor') {
          const newRole = HierarchyService.determineUserRole(
            user.position || structureData.position,
            user.department,
            structureData
          );
          updates.role = newRole;
          console.log(`  ✓ Changed role from 'supervisor' to '${newRole}'`);
        }

        // Apply updates
        if (Object.keys(updates).length > 1) { // More than just lastHierarchyUpdate
          await User.findByIdAndUpdate(user._id, updates);
          console.log(`  ✅ Updated successfully`);
        }

        // Calculate hierarchy path
        await HierarchyService.calculateHierarchyPath(user._id);
        console.log(`  ✓ Calculated hierarchy path`);

        successCount++;

      } catch (error) {
        console.error(`  ❌ Error processing ${user.fullName}:`, error.message);
        errors.push({
          user: user.email,
          error: error.message
        });
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Total processed: ${users.length}\n`);

    if (errors.length > 0) {
      console.log('Errors encountered:');
      errors.forEach(e => {
        console.log(`  - ${e.user}: ${e.error}`);
      });
    }

    // Validation check
    console.log('\n🔍 Running validation checks...\n');
    
    const usersWithoutSupervisor = await User.countDocuments({
      role: { $ne: 'supplier' },
      isActive: true,
      supervisor: { $exists: false },
      email: { $ne: 'kelvin.eyong@gratoglobal.com' } // Kelvin has no supervisor
    });

    const usersWithoutHierarchyPath = await User.countDocuments({
      role: { $ne: 'supplier' },
      isActive: true,
      $or: [
        { hierarchyPath: { $exists: false } },
        { hierarchyPath: { $size: 0 } }
      ]
    });

    const usersWithoutApprovalCapacities = await User.countDocuments({
      role: { $ne: 'supplier' },
      isActive: true,
      $or: [
        { approvalCapacities: { $exists: false } },
        { approvalCapacities: { $size: 0 } }
      ],
      hierarchyLevel: { $gte: 2 } // Only check for level 2+
    });

    console.log('Validation Results:');
    console.log(`  - Users without supervisor (excluding Kelvin): ${usersWithoutSupervisor}`);
    console.log(`  - Users without hierarchy path: ${usersWithoutHierarchyPath}`);
    console.log(`  - Users without approval capacities (level 2+): ${usersWithoutApprovalCapacities}`);

    if (usersWithoutSupervisor === 0 && usersWithoutHierarchyPath === 0) {
      console.log('\n✅ All validation checks passed!\n');
    } else {
      console.log('\n⚠️  Some validation checks failed. Review the data manually.\n');
    }

    console.log('🎉 Migration completed!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Rollback function (if needed)
 */
async function rollbackMigration() {
  try {
    console.log('🔄 Rolling back hierarchy migration...\n');

    await User.updateMany(
      { role: { $ne: 'supplier' } },
      {
        $unset: {
          position: '',
          approvalCapacities: '',
          hierarchyPath: '',
          lastHierarchyUpdate: '',
          hierarchyUpdatedBy: ''
        }
      }
    );

    console.log('✅ Rollback completed\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

/**
 * Dry run to preview changes
 */
async function dryRun() {
  try {
    console.log('🔍 DRY RUN - Previewing changes (no data will be modified)\n');

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    const users = await User.find({ 
      role: { $ne: 'supplier' },
      isActive: true 
    }).select('fullName email department position supervisor hierarchyLevel');

    console.log(`Found ${users.length} users\n`);

    for (const user of users) {
      const structureData = findPersonByEmail(user.email);
      
      if (structureData) {
        console.log(`\n${user.fullName} (${user.email})`);
        console.log(`  Current position: ${user.position || 'NOT SET'}`);
        console.log(`  Will set to: ${structureData.position}`);
        console.log(`  Current supervisor: ${user.supervisor || 'NOT SET'}`);
        console.log(`  Will report to: ${structureData.reportsTo || 'NONE'}`);
        console.log(`  Current level: ${user.hierarchyLevel}`);
        console.log(`  Will set to: ${structureData.hierarchyLevel}`);
      }
    }

    console.log('\n✅ Dry run completed. Review changes above.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Dry run failed:', error);
    process.exit(1);
  }
}

// Run based on command line argument
const command = process.argv[2];

switch (command) {
  case 'migrate':
    migrateUserHierarchy();
    break;
  case 'rollback':
    rollbackMigration();
    break;
  case 'dry-run':
    dryRun();
    break;
  default:
    console.log(`
Usage:
  node scripts/migrateHierarchy.js [command]

Commands:
  migrate    - Run full migration
  dry-run    - Preview changes without modifying data
  rollback   - Undo migration changes

Example:
  node scripts/migrateHierarchy.js dry-run
  node scripts/migrateHierarchy.js migrate
    `);
    process.exit(0);
}

module.exports = { migrateUserHierarchy, rollbackMigration, dryRun };








// // scripts/migrateHierarchy.js
// /**
//  * ONE-TIME MIGRATION SCRIPT
//  * Syncs existing users with enhanced department structure
//  * Creates supervisor/directReports relationships
//  * 
//  * IMPORTANT: Backup database before running!
//  * 
//  * Usage: node scripts/migrateHierarchy.js
//  */

// const mongoose = require('mongoose');
// const path = require('path');
// require('dotenv').config({ path: path.join(__dirname, '../.env') });

// // Import models
// const User = require('../models/User');

// // Import enhanced structure
// const { 
//   ENHANCED_DEPARTMENT_STRUCTURE, 
//   findPersonByEmail,
//   getAllAvailablePositions 
// } = require('../config/departmentStructure');

// const migrateUserHierarchy = async () => {
//   try {
//     console.log('\n' + '='.repeat(60));
//     console.log('🚀 STARTING USER HIERARCHY MIGRATION');
//     console.log('='.repeat(60) + '\n');

//     // Connect to database
//     if (!process.env.MONGODB_URI) {
//       throw new Error('MONGODB_URI not found in environment variables');
//     }

//     await mongoose.connect(process.env.MONGODB_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true
//     });
//     console.log('✅ Connected to MongoDB\n');

//     // ========================================
//     // STEP 1: Clear existing relationships
//     // ========================================
//     console.log('📋 STEP 1: Clearing existing hierarchical relationships...');
//     console.log('-'.repeat(60));

//     const clearResult = await User.updateMany(
//       { role: { $ne: 'supplier' } },
//       {
//         $set: {
//           supervisor: null,
//           directReports: [],
//           departmentHead: null,
//           position: null,
//           hierarchyLevel: 1
//         }
//       }
//     );

//     console.log(`✓ Cleared relationships for ${clearResult.modifiedCount} users\n`);

//     // ========================================
//     // STEP 2: Sync users with structure
//     // ========================================
//     console.log('📋 STEP 2: Syncing users with enhanced structure...');
//     console.log('-'.repeat(60));

//     const users = await User.find({ role: { $ne: 'supplier' } });
//     const updates = [];
//     const notFoundUsers = [];

//     for (const user of users) {
//       const personData = findPersonByEmail(user.email);
      
//       // Skip test users and generic emails
//       if (!personData || user.email.includes('test') || user.email.includes('ulevus')) {
//         notFoundUsers.push(user.email);
//         console.warn(`⚠️  ${user.email} (${user.fullName}) not found in structure - skipping`);
//         continue;
//       }

//       const updateData = {
//         department: personData.department,
//         hierarchyLevel: personData.hierarchyLevel,
//         position: personData.isDepartmentHead 
//           ? personData.position 
//           : personData.position
//       };

//       // Determine role based on structure
//       if (personData.isDepartmentHead) {
//         if (user.email === 'kelvin.eyong@gratoglobal.com') {
//           updateData.role = 'admin';
//           updateData.departmentRole = 'head';
//         } else {
//           updateData.role = 'supervisor';
//           updateData.departmentRole = 'head';
//         }
//       } else if (personData.specialRole === 'buyer') {
//         updateData.role = 'employee';
//         updateData.departmentRole = 'buyer';
        
//         // Add buyer details
//         if (personData.buyerConfig) {
//           updateData.buyerDetails = {
//             specializations: personData.buyerConfig.specializations,
//             maxOrderValue: personData.buyerConfig.maxOrderValue,
//             workload: {
//               currentAssignments: user.buyerDetails?.workload?.currentAssignments || 0,
//               monthlyTarget: 50
//             },
//             performance: {
//               completedOrders: user.buyerDetails?.performance?.completedOrders || 0,
//               averageProcessingTime: user.buyerDetails?.performance?.averageProcessingTime || 0,
//               customerSatisfactionRating: user.buyerDetails?.performance?.customerSatisfactionRating || 5
//             },
//             availability: {
//               isAvailable: user.buyerDetails?.availability?.isAvailable !== false,
//               unavailableReason: user.buyerDetails?.availability?.unavailableReason,
//               unavailableUntil: user.buyerDetails?.availability?.unavailableUntil
//             }
//           };
//         }
//       } else if (personData.specialRole === 'finance') {
//         updateData.role = 'finance';
//         updateData.departmentRole = 'staff';
//       } else if (personData.canSupervise && personData.canSupervise.length > 0) {
//         updateData.role = 'supervisor';
//         updateData.departmentRole = personData.approvalAuthority === 'coordinator' 
//           ? 'coordinator' 
//           : 'supervisor';
//       } else {
//         updateData.role = 'employee';
//         updateData.departmentRole = 'staff';
//       }

//       // Set permissions
//       updateData.permissions = getPermissionsForRole(updateData.role, updateData.departmentRole);

//       updates.push({
//         email: user.email,
//         userId: user._id,
//         updateData,
//         personData
//       });

//       console.log(`✓ ${user.fullName.padEnd(30)} → ${personData.position} (Level ${personData.hierarchyLevel})`);
//     }

//     // Apply all updates
//     console.log(`\n⏳ Applying updates to ${updates.length} users...`);
//     for (const { userId, updateData } of updates) {
//       await User.findByIdAndUpdate(userId, updateData);
//     }
//     console.log(`✅ Updated ${updates.length} users\n`);

//     if (notFoundUsers.length > 0) {
//       console.log('⚠️  USERS NOT FOUND IN STRUCTURE:');
//       notFoundUsers.forEach(email => console.log(`   - ${email}`));
//       console.log('\n');
//     }

//     // ========================================
//     // STEP 3: Build supervisor relationships
//     // ========================================
//     console.log('📋 STEP 3: Building supervisor relationships...');
//     console.log('-'.repeat(60));

//     let relationshipsBuilt = 0;

//     for (const { email, personData } of updates) {
//       const user = await User.findOne({ email });
      
//       if (!personData.reportsTo) {
//         console.log(`  ${user.fullName} → No supervisor (Top level)`);
//         continue;
//       }

//       const supervisor = await User.findOne({ email: personData.reportsTo });
      
//       if (!supervisor) {
//         console.warn(`⚠️  Supervisor ${personData.reportsTo} not found for ${email}`);
//         continue;
//       }

//       // Set supervisor reference
//       user.supervisor = supervisor._id;
      
//       // Set department head
//       const deptHeadEmail = ENHANCED_DEPARTMENT_STRUCTURE[personData.department]?.head?.email;
//       if (deptHeadEmail) {
//         const deptHead = await User.findOne({ email: deptHeadEmail });
//         if (deptHead) {
//           user.departmentHead = deptHead._id;
//         }
//       }

//       await user.save();

//       // Add to supervisor's directReports (avoid duplicates)
//       if (!supervisor.directReports.some(id => id.equals(user._id))) {
//         supervisor.directReports.push(user._id);
//         await supervisor.save();
//       }

//       console.log(`✓ ${user.fullName.padEnd(30)} → ${supervisor.fullName}`);
//       relationshipsBuilt++;
//     }

//     console.log(`\n✅ Built ${relationshipsBuilt} supervisor relationships\n`);

//     // ========================================
//     // STEP 4: Verification & Report
//     // ========================================
//     console.log('📋 STEP 4: Verification Report');
//     console.log('-'.repeat(60));

//     const supervisors = await User.find({ 
//       directReports: { $exists: true, $ne: [] } 
//     }).populate('directReports', 'fullName email position')
//       .sort({ hierarchyLevel: -1, fullName: 1 });

//     console.log('\n👥 SUPERVISORS AND THEIR DIRECT REPORTS:\n');
//     console.log('='.repeat(60));
    
//     for (const sup of supervisors) {
//       console.log(`\n📌 ${sup.fullName} (${sup.position || sup.departmentRole})`);
//       console.log(`   Email: ${sup.email}`);
//       console.log(`   Role: ${sup.role} | Dept Role: ${sup.departmentRole} | Level: ${sup.hierarchyLevel}`);
//       console.log(`   Direct Reports (${sup.directReports.length}):`);
      
//       sup.directReports.forEach((report, idx) => {
//         console.log(`      ${idx + 1}. ${report.fullName} (${report.position || 'Staff'})`);
//         console.log(`         ${report.email}`);
//       });
//     }

//     // Additional statistics
//     console.log('\n' + '='.repeat(60));
//     console.log('📊 MIGRATION STATISTICS:\n');
    
//     const totalUsers = await User.countDocuments({ role: { $ne: 'supplier' } });
//     const usersWithSupervisor = await User.countDocuments({ 
//       supervisor: { $exists: true, $ne: null } 
//     });
//     const usersWithDirectReports = await User.countDocuments({ 
//       directReports: { $exists: true, $ne: [] } 
//     });
//     const topLevelUsers = await User.find({ 
//       supervisor: null, 
//       role: { $ne: 'supplier' } 
//     }).select('fullName position');

//     console.log(`   Total Users (non-supplier): ${totalUsers}`);
//     console.log(`   Users with Supervisor: ${usersWithSupervisor}`);
//     console.log(`   Users with Direct Reports: ${usersWithDirectReports}`);
//     console.log(`\n   Top Level Users (no supervisor):`);
//     topLevelUsers.forEach(user => {
//       console.log(`      - ${user.fullName} (${user.position || 'Head'})`);
//     });

//     // Validate relationships
//     console.log('\n🔍 VALIDATING RELATIONSHIPS...\n');
//     let validationErrors = 0;

//     for (const user of await User.find({ role: { $ne: 'supplier' } })) {
//       // Check if supervisor's directReports includes this user
//       if (user.supervisor) {
//         const sup = await User.findById(user.supervisor);
//         if (sup && !sup.directReports.some(id => id.equals(user._id))) {
//           console.error(`❌ ${user.fullName} has supervisor ${sup.fullName} but not in their directReports`);
//           validationErrors++;
//         }
//       }

//       // Check if directReports have this user as supervisor
//       for (const reportId of user.directReports) {
//         const report = await User.findById(reportId);
//         if (report && !report.supervisor?.equals(user._id)) {
//           console.error(`❌ ${user.fullName} has ${report.fullName} in directReports but they don't have them as supervisor`);
//           validationErrors++;
//         }
//       }
//     }

//     if (validationErrors === 0) {
//       console.log('✅ All relationships are valid and bidirectional!');
//     } else {
//       console.warn(`⚠️  Found ${validationErrors} validation errors`);
//     }

//     console.log('\n' + '='.repeat(60));
//     console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
//     console.log('='.repeat(60) + '\n');

//     console.log('📝 NEXT STEPS:');
//     console.log('   1. Review the verification report above');
//     console.log('   2. Test behavioral evaluations with supervisors');
//     console.log('   3. Verify approval chains are generating correctly');
//     console.log('   4. Check that direct reports show in evaluation UI\n');

//     process.exit(0);

//   } catch (error) {
//     console.error('\n❌ MIGRATION FAILED:', error);
//     console.error('\nStack trace:', error.stack);
//     process.exit(1);
//   }
// };

// /**
//  * Get permissions array based on role and department role
//  */
// const getPermissionsForRole = (role, departmentRole) => {
//   if (role === 'admin') {
//     return [
//       'all_access',
//       'user_management',
//       'team_management',
//       'financial_approval',
//       'executive_decisions',
//       'system_settings'
//     ];
//   }

//   if (role === 'finance') {
//     return [
//       'financial_approval',
//       'budget_management',
//       'invoice_processing',
//       'team_data_access',
//       'financial_reports'
//     ];
//   }

//   if (role === 'supervisor' || departmentRole === 'coordinator' || departmentRole === 'head') {
//     return [
//       'team_management',
//       'approvals',
//       'team_data_access',
//       'behavioral_evaluations',
//       'performance_reviews'
//     ];
//   }

//   if (departmentRole === 'buyer') {
//     return [
//       'procurement',
//       'vendor_management',
//       'order_processing',
//       'basic_access',
//       'requisition_handling'
//     ];
//   }

//   // Default employee permissions
//   return [
//     'basic_access',
//     'submit_requests',
//     'view_own_data'
//   ];
// };

// // Run migration
// console.log('\n⚠️  WARNING: This script will modify your database!');
// console.log('   Make sure you have a backup before proceeding.\n');

// // Add confirmation prompt
// const readline = require('readline');
// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// });

// rl.question('Do you want to continue? (yes/no): ', (answer) => {
//   rl.close();
  
//   if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
//     migrateUserHierarchy();
//   } else {
//     console.log('\n❌ Migration cancelled by user\n');
//     process.exit(0);
//   }
// });