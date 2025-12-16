const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');

const listAllPurchaseOrders = async () => {
  try {
    console.log('🔍 Scanning Purchase Orders Database...\n');

    // Get total count
    const totalCount = await PurchaseOrder.countDocuments();
    console.log(`📊 Total Purchase Orders: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('⚠️  No purchase orders found in the database!');
      
      // Check what collections exist
      console.log('\n📁 Available Collections:');
      const collections = await mongoose.connection.db.listCollections().toArray();
      collections.forEach(coll => {
        console.log(`   - ${coll.name}`);
      });
      
      return;
    }

    // Get all purchase orders
    console.log('📋 Listing ALL Purchase Orders:\n');
    console.log('='.repeat(100));
    
    const orders = await PurchaseOrder.find()
      .sort({ createdAt: -1 })
      .select('_id poNumber status totalAmount currency taxApplicable taxRate createdAt');

    orders.forEach((order, index) => {
      console.log(`\n${index + 1}. PO Number: ${order.poNumber}`);
      console.log(`   ID: ${order._id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: ${order.totalAmount?.toLocaleString() || 'N/A'} ${order.currency || ''}`);
      console.log(`   Tax Applicable: ${order.taxApplicable}`);
      console.log(`   Tax Rate: ${order.taxRate}%`);
      console.log(`   Created: ${order.createdAt ? order.createdAt.toLocaleString() : 'N/A'}`);
    });

    console.log('\n' + '='.repeat(100));

    // Check for the specific PO we're looking for
    console.log('\n🔎 Looking for PO-2025-000010 specifically...\n');
    
    // Try exact match
    const exactMatch = await PurchaseOrder.findOne({ poNumber: 'PO-2025-000010' });
    console.log(`Exact match (PO-2025-000010): ${exactMatch ? '✓ Found' : '✗ Not found'}`);
    
    // Try case-insensitive match
    const caseInsensitiveMatch = await PurchaseOrder.findOne({ 
      poNumber: { $regex: /^PO-2025-000010$/i } 
    });
    console.log(`Case-insensitive match: ${caseInsensitiveMatch ? '✓ Found' : '✗ Not found'}`);
    
    // Try partial match
    const partialMatch = await PurchaseOrder.findOne({ 
      poNumber: { $regex: /000010/ } 
    });
    console.log(`Partial match (000010): ${partialMatch ? '✓ Found' : '✗ Not found'}`);
    if (partialMatch) {
      console.log(`   Actual PO Number: "${partialMatch.poNumber}"`);
      console.log(`   ID: ${partialMatch._id}`);
    }

    // Search by the ObjectId from the JSON
    console.log('\n🔎 Looking for ID 69416aeb85985fd6d3157f7f...\n');
    
    if (mongoose.Types.ObjectId.isValid('69416aeb85985fd6d3157f7f')) {
      const byId = await PurchaseOrder.findById('69416aeb85985fd6d3157f7f');
      console.log(`Search by ID: ${byId ? '✓ Found' : '✗ Not found'}`);
      if (byId) {
        console.log(`   PO Number: "${byId.poNumber}"`);
        console.log(`   Status: ${byId.status}`);
        console.log(`   Total: ${byId.totalAmount} ${byId.currency}`);
      }
    }

    // Check collection name
    console.log('\n📁 Collection Information:');
    console.log(`   Model name: ${PurchaseOrder.modelName}`);
    console.log(`   Collection name: ${PurchaseOrder.collection.name}`);
    console.log(`   Database name: ${mongoose.connection.db.databaseName}`);

    // Get a sample document to see the structure
    console.log('\n📄 Sample Document Structure:');
    const sample = await PurchaseOrder.findOne();
    if (sample) {
      console.log('   Fields in document:');
      Object.keys(sample.toObject()).forEach(key => {
        const value = sample[key];
        const type = Array.isArray(value) ? 'Array' : typeof value;
        console.log(`   - ${key}: ${type}`);
      });
    }

    // Check for documents with tax applicable
    console.log('\n💰 Purchase Orders with Tax:');
    const withTax = await PurchaseOrder.find({ 
      taxApplicable: true,
      taxRate: { $exists: true, $gt: 0 }
    }).select('poNumber taxRate totalAmount');
    
    if (withTax.length > 0) {
      console.log(`   Found ${withTax.length} orders with tax:`);
      withTax.forEach(order => {
        console.log(`   - ${order.poNumber}: Tax Rate ${order.taxRate}%, Total: ${order.totalAmount}`);
      });
    } else {
      console.log('   No orders found with tax applicable');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
};

// Run if executed directly
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://marcelngong50:dp1d6ABP6ggkvQli@cluster0.9nhviyl.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('✅ Connected to MongoDB\n');
    return listAllPurchaseOrders();
  })
  .then(() => {
    console.log('\n✅ Scan completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { listAllPurchaseOrders };