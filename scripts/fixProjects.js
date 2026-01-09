const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

const projectSchema = new mongoose.Schema({}, { strict: false });
const Project = mongoose.model('Project', projectSchema);

async function fixProjects() {
    try {
        console.log('🔧 Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Fix 1: Ensure all projects have isDraft field
        console.log('=== FIX 1: Setting isDraft field ===');
        const result1 = await Project.updateMany(
            { isDraft: { $exists: false } },
            { $set: { isDraft: false } }
        );
        console.log(`✅ Set isDraft: false on ${result1.modifiedCount} projects\n`);

        // Fix 2: Ensure all projects have isActive field
        console.log('=== FIX 2: Setting isActive field ===');
        const result2 = await Project.updateMany(
            { isActive: { $exists: false } },
            { $set: { isActive: true } }
        );
        console.log(`✅ Set isActive: true on ${result2.modifiedCount} projects\n`);

        // Fix 3: Set default status for projects without status
        console.log('=== FIX 3: Setting default status ===');
        const result3 = await Project.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'Planning' } }
        );
        console.log(`✅ Set status: Planning on ${result3.modifiedCount} projects\n`);

        // Fix 4: Convert null isDraft to false
        console.log('=== FIX 4: Converting null isDraft to false ===');
        const result4 = await Project.updateMany(
            { isDraft: null },
            { $set: { isDraft: false } }
        );
        console.log(`✅ Converted ${result4.modifiedCount} null isDraft values to false\n`);

        // Verify fixes
        console.log('=== VERIFICATION ===');
        const allActive = await Project.countDocuments({ isActive: true });
        const drafts = await Project.countDocuments({ isActive: true, isDraft: true });
        const nonDrafts = await Project.countDocuments({ isActive: true, isDraft: false });
        
        console.log(`Total Active Projects: ${allActive}`);
        console.log(`Drafts: ${drafts}`);
        console.log(`Non-Drafts: ${nonDrafts}`);
        console.log(`Sum Check: ${drafts + nonDrafts === allActive ? '✅ PASS' : '❌ FAIL'}\n`);

        // Show sample
        const samples = await Project.find({ isActive: true })
            .select('name code isDraft status')
            .limit(5)
            .lean();
        
        console.log('Sample Projects:');
        samples.forEach((p, idx) => {
            console.log(`${idx + 1}. ${p.name}`);
            console.log(`   Code: ${p.code || 'NO CODE'}`);
            console.log(`   isDraft: ${p.isDraft}`);
            console.log(`   Status: ${p.status}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        process.exit(0);
    }
}

// Show warning
console.log('\n⚠️  WARNING: This script will modify your database!');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
    fixProjects();
}, 5000);