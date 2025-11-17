const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { BASE_UPLOAD_DIR } = require('../utils/localFileStorage');

/**
 * Download file by publicId
 * GET /api/files/download/:publicId
 */
router.get('/download/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    console.log('📥 File download request:', publicId);
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'File ID is required'
      });
    }

    // Search for the file in all subdirectories of uploads
    const filePath = await findFile(BASE_UPLOAD_DIR, publicId);
    
    if (!filePath) {
      console.warn(`❌ File not found: ${publicId}`);
      return res.status(404).json({
        success: false,
        message: 'File not found. It may have been moved or deleted.',
        publicId
      });
    }

    console.log(`✅ File found: ${filePath}`);

    // Check if file exists and is accessible
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
        publicId
      });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `attachment; filename="${publicId}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error reading file'
        });
      }
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
});

/**
 * View/Preview file by publicId
 * GET /api/files/view/:publicId
 */
router.get('/view/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    console.log('👁️ File view request:', publicId);
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'File ID is required'
      });
    }

    const filePath = await findFile(BASE_UPLOAD_DIR, publicId);
    
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
        publicId
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
        publicId
      });
    }

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers for inline display
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${publicId}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error reading file'
        });
      }
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('File view error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to view file',
      error: error.message
    });
  }
});

/**
 * Get file info by publicId
 * GET /api/files/info/:publicId
 */
router.get('/info/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'File ID is required'
      });
    }

    const filePath = await findFile(BASE_UPLOAD_DIR, publicId);
    
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
        publicId
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
        publicId
      });
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath);

    res.json({
      success: true,
      data: {
        publicId,
        name: publicId,
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2),
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
        extension: ext,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        path: filePath.replace(BASE_UPLOAD_DIR, '/uploads')
      }
    });

  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file info',
      error: error.message
    });
  }
});

/**
 * Helper function to recursively search for a file by name
 */
async function findFile(directory, filename) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recursively search subdirectories
      const found = await findFile(filePath, filename);
      if (found) return found;
    } else if (file === filename) {
      return filePath;
    }
  }
  
  return null;
}

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'File service is running',
    uploadDir: BASE_UPLOAD_DIR,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;










// const express = require('express');
// const router = express.Router();
// const { authMiddleware } = require('../middlewares/authMiddleware');
// const fileController = require('../controllers/fileController');

// // All file routes require authentication
// router.use(authMiddleware);

// // Download a file
// router.get('/download/:publicId', fileController.downloadFile);

// // View a file inline (PDFs, images)
// router.get('/view/:publicId', fileController.viewFile);

// // Get file info
// router.get('/info/:publicId', fileController.getFileInfo);

// module.exports = router;





