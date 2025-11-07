const fixDuplicateCodes = async () => {
  try {
    console.log('Starting duplicate code fix...');
    
    // Find all inventory items grouped by code
    const duplicates = await Inventory.aggregate([
      { $match: { isActive: true } },
      { $group: {
        _id: '$code',
        count: { $sum: 1 },
        items: { $push: '$$ROOT' }
      }},
      { $match: { count: { $gt: 1 } }}
    ]);
    
    console.log(`Found ${duplicates.length} duplicate codes`);
    
    for (const dup of duplicates) {
      console.log(`Fixing code: ${dup._id} (${dup.count} duplicates)`);
      
      // Keep first one as-is, update others with suffixes
      for (let i = 1; i < dup.items.length; i++) {
        const item = dup.items[i];
        const newCode = `${dup._id}-${i}`;
        
        await Inventory.findByIdAndUpdate(item._id, {
          $set: { code: newCode }
        });
        
        console.log(`  Updated ${item._id}: ${dup._id} → ${newCode}`);
      }
    }
    
    console.log('Duplicate code fix complete');
  } catch (error) {
    console.error('Error fixing duplicates:', error);
  }
};
