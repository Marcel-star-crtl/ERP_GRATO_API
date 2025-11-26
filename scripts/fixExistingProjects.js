const mongoose = require('mongoose');
const Project = require('../models/Project');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

const fixExistingProjects = async () => {
  try {
    console.log('=== FIXING EXISTING PROJECTS ===\n');

    // Get the Project model
    const Project = mongoose.model('Project');

    // Find all projects without approvalStatus
    const projectsToFix = await Project.find({
      $or: [
        { approvalStatus: { $exists: false } },
        { approvalStatus: null }
      ]
    });

    console.log(`Found ${projectsToFix.length} projects to fix\n`);

    let fixed = 0;
    let errors = 0;

    for (const project of projectsToFix) {
      try {
        console.log(`Fixing: ${project.name} (${project._id})`);

        // Set approvalStatus to 'approved' for existing projects
        project.approvalStatus = 'approved';
        
        // If project has a code, it was already approved
        if (project.code) {
          project.approvedAt = project.createdAt; // Use creation date as approval date
          project.approvedBy = project.createdBy; // Creator approved it
        }

        // Ensure milestones have subMilestones array
        if (project.milestones && project.milestones.length > 0) {
          project.milestones.forEach(milestone => {
            if (!milestone.subMilestones) {
              milestone.subMilestones = [];
            }
          });
        }

        await project.save({ validateModifiedOnly: true });
        
        console.log(`✅ Fixed: ${project.name}`);
        console.log(`   Code: ${project.code || 'N/A'}`);
        console.log(`   Status: ${project.status}`);
        console.log(`   Approval: ${project.approvalStatus}\n`);
        
        fixed++;
      } catch (error) {
        console.error(`❌ Error fixing ${project.name}:`, error.message);
        errors++;
      }
    }

    console.log('\n=== MIGRATION COMPLETE ===');
    console.log(`✅ Fixed: ${fixed} projects`);
    console.log(`❌ Errors: ${errors} projects`);

    // Verify the fix
    const verifyCount = await Project.countDocuments({ 
      approvalStatus: 'approved',
      isActive: true 
    });
    console.log(`\n✅ Verification: ${verifyCount} approved projects in database`);

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await fixExistingProjects();
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fixExistingProjects };