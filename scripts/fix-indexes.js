require('dotenv').config(); 
const mongoose = require('mongoose');

async function fixIndexes() {
  try {
    // Get MongoDB URI from environment variable
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ ERROR: MONGODB_URI not found in environment variables');
      console.log('\nPlease ensure your .env file contains:');
      console.log('MONGODB_URI=your-mongodb-atlas-connection-string');
      process.exit(1);
    }

    console.log('Connecting to database...');
    console.log('URI:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to database');
    
    const db = mongoose.connection.db;
    const collection = db.collection('inventoryinstances');
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'inventoryinstances' }).toArray();
    if (collections.length === 0) {
      console.log('⚠ inventoryinstances collection does not exist yet');
      console.log('Creating indexes for when collection is created...');
    }

    console.log('\nCurrent indexes:');
    try {
      const existingIndexes = await collection.indexes();
      console.log(JSON.stringify(existingIndexes, null, 2));
    } catch (err) {
      console.log('No indexes yet (collection might be empty)');
    }

    console.log('\nDropping old indexes...');
    
    // Drop barcode index
    try {
      await collection.dropIndex('barcode_1');
      console.log('✓ Dropped barcode_1 index');
    } catch (err) {
      if (err.code === 27 || err.codeName === 'IndexNotFound') {
        console.log('⚠ barcode_1 index not found (already dropped or never created)');
      } else {
        console.log('⚠ Could not drop barcode_1:', err.message);
      }
    }
    
    // Drop assetTag index
    try {
      await collection.dropIndex('assetTag_1');
      console.log('✓ Dropped assetTag_1 index');
    } catch (err) {
      if (err.code === 27 || err.codeName === 'IndexNotFound') {
        console.log('⚠ assetTag_1 index not found (already dropped or never created)');
      } else {
        console.log('⚠ Could not drop assetTag_1:', err.message);
      }
    }
    
    console.log('\nCreating new sparse indexes...');
    
    // Create sparse barcode index
    try {
      await collection.createIndex(
        { barcode: 1 }, 
        { unique: true, sparse: true, name: 'barcode_1_sparse' }
      );
      console.log('✓ Created sparse barcode index');
    } catch (err) {
      console.log('⚠ Could not create barcode index:', err.message);
    }
    
    // Create sparse assetTag index
    try {
      await collection.createIndex(
        { assetTag: 1 }, 
        { unique: true, sparse: true, name: 'assetTag_1_sparse' }
      );
      console.log('✓ Created sparse assetTag index');
    } catch (err) {
      console.log('⚠ Could not create assetTag index:', err.message);
    }
    
    console.log('\nNew indexes:');
    try {
      const newIndexes = await collection.indexes();
      console.log(JSON.stringify(newIndexes, null, 2));
    } catch (err) {
      console.log('Could not fetch indexes:', err.message);
    }
    
    console.log('\n✅ Index fix complete!');
    console.log('\nNext steps:');
    console.log('1. Restart your server');
    console.log('2. Try adding items without barcodes');
    console.log('3. The duplicate key error should be gone');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fixing indexes:', error.message);
    console.error('\nFull error:', error);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 TIP: Make sure your MONGODB_URI in .env is correct');
      console.log('It should look like:');
      console.log('mongodb+srv://username:password@cluster.mongodb.net/database');
    }
    
    process.exit(1);
  }
}

// Run the fix
fixIndexes();