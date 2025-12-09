require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const QuarterlyKPI = require('../models/QuarterlyKPI');

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

async function fixReportingStructure() {
  try {
    console.log('🔧 FIXING REPORTING STRUCTURE FOR MARCEL & CHRISTABEL');
    console.log('='.repeat(80) + '\n');

    await connectDB();

    // Find the users
    const marcel = await User.findOne({ email: 'marcel.ngong@gratoglobal.com' });
    const christabel = await User.findOne({ email: 'christabel@gratoengineering.com' });
    const kelvin = await User.findOne({ email: 'kelvin.eyong@gratoglobal.com' });
    const bruiline = await User.findOne({ email: 'bruiline.tsitoh@gratoglobal.com' });

    if (!marcel) {
      console.error('❌ Marcel not found');
      process.exit(1);
    }
    if (!christabel) {
      console.error('❌ Christabel not found');
      process.exit(1);
    }
    if (!kelvin) {
      console.error('❌ Kelvin not found');
      process.exit(1);
    }

    console.log('📊 CURRENT STATE');
    console.log('='.repeat(80));
    console.log('\nMarcel Ngong:');
    console.log(`  Email: ${marcel.email}`);
    console.log(`  Position: ${marcel.position}`);
    console.log(`  Department: ${marcel.department}`);
    console.log(`  Current Supervisor: ${marcel.supervisor ? (await User.findById(marcel.supervisor))?.fullName : 'None'}`);
    console.log(`  Hierarchy Level: ${marcel.hierarchyLevel}`);

    console.log('\nChristabel Mangwi:');
    console.log(`  Email: ${christabel.email}`);
    console.log(`  Position: ${christabel.position}`);
    console.log(`  Department: ${christabel.department}`);
    console.log(`  Current Supervisor: ${christabel.supervisor ? (await User.findById(christabel.supervisor))?.fullName : 'None'}`);
    console.log(`  Hierarchy Level: ${christabel.hierarchyLevel}`);

    console.log('\n' + '='.repeat(80) + '\n');

    // Update Marcel
    console.log('🔄 Updating Marcel...');
    
    // Remove Marcel from Bruiline's directReports if present
    if (bruiline && bruiline.directReports.includes(marcel._id)) {
      await User.updateOne(
        { _id: bruiline._id },
        { $pull: { directReports: marcel._id } }
      );
      console.log('  ✅ Removed from Bruiline\'s direct reports');
    }

    // Add Marcel to Kelvin's directReports if not present
    if (!kelvin.directReports.some(id => id.toString() === marcel._id.toString())) {
      await User.updateOne(
        { _id: kelvin._id },
        { $addToSet: { directReports: marcel._id } }
      );
      console.log('  ✅ Added to Kelvin\'s direct reports');
    }

    // Update Marcel's supervisor and hierarchy
    marcel.supervisor = kelvin._id;
    marcel.department = 'IT';
    marcel.hierarchyLevel = 3;
    marcel.hierarchyPath = [marcel._id.toString(), kelvin._id.toString()];
    marcel.lastHierarchyUpdate = new Date();
    marcel.hierarchyUpdatedBy = kelvin._id;
    
    await marcel.save();
    console.log('  ✅ Updated Marcel\'s reporting structure\n');

    // Update Christabel
    console.log('🔄 Updating Christabel...');
    
    const lukong = await User.findOne({ email: 'lukong.lambert@gratoglobal.com' });
    
    // Remove Christabel from Lukong's directReports if present
    if (lukong && lukong.directReports.includes(christabel._id)) {
      await User.updateOne(
        { _id: lukong._id },
        { $pull: { directReports: christabel._id } }
      );
      console.log('  ✅ Removed from Lukong\'s direct reports');
    }

    // Add Christabel to Kelvin's directReports if not present
    if (!kelvin.directReports.some(id => id.toString() === christabel._id.toString())) {
      await User.updateOne(
        { _id: kelvin._id },
        { $addToSet: { directReports: christabel._id } }
      );
      console.log('  ✅ Added to Kelvin\'s direct reports');
    }

    // Update Christabel's supervisor and hierarchy
    christabel.supervisor = kelvin._id;
    christabel.hierarchyLevel = 3;
    christabel.hierarchyPath = [christabel._id.toString(), kelvin._id.toString()];
    christabel.lastHierarchyUpdate = new Date();
    christabel.hierarchyUpdatedBy = kelvin._id;
    
    await christabel.save();
    console.log('  ✅ Updated Christabel\'s reporting structure\n');

    // Reload users to show updated state
    const marcelUpdated = await User.findById(marcel._id).populate('supervisor');
    const christabelUpdated = await User.findById(christabel._id).populate('supervisor');
    const kelvinUpdated = await User.findById(kelvin._id);

    console.log('='.repeat(80));
    console.log('📊 NEW STATE');
    console.log('='.repeat(80));
    
    console.log('\nMarcel Ngong:');
    console.log(`  Email: ${marcelUpdated.email}`);
    console.log(`  Position: ${marcelUpdated.position}`);
    console.log(`  Department: ${marcelUpdated.department}`);
    console.log(`  New Supervisor: ${marcelUpdated.supervisor?.fullName || 'None'}`);
    console.log(`  Hierarchy Level: ${marcelUpdated.hierarchyLevel}`);
    console.log(`  Hierarchy Path: [${marcelUpdated.hierarchyPath.join(' → ')}]`);

    console.log('\nChristabel Mangwi:');
    console.log(`  Email: ${christabelUpdated.email}`);
    console.log(`  Position: ${christabelUpdated.position}`);
    console.log(`  Department: ${christabelUpdated.department}`);
    console.log(`  New Supervisor: ${christabelUpdated.supervisor?.fullName || 'None'}`);
    console.log(`  Hierarchy Level: ${christabelUpdated.hierarchyLevel}`);
    console.log(`  Hierarchy Path: [${christabelUpdated.hierarchyPath.join(' → ')}]`);

    console.log('\nKelvin E.T:');
    console.log(`  Email: ${kelvinUpdated.email}`);
    console.log(`  Direct Reports Count: ${kelvinUpdated.directReports.length}`);
    console.log(`  Direct Reports: ${(await User.find({ _id: { $in: kelvinUpdated.directReports } })).map(u => u.fullName).join(', ')}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('='.repeat(80) + '\n');

    console.log('📝 NEXT STEPS:');
    console.log('  1. Update any existing KPIs for Marcel to reflect new supervisor');
    console.log('  2. Verify approval chains are working correctly');
    console.log('  3. Test KPI submission with new structure\n');

    // Now fix existing KPIs if any
    console.log('🔄 Checking for existing KPIs to update...\n');
    
    const marcelKPIs = await QuarterlyKPI.find({ employee: marcel._id });
    if (marcelKPIs.length > 0) {
      console.log(`Found ${marcelKPIs.length} KPI(s) for Marcel`);
      
      for (const kpi of marcelKPIs) {
        console.log(`\n  Updating KPI: ${kpi.quarter} ${kpi.year}`);
        
        // Update supervisor info
        kpi.supervisor = {
          name: kelvin.fullName,
          email: kelvin.email,
          department: kelvin.department
        };

        // Regenerate approval chain if it exists
        if (kpi.approvalChain && kpi.approvalChain.length > 0) {
          console.log('    Regenerating approval chain...');
          
          // Get new approval chain from structure
          const { getApprovalChainFromStructure } = require('../config/departmentStructure');
          const newChain = getApprovalChainFromStructure(marcel.email);
          
          if (newChain && newChain.length > 0) {
            // Preserve any existing approvals
            const existingApprovals = kpi.approvalChain.filter(step => 
              step.status === 'approved' || step.status === 'rejected'
            );
            
            // Update chain with new structure
            kpi.approvalChain = newChain.map(newStep => {
              const existing = existingApprovals.find(e => e.level === newStep.level);
              if (existing) {
                return existing; // Keep existing approval
              }
              return newStep; // Use new step
            });
            
            console.log('    ✅ Approval chain updated');
          }
        }

        await kpi.save();
        console.log('    ✅ KPI updated');
      }
    } else {
      console.log('  No existing KPIs found for Marcel');
    }

    const christabelKPIs = await QuarterlyKPI.find({ employee: christabel._id });
    if (christabelKPIs.length > 0) {
      console.log(`\nFound ${christabelKPIs.length} KPI(s) for Christabel`);
      
      for (const kpi of christabelKPIs) {
        console.log(`\n  Updating KPI: ${kpi.quarter} ${kpi.year}`);
        
        // Update supervisor info
        kpi.supervisor = {
          name: kelvin.fullName,
          email: kelvin.email,
          department: kelvin.department
        };

        // Regenerate approval chain if it exists
        if (kpi.approvalChain && kpi.approvalChain.length > 0) {
          console.log('    Regenerating approval chain...');
          
          const { getApprovalChainFromStructure } = require('../config/departmentStructure');
          const newChain = getApprovalChainFromStructure(christabel.email);
          
          if (newChain && newChain.length > 0) {
            const existingApprovals = kpi.approvalChain.filter(step => 
              step.status === 'approved' || step.status === 'rejected'
            );
            
            kpi.approvalChain = newChain.map(newStep => {
              const existing = existingApprovals.find(e => e.level === newStep.level);
              if (existing) {
                return existing;
              }
              return newStep;
            });
            
            console.log('    ✅ Approval chain updated');
          }
        }

        await kpi.save();
        console.log('    ✅ KPI updated');
      }
    } else {
      console.log('  No existing KPIs found for Christabel');
    }

    console.log('\n✅ ALL UPDATES COMPLETE!\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixReportingStructure();
}

module.exports = { fixReportingStructure };