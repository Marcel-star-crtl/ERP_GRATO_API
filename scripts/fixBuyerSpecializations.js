const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

const fixBuyerSpecializations = async () => {
  try {
    console.log('\n🔧 FIXING BUYER SPECIALIZATIONS...\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all users with buyer details
    const buyers = await User.find({
      'buyerDetails.specializations': { $exists: true }
    });

    console.log(`Found ${buyers.length} buyers to check\n`);

    let fixed = 0;

    for (const buyer of buyers) {
      const hasInvalidSpec = buyer.buyerDetails.specializations.some(
        spec => spec === 'All' || !['IT_Accessories', 'Office_Supplies', 'Equipment', 
                                     'Consumables', 'Software', 'Hardware', 'Furniture', 
                                     'Safety_Equipment', 'Maintenance_Supplies', 'General'].includes(spec)
      );

      if (hasInvalidSpec) {
        console.log(`⚠️  Fixing ${buyer.fullName} (${buyer.email})`);
        console.log(`   Old: [${buyer.buyerDetails.specializations.join(', ')}]`);

        // Replace 'All' with all valid specializations
        buyer.buyerDetails.specializations = [
          'IT_Accessories', 'Office_Supplies', 'Equipment', 'Consumables',
          'Software', 'Hardware', 'Furniture', 'Safety_Equipment',
          'Maintenance_Supplies', 'General'
        ];

        console.log(`   New: [${buyer.buyerDetails.specializations.join(', ')}]`);

        await buyer.save();
        fixed++;
        console.log('   ✅ Fixed\n');
      }
    }

    console.log(`\n✅ Fixed ${fixed} buyer(s)`);
    console.log('✅ All buyer specializations are now valid!\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
};

fixBuyerSpecializations();