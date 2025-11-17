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


