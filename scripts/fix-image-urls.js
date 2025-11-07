const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect('mongodb+srv://marcelngong50:dp1d6ABP6ggkvQli@cluster0.9nhviyl.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Item = require('../models/Item');

async function fixImageUrls() {
  try {
    console.log('Finding items with double .png.png extensions...');
    
    const itemsToFix = await Item.find({
      imageUrl: { $regex: /\.png\.png$/ }
    });
    
    console.log(`Found ${itemsToFix.length} items to fix:`);
    
    for (const item of itemsToFix) {
      const oldImageUrl = item.imageUrl;
      const newImageUrl = oldImageUrl.replace(/\.png\.png$/, '.png');
      
      console.log(`Fixing item "${item.description}": ${oldImageUrl} -> ${newImageUrl}`);
      
      await Item.updateOne(
        { _id: item._id },
        { $set: { imageUrl: newImageUrl } }
      );
      
      console.log(`✓ Fixed!`);
    }
    
    console.log('All items fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing image URLs:', error);
    process.exit(1);
  }
}

fixImageUrls();