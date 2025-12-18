// scripts/fixMarcelRequisition.js - Fix Marcel's Purchase Requisition
require('dotenv').config();
const mongoose = require('mongoose');

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

async function fixMarcelRequisition() {
  try {
    console.log('🔧 FIXING MARCEL\'S PURCHASE REQUISITION');
    console.log('='.repeat(70) + '\n');

    await connectDB();

    const PurchaseRequisition = require('../models/PurchaseRequisition');

    // Find the specific requisition
    const requisitionId = '6943a1bdd0ae014e2318be65';
    
    console.log(`📋 Finding requisition: ${requisitionId}\n`);
    
    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department');

    if (!requisition) {
      console.log('❌ Requisition not found!\n');
      process.exit(1);
    }

    console.log('Found Requisition:');
    console.log(`  Number: ${requisition.requisitionNumber}`);
    console.log(`  Title: ${requisition.title}`);
    console.log(`  Employee: ${requisition.employee.fullName} (${requisition.employee.email})`);
    console.log(`  Department: ${requisition.department}`);
    console.log(`  Status: ${requisition.status}\n`);

    console.log('❌ CURRENT (WRONG) APPROVAL CHAIN:');
    console.log('-'.repeat(70));
    requisition.approvalChain.forEach(step => {
      console.log(`  Level ${step.level}: ${step.approver.name} (${step.approver.role})`);
      console.log(`             ${step.approver.email}`);
      console.log(`             Status: ${step.status}\n`);
    });

    // ✅ CORRECT APPROVAL CHAIN FOR MARCEL (IT Staff, reports to CEO)
    const correctApprovalChain = [
      {
        level: 1,
        approver: {
          name: 'Ms. Ranibell Mambo',
          email: 'ranibellmambo@gratoengineering.com',
          role: 'Finance Officer - Budget Verification',
          department: 'Business Development & Supply Chain'
        },
        status: 'pending',
        comments: '',
        assignedDate: new Date()
      },
      {
        level: 2,
        approver: {
          name: 'Mr. Lukong Lambert',
          email: 'lukong.lambert@gratoglobal.com',
          role: 'Supply Chain Coordinator - Business Decisions',
          department: 'Business Development & Supply Chain'
        },
        status: 'pending',
        comments: '',
        assignedDate: new Date()
      },
      {
        level: 3,
        approver: {
          name: 'Mr. E.T Kelvin',
          email: 'kelvin.eyong@gratoglobal.com',
          role: 'Head of Business Development & Supply Chain - Final Approval',
          department: 'Business Development & Supply Chain'
        },
        status: 'pending',
        comments: '',
        assignedDate: new Date()
      }
    ];

    console.log('\n✅ CORRECT APPROVAL CHAIN:');
    console.log('-'.repeat(70));
    correctApprovalChain.forEach(step => {
      console.log(`  Level ${step.level}: ${step.approver.name} (${step.approver.role})`);
      console.log(`             ${step.approver.email}`);
      console.log(`             Status: ${step.status}\n`);
    });

    console.log('EXPLANATION:');
    console.log('  Marcel Yiosimbom (IT Staff) reports DIRECTLY to Kelvin Eyong (CEO)');
    console.log('  Therefore, NO departmental supervisor approval is needed');
    console.log('  The chain should be: Finance → Supply Chain → CEO\n');

    console.log('📝 Updating approval chain...\n');

    // Update the requisition
    requisition.approvalChain = correctApprovalChain;
    requisition.status = 'pending_supervisor'; // Will be handled by finance first
    
    await requisition.save();

    console.log('✅ REQUISITION UPDATED SUCCESSFULLY!\n');

    console.log('📊 UPDATED REQUISITION:');
    console.log('-'.repeat(70));
    console.log(`  ID: ${requisition._id}`);
    console.log(`  Number: ${requisition.requisitionNumber}`);
    console.log(`  Status: ${requisition.status}`);
    console.log(`  Approval Chain Levels: ${requisition.approvalChain.length}\n`);

    requisition.approvalChain.forEach(step => {
      console.log(`  ✓ Level ${step.level}: ${step.approver.name}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ FIX COMPLETED!\n');
    
    console.log('📧 NEXT STEPS:');
    console.log('  1. The requisition is now at "pending_supervisor" status');
    console.log('  2. Ranibell Mambo (Finance) should receive notification');
    console.log('  3. Marcel should see the corrected approval chain');
    console.log('  4. NO intermediate supervisor (Bruiline) in the chain\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

async function fixAllDirectReportRequisitions() {
  try {
    console.log('🔧 FIXING ALL DIRECT-REPORT REQUISITIONS');
    console.log('='.repeat(70) + '\n');

    await connectDB();

    const PurchaseRequisition = require('../models/PurchaseRequisition');
    const User = require('../models/User');

    // Find Marcel and Christabel (direct reports to CEO)
    const directReports = await User.find({
      email: { 
        $in: [
          'marcel.ngong@gratoglobal.com',
          'christabel@gratoengineering.com'
        ]
      }
    }).select('_id email fullName');

    console.log('Direct Reports to CEO:');
    directReports.forEach(user => {
      console.log(`  - ${user.fullName} (${user.email})`);
    });
    console.log('');

    const directReportIds = directReports.map(u => u._id);

    // Find all their pending requisitions
    const requisitions = await PurchaseRequisition.find({
      employee: { $in: directReportIds },
      status: { $in: ['pending_supervisor', 'pending_finance_verification'] }
    }).populate('employee', 'fullName email');

    console.log(`Found ${requisitions.length} requisitions to fix\n`);

    if (requisitions.length === 0) {
      console.log('✅ No requisitions need fixing\n');
      process.exit(0);
    }

    let fixed = 0;

    for (const req of requisitions) {
      console.log(`Fixing: ${req.requisitionNumber} - ${req.employee.fullName}`);
      
      // Check if Bruiline is in the chain
      const hasBruiline = req.approvalChain.some(
        step => step.approver.email === 'bruiline.tsitoh@gratoglobal.com'
      );

      if (hasBruiline) {
        console.log('  ❌ Found Bruiline in chain - removing...');

        // Create correct chain
        const correctChain = [
          {
            level: 1,
            approver: {
              name: 'Ms. Ranibell Mambo',
              email: 'ranibellmambo@gratoengineering.com',
              role: 'Finance Officer - Budget Verification',
              department: 'Business Development & Supply Chain'
            },
            status: 'pending',
            comments: '',
            assignedDate: new Date()
          },
          {
            level: 2,
            approver: {
              name: 'Mr. Lukong Lambert',
              email: 'lukong.lambert@gratoglobal.com',
              role: 'Supply Chain Coordinator - Business Decisions',
              department: 'Business Development & Supply Chain'
            },
            status: 'pending',
            comments: '',
            assignedDate: new Date()
          },
          {
            level: 3,
            approver: {
              name: 'Mr. E.T Kelvin',
              email: 'kelvin.eyong@gratoglobal.com',
              role: 'Head of Business Development & Supply Chain - Final Approval',
              department: 'Business Development & Supply Chain'
            },
            status: 'pending',
            comments: '',
            assignedDate: new Date()
          }
        ];

        req.approvalChain = correctChain;
        req.status = 'pending_supervisor';
        await req.save();

        console.log('  ✅ Fixed!\n');
        fixed++;
      } else {
        console.log('  ✅ Already correct\n');
      }
    }

    console.log('='.repeat(70));
    console.log(`✅ Fixed ${fixed} requisition(s)\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

async function verifyApprovalChain() {
  try {
    console.log('🔍 VERIFYING APPROVAL CHAINS');
    console.log('='.repeat(70) + '\n');

    await connectDB();

    const PurchaseRequisition = require('../models/PurchaseRequisition');
    const User = require('../models/User');

    // Find Marcel
    const marcel = await User.findOne({ email: 'marcel.ngong@gratoglobal.com' });
    
    if (!marcel) {
      console.log('❌ Marcel not found in database\n');
      process.exit(1);
    }

    console.log('User: Marcel Yiosimbom');
    console.log(`  Email: ${marcel.email}`);
    console.log(`  Department: ${marcel.department}`);
    console.log(`  Position: ${marcel.position}`);
    console.log(`  Supervisor: ${marcel.supervisor ? 'Yes' : 'No'}\n`);

    // Get his requisitions
    const requisitions = await PurchaseRequisition.find({
      employee: marcel._id
    }).sort({ createdAt: -1 });

    console.log(`Found ${requisitions.length} requisition(s)\n`);

    requisitions.forEach((req, index) => {
      console.log(`${index + 1}. ${req.requisitionNumber} - ${req.title}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Created: ${req.createdAt.toLocaleDateString()}`);
      console.log(`   Approval Chain (${req.approvalChain.length} levels):`);
      
      req.approvalChain.forEach(step => {
        const icon = step.status === 'approved' ? '✅' : 
                     step.status === 'rejected' ? '❌' : '⏳';
        console.log(`     ${icon} Level ${step.level}: ${step.approver.name}`);
      });
      console.log('');
    });

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

const command = process.argv[2];

switch (command) {
  case 'fix':
    fixMarcelRequisition();
    break;
  case 'fix-all':
    fixAllDirectReportRequisitions();
    break;
  case 'verify':
    verifyApprovalChain();
    break;
  default:
    console.log(`
🔧 Fix Marcel's Requisition Approval Chain

Usage:
  node scripts/fixMarcelRequisition.js [command]

Commands:
  fix       - Fix the specific requisition (REQ202512189169)
  fix-all   - Fix all requisitions from direct reports to CEO
  verify    - Verify Marcel's current requisitions

Examples:
  node scripts/fixMarcelRequisition.js fix
  node scripts/fixMarcelRequisition.js fix-all
  node scripts/fixMarcelRequisition.js verify

Issue:
  Marcel Yiosimbom reports directly to Kelvin Eyong (CEO)
  His requisitions should NOT have Bruiline (HR Head) as approver
  
Correct Chain:
  Level 1: Finance Officer (Budget Verification)
  Level 2: Supply Chain Coordinator (Business Decisions)
  Level 3: CEO (Final Approval)
    `);
    process.exit(0);
}