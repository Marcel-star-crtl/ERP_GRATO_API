// migrations/fix-project-code-index.js
const mongoose = require('mongoose');
const Project = require('../models/Project');
require('dotenv').config();

async function migrateProjectCodeIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔧 Dropping old code index...');
    try {
      await Project.collection.dropIndex('code_1');
      console.log('✅ Old index dropped');
    } catch (err) {
      console.log('ℹ️ Index might not exist:', err.message);
    }

    console.log('🔧 Setting null codes to undefined for drafts...');
    const result = await Project.updateMany(
      { isDraft: true, code: null },
      { $unset: { code: "" } }
    );
    console.log(`✅ Updated ${result.modifiedCount} draft projects`);

    console.log('🔧 Creating new partial unique index...');
    await Project.collection.createIndex(
      { code: 1 }, 
      { 
        unique: true, 
        partialFilterExpression: { code: { $type: 'string' } },
        name: 'code_1'
      }
    );
    console.log('✅ New partial index created');

    console.log('✅✅✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateProjectCodeIndex();