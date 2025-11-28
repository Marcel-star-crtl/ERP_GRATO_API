// scripts/debugProjects.js - Debug project data and routes

const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Project = require('../models/Project');

const debugProjects = async () => {
  try {
    console.log('\n🔍 DEBUGGING PROJECTS...\n');

    // 1. Count all projects
    const totalProjects = await Project.countDocuments({});
    console.log(`📊 Total projects in database: ${totalProjects}`);

    // 2. Count by isDraft status
    const draftProjects = await Project.countDocuments({ isDraft: true });
    const nonDraftProjects = await Project.countDocuments({ isDraft: false });
    const missingIsDraft = await Project.countDocuments({ 
      $or: [
        { isDraft: { $exists: false } },
        { isDraft: null }
      ]
    });

    console.log(`   Drafts (isDraft: true): ${draftProjects}`);
    console.log(`   Non-drafts (isDraft: false): ${nonDraftProjects}`);
    console.log(`   Missing isDraft field: ${missingIsDraft}`);

    // 3. Count active vs inactive
    const activeProjects = await Project.countDocuments({ isActive: true });
    const inactiveProjects = await Project.countDocuments({ isActive: false });
    
    console.log(`   Active (isActive: true): ${activeProjects}`);
    console.log(`   Inactive (isActive: false): ${inactiveProjects}`);

    // 4. Show sample projects
    console.log('\n📋 Sample Projects:\n');
    
    const sampleProjects = await Project.find({})
      .select('code name isDraft isActive approvalStatus status')
      .limit(5)
      .lean();

    sampleProjects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.code || 'NO CODE'} - ${project.name}`);
      console.log(`   isDraft: ${project.isDraft}`);
      console.log(`   isActive: ${project.isActive}`);
      console.log(`   approvalStatus: ${project.approvalStatus || 'NOT SET'}`);
      console.log(`   status: ${project.status}`);
      console.log();
    });

    // 5. Test the exact query that's failing
    console.log('🧪 Testing API query: { isActive: true, isDraft: false }\n');
    
    const testQuery = {
      isActive: true,
      $or: [
        { isDraft: false },
        { isDraft: { $exists: false } },
        { isDraft: null }
      ]
    };

    const results = await Project.find(testQuery)
      .select('code name isDraft isActive')
      .limit(3)
      .lean();

    console.log(`   Query returned ${results.length} projects:`);
    results.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.code} - ${p.name}`);
      console.log(`      isDraft: ${p.isDraft}, isActive: ${p.isActive}`);
    });

    // 6. Test specific queries
    console.log('\n🔬 Testing Specific Queries:\n');

    // Query 1: ?isDraft=false
    const q1 = await Project.countDocuments({ 
      isActive: true,
      isDraft: false 
    });
    console.log(`   GET /api/projects?isDraft=false → ${q1} projects`);

    // Query 2: No isDraft filter
    const q2 = await Project.countDocuments({ isActive: true });
    console.log(`   GET /api/projects → ${q2} projects`);

    // Query 3: Active projects endpoint
    const q3 = await Project.countDocuments({ 
      status: { $in: ['Planning', 'In Progress'] },
      isActive: true,
      isDraft: false
    });
    console.log(`   GET /api/projects/active → ${q3} projects`);

    console.log('\n✅ Debug complete!\n');

  } catch (error) {
    console.error('❌ Debug error:', error);
    throw error;
  }
};

// Main execution
(async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected!\n');
    
    await debugProjects();
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('💥 Failed:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
})();