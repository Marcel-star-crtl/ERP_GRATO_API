// scripts/fix-file-paths.js
const mongoose = require('mongoose');
const CashRequest = require('../models/CashRequest');
const path = require('path');
const fs = require('fs');

async function fixFilePaths() {
  const requests = await CashRequest.find({
    'justification.documents.0': { $exists: true }
  });
  
  const uploadsBase = path.resolve(process.cwd(), 'uploads');
  let fixed = 0;
  
  for (const request of requests) {
    let updated = false;
    
    for (const doc of request.justification.documents) {
      if (!doc.localPath || !fs.existsSync(doc.localPath)) {
        // Try to find file
        const searchPath = path.join(uploadsBase, 'justifications', doc.publicId);
        
        if (fs.existsSync(searchPath)) {
          doc.localPath = searchPath;
          updated = true;
        }
      }
    }
    
    if (updated) {
      await request.save();
      fixed++;
    }
  }
  
  console.log(`Fixed ${fixed} requests`);
}