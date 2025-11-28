// scripts/fixExistingProjects.js

const mongoose = require('mongoose');
const Project = require('../models/Project');

const fixExistingProjects = async () => {
  try {
    console.log('\n🔧 FIXING EXISTING PROJECTS...\n');

    // Find ALL projects without isDraft or approvalStatus fields
    const projectsToFix = await Project.find({
      $or: [
        { isDraft: { $exists: false } },
        { isDraft: null },
        { approvalStatus: { $exists: false } },
        { approvalStatus: null }
      ]
    });

    console.log(`Found ${projectsToFix.length} projects that need fixing`);

    if (projectsToFix.length === 0) {
      console.log('✅ All projects already have required fields');
      return { updated: 0, total: 0 };
    }

    let updated = 0;

    for (const project of projectsToFix) {
      console.log(`\n📋 Processing: ${project.code || 'NO CODE'} - ${project.name}`);
      
      // Set isDraft to false for existing projects (they were created before draft feature)
      if (project.isDraft === undefined || project.isDraft === null) {
        project.isDraft = false;
        console.log('   ✓ Set isDraft = false');
      }
      
      // Set approvalStatus to 'approved' for existing projects (they're already active)
      if (!project.approvalStatus) {
        project.approvalStatus = 'approved';
        project.approvedAt = project.createdAt || new Date();
        console.log('   ✓ Set approvalStatus = approved');
      }
      
      // Ensure code exists for non-draft projects
      if (!project.code && !project.isDraft) {
        const deptPrefixes = {
          'Operations': 'OPS',
          'IT': 'IT',
          'Finance': 'FIN',
          'Technical': 'TECH',
          'Technical Operations': 'TECHOPS',
          'Technical QHSE': 'TECHSE',
          'HR': 'HR',
          'Marketing': 'MKT',
          'Supply Chain': 'SCM',
          'Facilities': 'FAC',
          'Roll Out': 'RO',
          'Technical Roll Out': 'TRO',
          'Business': 'BU'
        };
        
        const prefix = deptPrefixes[project.department] || 'GEN';
        const year = new Date().getFullYear().toString().slice(-2);
        
        // Find highest sequence number for this prefix
        const latestProject = await Project.findOne({
          code: new RegExp(`^${prefix}${year}-`, 'i')
        }).sort({ code: -1 }).limit(1);
        
        let sequence = 1;
        if (latestProject && latestProject.code) {
          const match = latestProject.code.match(/-(\d+)$/);
          if (match) {
            sequence = parseInt(match[1]) + 1;
          }
        }
        
        project.code = `${prefix}${year}-${String(sequence).padStart(4, '0')}`;
        console.log(`   ✓ Generated code: ${project.code}`);
      }
      
      try {
        await project.save({ validateBeforeSave: false }); // Skip validation to avoid errors
        updated++;
        console.log(`   ✅ Updated successfully`);
      } catch (saveError) {
        console.error(`   ❌ Failed to save: ${saveError.message}`);
        // Try updating directly with updateOne
        try {
          await Project.updateOne(
            { _id: project._id },
            {
              $set: {
                isDraft: project.isDraft,
                approvalStatus: project.approvalStatus,
                approvedAt: project.approvedAt,
                ...(project.code && { code: project.code })
              }
            }
          );
          updated++;
          console.log(`   ✅ Updated using updateOne`);
        } catch (updateError) {
          console.error(`   ❌ UpdateOne also failed: ${updateError.message}`);
        }
      }
    }

    console.log(`\n✅ MIGRATION COMPLETE`);
    console.log(`   Total projects processed: ${projectsToFix.length}`);
    console.log(`   Successfully updated: ${updated}`);
    console.log(`   Failed: ${projectsToFix.length - updated}\n`);

    // Verify the migration
    console.log('🔍 VERIFICATION:');
    const stillMissing = await Project.countDocuments({
      $or: [
        { isDraft: { $exists: false } },
        { isDraft: null }
      ]
    });
    
    console.log(`   Projects still missing isDraft: ${stillMissing}`);
    
    const draftCount = await Project.countDocuments({ isDraft: true });
    const nonDraftCount = await Project.countDocuments({ isDraft: false });
    
    console.log(`   Drafts: ${draftCount}`);
    console.log(`   Non-drafts: ${nonDraftCount}`);
    console.log();

    return { updated, total: projectsToFix.length };

  } catch (error) {
    console.error('❌ MIGRATION ERROR:', error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  const dotenv = require('dotenv');
  const path = require('path');
  
  // Load environment variables
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  
  (async () => {
    try {
      console.log('🔗 Connecting to database...');
      
      // Check if MONGO_URI exists
      if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI not found in environment variables');
        console.error('   Please check your .env file');
        process.exit(1);
      }
      
      console.log('   MongoDB URI found ✓');
      
      // Connect directly
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB\n');
      
      await fixExistingProjects();
      
      console.log('👋 Closing connection...');
      await mongoose.connection.close();
      console.log('✅ Migration completed successfully\n');
      process.exit(0);
    } catch (error) {
      console.error('💥 Migration failed:', error);
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      process.exit(1);
    }
  })();
}

module.exports = { fixExistingProjects };