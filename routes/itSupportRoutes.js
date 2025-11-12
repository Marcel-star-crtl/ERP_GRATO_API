const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const {
  createITRequest,
  updateITRequest,
  deleteITRequest,
  getEmployeeITRequests,
  getITRequestDetails,
  getSupervisorITRequests,
  processSupervisorDecision,
  getITDepartmentRequests,
  processITDepartmentDecision,
  updateFulfillmentStatus,
  updateAssetAssignment,
  getAllITRequests,
  getApprovalChainPreview,
  getITRequestsByRole,
  getDashboardStats,
  getCategoryAnalytics,
  getAssetAnalytics,
  getInventoryStatus,
  getITRequestStats,
  saveDraft
} = require('../controllers/itSupportController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// ===== FIXED FILE UPLOAD CONFIGURATION =====

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/it-support');
const ensureUploadDir = async () => {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    console.log('✅ IT Support upload directory ready:', uploadDir);
  } catch (error) {
    console.error('❌ Failed to create upload directory:', error);
  }
};
ensureUploadDir();

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${file.fieldname}-${uniqueSuffix}-${sanitizedName}`;
    console.log('📁 Saving file:', filename);
    cb(null, filename);
  }
});

// File filter with comprehensive validation
const fileFilter = (req, file, cb) => {
  console.log('🔍 Validating file:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.log'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    console.log('✅ File validation passed');
    cb(null, true);
  } else {
    console.log('❌ File validation failed');
    cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
    files: 10 // Max 10 files
  }
});

// ===== FILE DOWNLOAD ROUTE =====
router.get('/download/:requestId/:fileName',
  authMiddleware,
  async (req, res) => {
    try {
      const { requestId, fileName } = req.params;
      
      console.log('📥 Download request:', { requestId, fileName });
      
      // Verify request exists and user has access
      const ITSupportRequest = require('../models/ITSupportRequest');
      const request = await ITSupportRequest.findById(requestId);
      
      if (!request) {
        return res.status(404).json({ 
          success: false, 
          message: 'Request not found' 
        });
      }

      // Check if user has permission to download
      const hasPermission = 
        request.employee.toString() === req.user.userId ||
        req.user.role === 'admin' ||
        req.user.role === 'it' ||
        request.approvalChain?.some(step => step.approver?.email === req.user.email);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Verify file exists in request attachments
      const attachment = request.attachments?.find(att => 
        att.publicId === fileName || att.url?.includes(fileName)
      );

      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: 'File not found in request attachments'
        });
      }

      const filePath = path.join(uploadDir, fileName);
      
      // Check if file exists on disk
      try {
        await fs.access(filePath);
      } catch (error) {
        console.error('❌ File not found on disk:', filePath);
        return res.status(404).json({ 
          success: false, 
          message: 'File not found on server' 
        });
      }

      console.log('✅ Sending file:', filePath);
      
      // Set content type based on file extension
      const ext = path.extname(fileName).toLowerCase();
      const contentTypes = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain'
      };

      res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.name}"`);
      
      res.download(filePath, attachment.name, (err) => {
        if (err) {
          console.error('❌ Error downloading file:', err);
          if (!res.headersSent) {
            res.status(500).json({ 
              success: false, 
              message: 'Error downloading file' 
            });
          }
        }
      });
    } catch (error) {
      console.error('❌ Download error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download file',
        error: error.message
      });
    }
  }
);

// Dashboard and analytics routes 
router.get('/dashboard/stats',
  authMiddleware,
  getDashboardStats
);

// Statistics and reporting routes
router.get('/analytics/statistics',
  authMiddleware,
  requireRoles('admin', 'it', 'hr'),
  getITRequestStats
);

router.get('/analytics/categories',
  authMiddleware,
  requireRoles('admin', 'it'),
  getCategoryAnalytics
);

router.get('/analytics/assets',
  authMiddleware,
  requireRoles('admin', 'it'),
  getAssetAnalytics
);

// Inventory status 
router.get('/inventory/status',
  authMiddleware,
  requireRoles('admin', 'it'),
  getInventoryStatus
);

// Role-based IT requests endpoint 
router.get('/role/requests',
  authMiddleware,
  getITRequestsByRole
);

// Employee routes 
router.get('/employee', 
  authMiddleware, 
  getEmployeeITRequests
);

// Preview approval chain endpoint 
router.post('/preview-approval-chain',
  authMiddleware,
  getApprovalChainPreview
);

// Save draft endpoint 
router.post('/draft', 
  authMiddleware, 
  saveDraft
);

// Supervisor routes 
router.get('/supervisor', 
  authMiddleware, 
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain', 'technical'), 
  getSupervisorITRequests
);

// IT Department routes  
router.get('/it-department', 
  authMiddleware, 
  requireRoles('it', 'admin'),
  getITDepartmentRequests
);

// Admin routes 
router.get('/admin', 
  authMiddleware, 
  requireRoles('admin'), 
  getAllITRequests
);

// ===== CREATE IT REQUEST WITH FIXED FILE UPLOAD =====
router.post('/', 
  authMiddleware, 
  upload.array('attachments', 10), // Allow up to 10 files
  async (req, res, next) => {
    try {
      console.log('📤 Upload middleware - Files received:', req.files?.length || 0);
      
      if (req.files && req.files.length > 0) {
        req.files.forEach((file, index) => {
          console.log(`File ${index + 1}:`, {
            originalname: file.originalname,
            filename: file.filename,
            size: file.size,
            path: file.path
          });
        });
      }
      
      next();
    } catch (error) {
      console.error('❌ Upload middleware error:', error);
      next(error);
    }
  },
  createITRequest
);

// SPECIFIC parameterized routes
router.get('/supervisor/:requestId', 
  authMiddleware, 
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain', 'technical'),
  getITRequestDetails
);

router.get('/it-department/:requestId', 
  authMiddleware, 
  requireRoles('it', 'admin'),
  getITRequestDetails
);

router.get('/admin/:requestId', 
  authMiddleware, 
  requireRoles('admin'),
  getITRequestDetails
);

// PUT routes for decision processing 
router.put('/:requestId/supervisor', 
  authMiddleware, 
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain', 'technical'), 
  processSupervisorDecision
);

router.put('/:requestId/it-department', 
  authMiddleware, 
  requireRoles('it', 'admin'),
  processITDepartmentDecision
);

router.put('/:requestId/fulfillment', 
  authMiddleware, 
  requireRoles('it', 'admin'),
  updateFulfillmentStatus
);

router.put('/:requestId/asset-assignment', 
  authMiddleware, 
  requireRoles('it', 'admin'),
  updateAssetAssignment
);

// GENERIC parameterized routes 
router.put('/:requestId', 
  authMiddleware, 
  updateITRequest
);

router.delete('/:requestId', 
  authMiddleware, 
  deleteITRequest
);

// MOST GENERIC route 
router.get('/:requestId', 
  authMiddleware, 
  getITRequestDetails
);

// ===== ERROR HANDLING MIDDLEWARE =====
router.use((error, req, res, next) => {
  console.error('❌ Route error:', error);

  // Clean up uploaded files on error
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach(file => {
      fs.unlink(file.path).catch(err => 
        console.error('Failed to cleanup file:', err)
      );
    });
  }

  if (error instanceof multer.MulterError) {
    const errorMessages = {
      'LIMIT_FILE_SIZE': 'File too large. Maximum size is 25MB per file.',
      'LIMIT_FILE_COUNT': 'Too many files. Maximum is 10 files.',
      'LIMIT_UNEXPECTED_FILE': 'Unexpected file field.'
    };

    return res.status(400).json({
      success: false,
      message: errorMessages[error.code] || `Upload error: ${error.message}`,
      code: error.code
    });
  }

  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

module.exports = router;










// const express = require('express');
// const router = express.Router();
// const multer = require('multer');
// const path = require('path');
// const {
//   createITRequest,
//   updateITRequest,
//   deleteITRequest,
//   getEmployeeITRequests,
//   getITRequestDetails,
//   getSupervisorITRequests,
//   processSupervisorDecision,
//   getITDepartmentRequests,
//   processITDepartmentDecision,
//   updateFulfillmentStatus,
//   updateAssetAssignment,
//   // getFinanceITRequests,
//   // processFinanceDecision,
//   getAllITRequests,
//   getApprovalChainPreview,
//   getITRequestsByRole,
//   getDashboardStats,
//   getCategoryAnalytics,
//   getAssetAnalytics,
//   getInventoryStatus,
//   getITRequestStats,
//   saveDraft
// } = require('../controllers/itSupportController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadDir = path.join(__dirname, '../uploads/it-support');
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 10 * 1024 * 1024, 
//     files: 5 // Maximum 5 files
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|log/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);

//     if (mimetype && extname) {
//       return cb(null, true);
//     } else {
//       cb(new Error('Only images, PDFs, and documents are allowed!'));
//     }
//   }
// });


// // Dashboard and analytics routes 
// router.get('/dashboard/stats',
//   authMiddleware,
//   getDashboardStats
// );

// // Statistics and reporting routes
// router.get('/analytics/statistics',
//   authMiddleware,
//   requireRoles('admin', 'it', 'hr'),
//   getITRequestStats
// );

// router.get('/analytics/categories',
//   authMiddleware,
//   requireRoles('admin', 'it'),
//   getCategoryAnalytics
// );

// router.get('/analytics/assets',
//   authMiddleware,
//   requireRoles('admin', 'it'),
//   getAssetAnalytics
// );

// // Inventory status 
// router.get('/inventory/status',
//   authMiddleware,
//   requireRoles('admin', 'it'),
//   getInventoryStatus
// );

// // Role-based IT requests endpoint 
// router.get('/role/requests',
//   authMiddleware,
//   getITRequestsByRole
// );

// // Employee routes 
// router.get('/employee', 
//   authMiddleware, 
//   getEmployeeITRequests
// );

// // Preview approval chain endpoint 
// router.post('/preview-approval-chain',
//   authMiddleware,
//   getApprovalChainPreview
// );

// // Save draft endpoint 
// router.post('/draft', 
//   authMiddleware, 
//   saveDraft
// );

// // Supervisor routes 
// router.get('/supervisor', 
//   authMiddleware, 
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain'), 
//   getSupervisorITRequests
// );

// // IT Department routes  
// router.get('/it-department', 
//   authMiddleware, 
//   requireRoles('it', 'admin'),
//   getITDepartmentRequests
// );

// // Admin routes 
// router.get('/admin', 
//   authMiddleware, 
//   requireRoles('admin'), 
//   getAllITRequests
// );

// // Create new IT support request
// router.post('/', 
//   authMiddleware, 
//   upload.array('attachments', 5), 
//   createITRequest
// );

// // SPECIFIC parameterized routes with static suffixes 
// router.get('/supervisor/:requestId', 
//   authMiddleware, 
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain'),
//   getITRequestDetails
// );

// router.get('/it-department/:requestId', 
//   authMiddleware, 
//   requireRoles('it', 'admin'),
//   getITRequestDetails
// );

// router.get('/finance/:requestId', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   getITRequestDetails
// );

// router.get('/admin/:requestId', 
//   authMiddleware, 
//   requireRoles('admin'),
//   getITRequestDetails
// );

// // PUT routes for decision processing 
// router.put('/:requestId/supervisor', 
//   authMiddleware, 
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain'), 
//   processSupervisorDecision
// );

// router.put('/:requestId/it-department', 
//   authMiddleware, 
//   requireRoles('it', 'admin'),
//   processITDepartmentDecision
// );

// // router.put('/:requestId/finance', 
// //   authMiddleware, 
// //   requireRoles('finance', 'admin'),
// //   processFinanceDecision
// // );

// router.put('/:requestId/fulfillment', 
//   authMiddleware, 
//   requireRoles('it', 'admin'),
//   updateFulfillmentStatus
// );

// router.put('/:requestId/asset-assignment', 
//   authMiddleware, 
//   requireRoles('it', 'admin'),
//   updateAssetAssignment
// );

// // Download attachment route 
// router.get('/:requestId/attachment/:fileName',
//   authMiddleware,
//   async (req, res) => {
//     try {
//       const { requestId, fileName } = req.params;
//       const filePath = path.join(__dirname, '../uploads/it-support', fileName);

//       // Check if file exists
//       const fs = require('fs');
//       if (!fs.existsSync(filePath)) {
//         return res.status(404).json({ 
//           success: false, 
//           message: 'File not found' 
//         });
//       }

//       // Send file
//       res.download(filePath, (err) => {
//         if (err) {
//           console.error('Error downloading file:', err);
//           res.status(500).json({ 
//             success: false, 
//             message: 'Error downloading file' 
//           });
//         }
//       });
//     } catch (error) {
//       console.error('Download attachment error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to download attachment',
//         error: error.message
//       });
//     }
//   }
// );

// // GENERIC parameterized routes 
// router.put('/:requestId', 
//   authMiddleware, 
//   updateITRequest
// );

// router.delete('/:requestId', 
//   authMiddleware, 
//   deleteITRequest
// );

// // MOST GENERIC route 
// router.get('/:requestId', 
//   authMiddleware, 
//   getITRequestDetails
// );

// // Error handling middleware for multer
// router.use((error, req, res, next) => {
//   if (error instanceof multer.MulterError) {
//     if (error.code === 'LIMIT_FILE_SIZE') {
//       return res.status(400).json({
//         success: false,
//         message: 'File too large. Maximum size is 10MB.'
//       });
//     }
//     if (error.code === 'LIMIT_FILE_COUNT') {
//       return res.status(400).json({
//         success: false,
//         message: 'Too many files. Maximum is 5 files.'
//       });
//     }
//   }

//   if (error.message.includes('Only images, PDFs, and documents are allowed!')) {
//     return res.status(400).json({
//       success: false,
//       message: 'Invalid file type. Only images, PDFs, and documents are allowed.'
//     });
//   }

//   next(error);
// });

// module.exports = router;




