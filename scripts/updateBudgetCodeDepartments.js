const mongoose = require('mongoose');
require('dotenv').config();

const budgetCodeSchema = new mongoose.Schema({}, { strict: false });
const BudgetCode = mongoose.model('BudgetCode', budgetCodeSchema);

async function migrateDepartments() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('🔄 Updating budget code departments...');
    
    const result = await BudgetCode.updateMany(
      { department: 'Roll Out' },
      { $set: { department: 'Technical Roll Out' } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} budget code(s)`);
    
    // Verify the update
    const remaining = await BudgetCode.countDocuments({ department: 'Roll Out' });
    console.log(`Remaining with old value: ${remaining}`);
    
    if (remaining === 0) {
      console.log('✅ Migration successful!');
    } else {
      console.log('⚠️  Some records still have old value');
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateDepartments();