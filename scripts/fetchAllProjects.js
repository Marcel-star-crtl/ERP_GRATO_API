const mongoose = require('mongoose');
const Project = require('../models/Project');
require('dotenv').config();

async function generateProjectCode(department, projectDate) {
  const deptPrefixes = {
    'Operations': 'OPS',
    'IT': 'IT',
    'Finance': 'FIN',
    'Technical': 'TECH',
    'Technical Operations': 'TECHOPS',
    'Technical QHSE': 'TECHSE',
    'Technical Roll Out': 'TRO',
    'HR': 'HR',
    'Marketing': 'MKT',
    'Supply Chain': 'SCM',
    'Facilities': 'FAC',
    'Roll Out': 'RO',
    'Business': 'BU'
  };

  const prefix = deptPrefixes[department] || 'GEN';
  const date = new Date(projectDate);
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const codePrefix = `${prefix}${year}-${month}`;

  const latestProject = await Project.findOne({
    code: new RegExp(`^${codePrefix}-`, 'i'),
    _id: { $exists: true }
  }).sort({ code: -1 }).limit(1);

  let sequence = 1;
  if (latestProject && latestProject.code) {
    const match = latestProject.code.match(/-(\d+)$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  return `${codePrefix}-${String(sequence).padStart(4, '0')}`;
}

async function fixProjectCodes() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB Connected');
    console.log('\n🔧 FIXING PROJECT CODES WITH HISTORICAL DATES...\n');

    // Find all projects without proper codes
    const projectsWithoutCodes = await Project.find({
      $or: [
        { code: { $exists: false } },
        { code: null },
        { code: '' },
        { code: 'NO CODE' }
      ],
      isActive: true,
      isDraft: false
    }).sort({ createdAt: 1 }); // Process oldest first

    console.log(`Found ${projectsWithoutCodes.length} projects without codes\n`);

    let fixed = 0;
    let failed = 0;

    for (const project of projectsWithoutCodes) {
      try {
        // Use the project's creation date or timeline start date
        const projectDate = project.timeline?.startDate || project.createdAt;
        const newCode = await generateProjectCode(project.department, projectDate);
        
        // Verify uniqueness
        const existing = await Project.findOne({ 
          code: newCode,
          _id: { $ne: project._id }
        });
        
        if (existing) {
          console.log(`⚠️  Code collision for "${project.name}" - skipping`);
          failed++;
          continue;
        }

        // Update using direct MongoDB operation to bypass hooks
        await Project.updateOne(
          { _id: project._id },
          { $set: { code: newCode } }
        );

        const projectDateStr = new Date(projectDate).toLocaleDateString();
        console.log(`✅ Fixed: "${project.name}"`);
        console.log(`   Date: ${projectDateStr}`);
        console.log(`   Code: ${newCode}\n`);
        fixed++;
      } catch (error) {
        console.error(`❌ Failed to fix "${project.name}":`, error.message);
        failed++;
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`✅ Successfully fixed: ${fixed} projects`);
    if (failed > 0) {
      console.log(`❌ Failed to fix: ${failed} projects`);
    }
    console.log('═══════════════════════════════════════\n');

    // Verify results
    console.log('\n🔍 VERIFICATION:\n');
    const allProjects = await Project.find({ 
      isActive: true, 
      isDraft: false 
    }).select('name code department createdAt').sort({ code: 1 });

    allProjects.forEach(p => {
      const hasCode = p.code && p.code !== 'NO CODE';
      console.log(`${hasCode ? '✅' : '❌'} ${p.code || 'NO CODE'} - ${p.name}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixProjectCodes();