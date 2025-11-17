const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');

/**
 * Local File Storage Service
 * Replaces Cloudinary with local file system storage
 */

// Base upload directory (adjust this path as needed)
const BASE_UPLOAD_DIR = path.join(__dirname, '../uploads');

// Storage categories
const STORAGE_CATEGORIES = {
  CASH_REQUESTS: 'cash-requests',
  JUSTIFICATIONS: 'justifications',
  REIMBURSEMENTS: 'reimbursements',
  SUPPLIER_INVOICES: 'supplier-invoices',
  EMPLOYEE_INVOICES: 'employee-invoices',
  SUPPLIER_DOCUMENTS: 'supplier-documents',
  CONTRACTS: 'contracts',
  SIGNED_DOCUMENTS: 'signed-documents'
};

/**
 * Initialize storage directories
 */
const initializeStorageDirectories = async () => {
  const directories = [
    BASE_UPLOAD_DIR,
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.CASH_REQUESTS, 'attachments'),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.CASH_REQUESTS, 'receipts'),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.JUSTIFICATIONS),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.REIMBURSEMENTS),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.SUPPLIER_INVOICES, 'invoices'),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.SUPPLIER_INVOICES, 'po-files'),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.SUPPLIER_INVOICES, 'signed-documents'),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.EMPLOYEE_INVOICES),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.SUPPLIER_DOCUMENTS),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.CONTRACTS),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.SIGNED_DOCUMENTS, 'supply-chain'),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.SIGNED_DOCUMENTS, 'level-1'),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.SIGNED_DOCUMENTS, 'level-2'),
    path.join(BASE_UPLOAD_DIR, STORAGE_CATEGORIES.SIGNED_DOCUMENTS, 'level-3'),
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true, mode: 0o755 });
      console.log(`✓ Directory ready: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error);
      throw error;
    }
  }
};

/**
 * Generate unique filename
 */
const generateUniqueFilename = (originalName, prefix = '') => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50); // Limit length
  
  return `${prefix}${prefix ? '-' : ''}${baseName}-${timestamp}-${randomString}${ext}`;
};

/**
 * Save file to local storage
 * @param {Object} file - Multer file object
 * @param {String} category - Storage category (from STORAGE_CATEGORIES)
 * @param {String} subfolder - Optional subfolder within category
 * @param {String} customFilename - Optional custom filename
 * @returns {Object} File metadata
 */
const saveFile = async (file, category, subfolder = '', customFilename = null) => {
  try {
    console.log(`\n💾 Saving file to local storage...`);
    console.log(`   Category: ${category}`);
    console.log(`   Subfolder: ${subfolder || 'none'}`);
    console.log(`   Original: ${file.originalname}`);
    
    // Construct destination path
    const destDir = subfolder 
      ? path.join(BASE_UPLOAD_DIR, category, subfolder)
      : path.join(BASE_UPLOAD_DIR, category);
    
    // Ensure directory exists
    await fs.mkdir(destDir, { recursive: true, mode: 0o755 });
    
    // Generate filename
    const filename = customFilename || generateUniqueFilename(file.originalname);
    const destPath = path.join(destDir, filename);
    
    // Copy file from temp location
    await fs.copyFile(file.path, destPath);
    
    // Get file stats
    const stats = await fs.stat(destPath);
    
    // Generate URL for accessing the file
    // This will be used by your Express static file server
    const relativePath = path.relative(BASE_UPLOAD_DIR, destPath).replace(/\\/g, '/');
    const fileUrl = `/uploads/${relativePath}`;
    
    console.log(`   ✓ Saved to: ${destPath}`);
    console.log(`   ✓ URL: ${fileUrl}`);
    
    // Return metadata similar to Cloudinary format for compatibility
    return {
      publicId: filename,
      url: fileUrl,
      localPath: destPath,
      format: path.extname(file.originalname).substring(1),
      resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw',
      bytes: stats.size,
      originalName: file.originalname,
      uploadedAt: new Date()
    };
  } catch (error) {
    console.error(`❌ Failed to save file:`, error);
    throw new Error(`Failed to save file: ${error.message}`);
  }
};

/**
 * Delete file from local storage
 */
const deleteFile = async (fileMetadata) => {
  try {
    if (!fileMetadata || !fileMetadata.localPath) {
      console.warn('⚠️  No local path provided for deletion');
      return { success: false, error: 'No local path' };
    }
    
    const filePath = fileMetadata.localPath;
    
    // Check if file exists
    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
      console.log(`✓ Deleted file: ${filePath}`);
      return { success: true };
    } else {
      console.warn(`⚠️  File not found: ${filePath}`);
      return { success: false, error: 'File not found' };
    }
  } catch (error) {
    console.error(`❌ Failed to delete file:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete multiple files
 */
const deleteFiles = async (fileMetadataArray) => {
  if (!Array.isArray(fileMetadataArray)) {
    return { success: false, error: 'Input must be an array' };
  }
  
  const results = [];
  for (const metadata of fileMetadataArray) {
    const result = await deleteFile(metadata);
    results.push({ ...result, file: metadata.originalName || metadata.publicId });
  }
  
  return {
    success: results.every(r => r.success),
    results
  };
};

/**
 * Get file from local storage
 */
const getFile = async (fileMetadata) => {
  try {
    if (!fileMetadata || !fileMetadata.localPath) {
      throw new Error('No local path provided');
    }
    
    const filePath = fileMetadata.localPath;
    
    // Check if file exists
    if (!fsSync.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    // Read file
    const fileBuffer = await fs.readFile(filePath);
    
    return {
      buffer: fileBuffer,
      path: filePath,
      metadata: fileMetadata
    };
  } catch (error) {
    console.error(`❌ Failed to get file:`, error);
    throw error;
  }
};

/**
 * Move file between categories
 */
const moveFile = async (fileMetadata, newCategory, newSubfolder = '') => {
  try {
    if (!fileMetadata || !fileMetadata.localPath) {
      throw new Error('No local path provided');
    }
    
    const oldPath = fileMetadata.localPath;
    
    // Construct new path
    const newDir = newSubfolder 
      ? path.join(BASE_UPLOAD_DIR, newCategory, newSubfolder)
      : path.join(BASE_UPLOAD_DIR, newCategory);
    
    await fs.mkdir(newDir, { recursive: true, mode: 0o755 });
    
    const filename = path.basename(oldPath);
    const newPath = path.join(newDir, filename);
    
    // Move file
    await fs.rename(oldPath, newPath);
    
    // Generate new URL
    const relativePath = path.relative(BASE_UPLOAD_DIR, newPath).replace(/\\/g, '/');
    const newUrl = `/uploads/${relativePath}`;
    
    console.log(`✓ Moved file from ${oldPath} to ${newPath}`);
    
    return {
      ...fileMetadata,
      localPath: newPath,
      url: newUrl
    };
  } catch (error) {
    console.error(`❌ Failed to move file:`, error);
    throw error;
  }
};

/**
 * Get storage statistics
 */
const getStorageStats = async () => {
  try {
    const stats = {};
    
    for (const [key, category] of Object.entries(STORAGE_CATEGORIES)) {
      const categoryPath = path.join(BASE_UPLOAD_DIR, category);
      
      if (fsSync.existsSync(categoryPath)) {
        const files = await fs.readdir(categoryPath, { recursive: true });
        let totalSize = 0;
        let fileCount = 0;
        
        for (const file of files) {
          const filePath = path.join(categoryPath, file);
          try {
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
              totalSize += stat.size;
              fileCount++;
            }
          } catch (err) {
            // Skip if file doesn't exist or can't be accessed
            continue;
          }
        }
        
        stats[key] = {
          path: categoryPath,
          fileCount,
          totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
        };
      } else {
        stats[key] = { path: categoryPath, fileCount: 0, totalSize: 0 };
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    throw error;
  }
};

/**
 * Clean up old temporary files
 */
const cleanupOldTempFiles = async (maxAgeHours = 24) => {
  try {
    const tempDir = path.join(BASE_UPLOAD_DIR, '../uploads/temp');
    
    if (!fsSync.existsSync(tempDir)) {
      return { success: true, deletedCount: 0 };
    }
    
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;
        
        if (age > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
          console.log(`✓ Deleted old temp file: ${file}`);
        }
      } catch (err) {
        console.warn(`⚠️  Failed to process temp file ${file}:`, err.message);
      }
    }
    
    console.log(`🧹 Cleanup complete: ${deletedCount} old temp files deleted`);
    return { success: true, deletedCount };
  } catch (error) {
    console.error('Failed to cleanup temp files:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  // Core functions
  saveFile,
  deleteFile,
  deleteFiles,
  getFile,
  moveFile,
  
  // Utilities
  initializeStorageDirectories,
  generateUniqueFilename,
  getStorageStats,
  cleanupOldTempFiles,
  
  // Constants
  BASE_UPLOAD_DIR,
  STORAGE_CATEGORIES
};