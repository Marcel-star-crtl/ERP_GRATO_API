require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const HierarchyService = require('../services/hierarchyService');

/**
 * Script to assign field staff to proper supervisors with correct hierarchy
 * Run: node scripts/fixFieldStaff.js
 */

const STAFF_ASSIGNMENTS = {
  // Site Supervisors - Report to Pascal Rodrigue (Operations Manager)
  siteSupervisors: [
    {
      email: 'joseph.tayou@gratoglobal.com',
      name: 'Joseph TAYOU',
      position: 'Site Supervisor',
      supervisorEmail: 'pascal.rodrique@gratoglobal.com',
      department: 'Technical',
      hierarchyLevel: 2,
      approvalCapacities: ['direct_supervisor']
    },
    {
      email: 'felix.tientcheu@gratoglobal.com',
      name: 'Felix Tientcheu',
      position: 'Site Supervisor',
      supervisorEmail: 'pascal.rodrique@gratoglobal.com',
      department: 'Technical',
      hierarchyLevel: 2,
      approvalCapacities: ['direct_supervisor']
    }
  ],

  // NOC Operators - Report to Rodrigue Nono (NOC Coordinator)
  nocOperators: [
    {
      email: 'ervine.mbezele@gratoglobal.com',
      name: 'Ervine Mbezele',
      position: 'NOC Operator',
      supervisorEmail: 'rodrigue.nono@gratoglobal.com',
      department: 'Technical',
      hierarchyLevel: 1,
      approvalCapacities: []
    },
    {
      email: 'yossa.yves@gratoglobal.com',
      name: 'Yves Yossa',
      position: 'NOC Operator',
      supervisorEmail: 'rodrigue.nono@gratoglobal.com',
      department: 'Technical',
      hierarchyLevel: 1,
      approvalCapacities: []
    },
    {
      email: 'kamegni.wilfried@gratoglobal.com',
      name: 'Wilfried Kamegni',
      position: 'NOC Operator',
      supervisorEmail: 'rodrigue.nono@gratoglobal.com',
      department: 'Technical',
      hierarchyLevel: 1,
      approvalCapacities: []
    },
    {
      email: 'junior.mukudi@gratoglobal.com',
      name: 'Junior Mukudi',
      position: 'NOC Operator',
      supervisorEmail: 'rodrigue.nono@gratoglobal.com',
      department: 'Technical',
      hierarchyLevel: 1,
      approvalCapacities: []
    }
  ],

  // Receptionist - Reports to Bruiline (HR & Admin Head)
  receptionist: {
    email: 'carmel.dafny@gratoglobal.com',
    name: 'Carmel Dafny',
    position: 'Receptionist',
    supervisorEmail: 'bruiline.tsitoh@gratoglobal.com',
    department: 'HR & Admin',
    hierarchyLevel: 2,
    approvalCapacities: []
  },

  // Field Technicians - Distributed between Joseph and Felix
  fieldTechnicians: {
    // Joseph's Team (9 technicians)
    josephTeam: [
      { email: 'kamgang.junior@gratoglobal.com', name: 'Boris Kamgang' },
      { email: 'sunday@gratoglobal.com', name: 'Sunday' },
      { email: 'ulrich.vitrand@gratoglobal.com', name: 'Urich MOUMI' },
      { email: 'abeeb@gratoglobal.com', name: 'Abeeb' },
      { email: 'paul.nyomb@gratoglobal.com', name: 'Paul EM Nyomb' },
      { email: 'dedidie.francois@gratoglobal.com', name: 'EDIDIE François' },
      { email: 'mba.berthin@gratoglobal.com', name: 'Berthin DEFFO' },
      { email: 'allassane@gratoglobal.com', name: 'Allassane' },
      { email: 'alioum.moussa@gratoglobal.com', name: 'Alioum Moussa' }
    ],
    supervisorEmail: 'joseph.tayou@gratoglobal.com',

    // Felix's Team (4 technicians)
    felixTeam: [
      { email: 'kenfack.jacques@gratoglobal.com', name: 'Kenfack Jacques' },
      { email: 'djackba.marcel@gratoglobal.com', name: 'Djackba Marcel' },
      { email: 'djiyap.danick@gratoglobal.com', name: 'Danick Djiyap' }
    ],
    supervisorEmail2: 'felix.tientcheu@gratoglobal.com',

    position: 'Field Technician',
    department: 'Technical',
    hierarchyLevel: 1,
    approvalCapacities: []
  }
};

async function fixFieldStaff() {
  try {
    console.log('🔧 Fixing Field Staff Hierarchy with Correct Structure...\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    let successCount = 0;
    let skipCount = 0;

    // =====================================================
    // STEP 1: Create/Update Site Supervisors
    // =====================================================
    console.log('📋 STEP 1: Setting up Site Supervisors\n');

    for (const supervisorData of STAFF_ASSIGNMENTS.siteSupervisors) {
      const user = await User.findOne({ email: supervisorData.email });
      
      if (!user) {
        console.log(`⚠️  User not found: ${supervisorData.email}`);
        skipCount++;
        continue;
      }

      const supervisor = await User.findOne({ email: supervisorData.supervisorEmail });
      const deptHead = await User.findOne({ email: 'didier.oyong@gratoengineering.com' });

      if (!supervisor) {
        console.log(`  ❌ Supervisor not found: ${supervisorData.supervisorEmail}`);
        continue;
      }

      console.log(`📝 Processing: ${supervisorData.name} (${supervisorData.email})`);

      user.position = supervisorData.position;
      user.supervisor = supervisor._id;
      user.departmentHead = deptHead._id;
      user.department = supervisorData.department;
      user.hierarchyLevel = supervisorData.hierarchyLevel;
      user.approvalCapacities = supervisorData.approvalCapacities;
      
      // Fix old 'supervisor' role
      if (user.role === 'supervisor' || !user.role) {
        user.role = 'technical'; // Site supervisors are technical staff
      }
      
      user.lastHierarchyUpdate = new Date();

      await user.save();

      // Add to Pascal's directReports
      if (!supervisor.directReports.includes(user._id)) {
        supervisor.directReports.push(user._id);
        await supervisor.save();
      }

      await HierarchyService.calculateHierarchyPath(user._id);

      console.log(`  ✅ ${supervisorData.name} → ${supervisor.fullName}`);
      console.log(`  ✓ Position: ${supervisorData.position}`);
      console.log(`  ✓ Can supervise Field Technicians\n`);

      successCount++;
    }

    // =====================================================
    // STEP 2: Setup NOC Operators
    // =====================================================
    console.log('\n📋 STEP 2: Setting up NOC Operators\n');

    const rodrigue = await User.findOne({ email: 'rodrigue.nono@gratoglobal.com' });
    const deptHead = await User.findOne({ email: 'didier.oyong@gratoengineering.com' });

    if (rodrigue) {
      console.log(`NOC Coordinator: ${rodrigue.fullName}\n`);

      for (const operatorData of STAFF_ASSIGNMENTS.nocOperators) {
        const user = await User.findOne({ email: operatorData.email });

        if (!user) {
          console.log(`⚠️  User not found: ${operatorData.email}`);
          skipCount++;
          continue;
        }

        console.log(`📝 Processing: ${operatorData.name} (${operatorData.email})`);

        user.position = operatorData.position;
        user.supervisor = rodrigue._id;
        user.departmentHead = deptHead._id;
        user.department = operatorData.department;
        user.hierarchyLevel = operatorData.hierarchyLevel;
        user.approvalCapacities = operatorData.approvalCapacities;
        
        // Fix old 'supervisor' role
        if (user.role === 'supervisor' || !user.role) {
          user.role = 'technical'; // NOC Operators are technical staff
        }
        
        user.lastHierarchyUpdate = new Date();

        await user.save();

        // Add to Rodrigue's directReports
        if (!rodrigue.directReports.includes(user._id)) {
          rodrigue.directReports.push(user._id);
        }

        await HierarchyService.calculateHierarchyPath(user._id);

        console.log(`  ✅ ${operatorData.name} → ${rodrigue.fullName}`);
        successCount++;
      }

      await rodrigue.save();
      console.log(`\n  ℹ️  Rodrigue now supervises ${rodrigue.directReports.length} NOC Operators\n`);
    }

    // =====================================================
    // STEP 3: Setup Receptionist
    // =====================================================
    console.log('\n📋 STEP 3: Setting up Receptionist\n');

    const receptionistData = STAFF_ASSIGNMENTS.receptionist;
    const receptionistUser = await User.findOne({ email: receptionistData.email });

    if (receptionistUser) {
      const bruiline = await User.findOne({ email: receptionistData.supervisorEmail });

      console.log(`📝 Processing: ${receptionistData.name} (${receptionistData.email})`);

      receptionistUser.position = receptionistData.position;
      receptionistUser.supervisor = bruiline._id;
      receptionistUser.departmentHead = bruiline._id;
      receptionistUser.department = receptionistData.department;
      receptionistUser.hierarchyLevel = receptionistData.hierarchyLevel;
      receptionistUser.approvalCapacities = receptionistData.approvalCapacities;
      
      // Fix old 'supervisor' role
      if (receptionistUser.role === 'supervisor' || !receptionistUser.role) {
        receptionistUser.role = 'hr'; // Receptionist is HR staff
      }
      
      receptionistUser.lastHierarchyUpdate = new Date();

      await receptionistUser.save();

      // Add to Bruiline's directReports
      if (!bruiline.directReports.includes(receptionistUser._id)) {
        bruiline.directReports.push(receptionistUser._id);
        await bruiline.save();
      }

      await HierarchyService.calculateHierarchyPath(receptionistUser._id);

      console.log(`  ✅ ${receptionistData.name} → ${bruiline.fullName}`);
      console.log(`  ✓ Position: ${receptionistData.position}\n`);
      successCount++;
    } else {
      console.log(`⚠️  Receptionist not found: ${receptionistData.email}\n`);
      skipCount++;
    }

    // =====================================================
    // STEP 4: Assign Field Technicians to Site Supervisors
    // =====================================================
    console.log('\n📋 STEP 4: Assigning Field Technicians\n');

    const joseph = await User.findOne({ email: 'joseph.tayou@gratoglobal.com' });
    const felix = await User.findOne({ email: 'felix.tientcheu@gratoglobal.com' });
    const techDeptHead = await User.findOne({ email: 'didier.oyong@gratoengineering.com' });

    // Joseph's Team
    if (joseph) {
      console.log(`🔹 Joseph's Team (9 technicians)\n`);

      for (const techData of STAFF_ASSIGNMENTS.fieldTechnicians.josephTeam) {
        const user = await User.findOne({ email: techData.email });

        if (!user) {
          console.log(`⚠️  User not found: ${techData.email}`);
          skipCount++;
          continue;
        }

        console.log(`📝 ${techData.name}`);

        user.position = STAFF_ASSIGNMENTS.fieldTechnicians.position;
        user.supervisor = joseph._id;
        user.departmentHead = techDeptHead._id;
        user.department = STAFF_ASSIGNMENTS.fieldTechnicians.department;
        user.hierarchyLevel = STAFF_ASSIGNMENTS.fieldTechnicians.hierarchyLevel;
        user.approvalCapacities = STAFF_ASSIGNMENTS.fieldTechnicians.approvalCapacities;
        
        // Fix old 'supervisor' role
        if (user.role === 'supervisor' || !user.role) {
          user.role = 'technical'; // Field Technicians are technical staff
        }
        
        user.lastHierarchyUpdate = new Date();

        await user.save();

        // Add to Joseph's directReports
        if (!joseph.directReports.includes(user._id)) {
          joseph.directReports.push(user._id);
        }

        await HierarchyService.calculateHierarchyPath(user._id);

        console.log(`  ✅ Assigned to Joseph TAYOU\n`);
        successCount++;
      }

      await joseph.save();
      console.log(`  ℹ️  Joseph now supervises ${joseph.directReports.length} Field Technicians\n`);
    }

    // Felix's Team
    if (felix) {
      console.log(`\n🔹 Felix's Team (3 technicians)\n`);

      for (const techData of STAFF_ASSIGNMENTS.fieldTechnicians.felixTeam) {
        const user = await User.findOne({ email: techData.email });

        if (!user) {
          console.log(`⚠️  User not found: ${techData.email}`);
          skipCount++;
          continue;
        }

        console.log(`📝 ${techData.name}`);

        user.position = STAFF_ASSIGNMENTS.fieldTechnicians.position;
        user.supervisor = felix._id;
        user.departmentHead = techDeptHead._id;
        user.department = STAFF_ASSIGNMENTS.fieldTechnicians.department;
        user.hierarchyLevel = STAFF_ASSIGNMENTS.fieldTechnicians.hierarchyLevel;
        user.approvalCapacities = STAFF_ASSIGNMENTS.fieldTechnicians.approvalCapacities;
        
        // Fix old 'supervisor' role
        if (user.role === 'supervisor' || !user.role) {
          user.role = 'technical'; // Field Technicians are technical staff
        }
        
        user.lastHierarchyUpdate = new Date();

        await user.save();

        // Add to Felix's directReports
        if (!felix.directReports.includes(user._id)) {
          felix.directReports.push(user._id);
        }

        await HierarchyService.calculateHierarchyPath(user._id);

        console.log(`  ✅ Assigned to Felix Tientcheu\n`);
        successCount++;
      }

      await felix.save();
      console.log(`  ℹ️  Felix now supervises ${felix.directReports.length} Field Technicians\n`);
    }

    // =====================================================
    // SUMMARY
    // =====================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 ASSIGNMENT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`⚠️  Skipped: ${skipCount}`);
    console.log('\nHierarchy Structure:');
    console.log('');
    console.log('Pascal (Operations Manager)');
    console.log('├── Rodrigue (NOC Coordinator)');
    console.log('│   ├── Ervine (NOC Operator)');
    console.log('│   ├── Yves (NOC Operator)');
    console.log('│   ├── Wilfried (NOC Operator)');
    console.log('│   └── Junior (NOC Operator)');
    console.log('├── Joseph (Site Supervisor)');
    console.log('│   └── 9 Field Technicians');
    console.log('└── Felix (Site Supervisor)');
    console.log('    └── 3 Field Technicians');
    console.log('');
    console.log('Bruiline (HR & Admin Head)');
    console.log('└── Carmel (Receptionist)');
    console.log('');

    // =====================================================
    // VALIDATION
    // =====================================================
    console.log('🔍 Running validation...\n');

    const usersWithoutSupervisor = await User.countDocuments({
      role: { $ne: 'supplier' },
      isActive: true,
      supervisor: { $exists: false },
      email: { $ne: 'kelvin.eyong@gratoglobal.com' }
    });

    const usersWithoutHierarchyPath = await User.countDocuments({
      role: { $ne: 'supplier' },
      isActive: true,
      $or: [
        { hierarchyPath: { $exists: false } },
        { hierarchyPath: { $size: 0 } }
      ]
    });

    console.log('Validation Results:');
    console.log(`  - Users without supervisor (excluding Kelvin): ${usersWithoutSupervisor}`);
    console.log(`  - Users without hierarchy path: ${usersWithoutHierarchyPath}`);

    if (usersWithoutSupervisor === 0 && usersWithoutHierarchyPath === 0) {
      console.log('\n✅ All validation checks passed!\n');
    } else {
      console.log('\n⚠️  Some issues remain. Check users manually:\n');
      
      if (usersWithoutSupervisor > 0) {
        const users = await User.find({
          role: { $ne: 'supplier' },
          isActive: true,
          supervisor: { $exists: false },
          email: { $ne: 'kelvin.eyong@gratoglobal.com' }
        }).select('fullName email');
        
        console.log('Users without supervisor:');
        users.forEach(u => console.log(`  - ${u.fullName} (${u.email})`));
        console.log('');
      }
    }

    console.log('🎉 Field staff assignment completed!\n');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Handle placeholder accounts separately
async function fixPlaceholderAccounts() {
  try {
    console.log('🔧 Fixing Placeholder Accounts...\n');

    await mongoose.connect(process.env.MONGODB_URI);

    const placeholders = [
      { email: 'field.technicians@gratoengineering.com', action: 'deactivate' },
      { email: 'noc.operators@gratoengineering.com', action: 'deactivate' },
      { email: 'site.supervisors@gratoengineering.com', action: 'deactivate' },
      { email: 'marcel.ulevus@gmail.com', action: 'keep' }, // Test account
      { email: 'admin@gratoengineering.com', action: 'keep' } // System admin
    ];

    for (const placeholder of placeholders) {
      const user = await User.findOne({ email: placeholder.email });
      
      if (user) {
        if (placeholder.action === 'deactivate') {
          user.isActive = false;
          await user.save();
          console.log(`✅ Deactivated: ${user.fullName || user.email}`);
        } else {
          console.log(`ℹ️  Kept active: ${user.fullName || user.email}`);
        }
      }
    }

    console.log('\n✅ Placeholder accounts handled\n');
    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run based on command
const command = process.argv[2];

if (command === 'placeholders') {
  fixPlaceholderAccounts();
} else {
  fixFieldStaff();
}

module.exports = { fixFieldStaff, fixPlaceholderAccounts };