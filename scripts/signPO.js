require('dotenv').config(); // reads from your existing .env file
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error('❌ No MongoDB URI found. Check your .env file for MONGODB_URI, MONGO_URI, or DATABASE_URL');
  process.exit(1);
}

async function approvePO() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;

  const poId = new mongoose.Types.ObjectId('69a59ed918d73f51d14bdab9');
  const approverId = new mongoose.Types.ObjectId('691abf59c7430e81c19846ab');
  const now = new Date();

  // Use updateOne ONLY — never insert
  const result = await db.collection('purchaseorders').updateOne(
    {
      _id: poId,
      'approvalChain.0.status': 'pending' // safety check
    },
    {
      $set: {
        // Approve level 1
        'approvalChain.0.status': 'approved',
        'approvalChain.0.approvedBy': approverId,
        'approvalChain.0.approvedAt': now,
        'approvalChain.0.updatedAt': now,

        // Activate level 2 (Mr. E.T Kelvin)
        'approvalChain.1.activatedDate': now,
        'approvalChain.1.updatedAt': now,

        // Advance the PO
        currentApprovalLevel: 2,
        status: 'pending_department_approval',
        progress: 50,
        updatedAt: now,
        lastModifiedDate: now,
      },
      $push: {
        activities: {
          _id: new mongoose.Types.ObjectId(),
          type: 'approved',
          description: 'Purchase order approved by Department Head (IT)',
          timestamp: now,
          user: 'Mr. Marcel Ngong',
        }
      }
    }
  );

  if (result.modifiedCount === 1) {
    console.log('✅ PO-2026-000033 approved successfully by Marcel Ngong (Level 1)');
  } else if (result.matchedCount === 0) {
    console.log('⚠️  PO not found or already approved at level 1');
  } else {
    console.log('⚠️  PO matched but not modified');
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

approvePO().catch((err) => {
  console.error('❌ Error:', err.message);
  mongoose.disconnect();
});