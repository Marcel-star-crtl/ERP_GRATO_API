const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
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
  // getFinanceITRequests,
  // processFinanceDecision,
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/it-support');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, 
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|log/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed!'));
    }
  }
});


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
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain'), 
  getSupervisorITRequests
);

// IT Department routes  
router.get('/it-department', 
  authMiddleware, 
  requireRoles('it', 'admin'),
  getITDepartmentRequests
);

// Finance routes 
// router.get('/finance', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   getFinanceITRequests
// );

// Admin routes 
router.get('/admin', 
  authMiddleware, 
  requireRoles('admin'), 
  getAllITRequests
);

// Create new IT support request
router.post('/', 
  authMiddleware, 
  upload.array('attachments', 5), 
  createITRequest
);

// SPECIFIC parameterized routes with static suffixes 
router.get('/supervisor/:requestId', 
  authMiddleware, 
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain'),
  getITRequestDetails
);

router.get('/it-department/:requestId', 
  authMiddleware, 
  requireRoles('it', 'admin'),
  getITRequestDetails
);

router.get('/finance/:requestId', 
  authMiddleware, 
  requireRoles('finance', 'admin'),
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
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain'), 
  processSupervisorDecision
);

router.put('/:requestId/it-department', 
  authMiddleware, 
  requireRoles('it', 'admin'),
  processITDepartmentDecision
);

// router.put('/:requestId/finance', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   processFinanceDecision
// );

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

// Download attachment route 
router.get('/:requestId/attachment/:fileName',
  authMiddleware,
  async (req, res) => {
    try {
      const { requestId, fileName } = req.params;
      const filePath = path.join(__dirname, '../uploads/it-support', fileName);

      // Check if file exists
      const fs = require('fs');
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ 
          success: false, 
          message: 'File not found' 
        });
      }

      // Send file
      res.download(filePath, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
          res.status(500).json({ 
            success: false, 
            message: 'Error downloading file' 
          });
        }
      });
    } catch (error) {
      console.error('Download attachment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download attachment',
        error: error.message
      });
    }
  }
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

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files.'
      });
    }
  }

  if (error.message.includes('Only images, PDFs, and documents are allowed!')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only images, PDFs, and documents are allowed.'
    });
  }

  next(error);
});

module.exports = router;




