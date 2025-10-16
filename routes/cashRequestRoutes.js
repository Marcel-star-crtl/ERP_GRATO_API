const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const cashRequestController = require('../controllers/cashRequestController');

// Import error handlers from upload middleware
const { handleMulterError, cleanupTempFiles, validateFiles } = require('../middlewares/uploadMiddleware');

router.get(
  '/dashboard-stats',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'finance'),
  async (req, res) => {
    try {
      const CashRequest = require('../models/CashRequest');
      const User = require('../models/User');
      
      const user = await User.findById(req.user.userId);
      
      let filter = {};
      
      if (user.role === 'employee') {
        filter = { employee: req.user.userId };
      } else if (user.role === 'supervisor') {
        filter = {
          'approvalChain': {
            $elemMatch: {
              'approver.email': user.email,
              'status': 'pending'
            }
          }
        };
      } else if (user.role === 'finance') {
        filter = {
          $or: [
            { status: 'pending_finance' },
            { status: 'approved' },
            { status: 'disbursed' }
          ]
        };
      }
      
      const stats = {
        total: await CashRequest.countDocuments(filter),
        pending: await CashRequest.countDocuments({ ...filter, status: /pending/ }),
        approved: await CashRequest.countDocuments({ ...filter, status: 'approved' }),
        disbursed: await CashRequest.countDocuments({ ...filter, status: 'disbursed' }),
        completed: await CashRequest.countDocuments({ ...filter, status: 'completed' }),
        denied: await CashRequest.countDocuments({ ...filter, status: 'denied' })
      };
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard stats',
        error: error.message
      });
    }
  }
);

// ============================================
// APPROVAL CHAIN PREVIEW (before generic routes)
// ============================================
router.post(
  '/approval-chain-preview',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'finance'),
  cashRequestController.getApprovalChainPreview
);

// ============================================
// EMPLOYEE ROUTES
// ============================================

// Get employee's own requests
router.get(
  '/employee',
  authMiddleware,
  cashRequestController.getEmployeeRequests
);

// Get request for justification submission
router.get(
  '/employee/:requestId/justification',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
  cashRequestController.getRequestForJustification
);

// Get single request details (employee's own)
router.get(
  '/employee/:requestId',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
  cashRequestController.getEmployeeRequest
);

// ============================================
// SUPERVISOR ROUTES (ALL SPECIFIC PATHS FIRST)
// ============================================

// Get supervisor justification approvals - MUST BE BEFORE /supervisor/:requestId
router.get(
  '/supervisor/justifications',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
  cashRequestController.getSupervisorJustifications
);

// Get single justification for supervisor review - MUST BE BEFORE /supervisor/:requestId
router.get(
  '/supervisor/justification/:requestId',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
  cashRequestController.getSupervisorJustification
);

// Get supervisor's pending approvals
router.get(
  '/supervisor',
  authMiddleware,
  cashRequestController.getSupervisorRequests
);

// Get single request for supervisor approval - GENERIC, COMES LAST IN SUPERVISOR SECTION
router.get(
  '/supervisor/:requestId',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
  cashRequestController.getSupervisorRequest
);

// ============================================
// FINANCE ROUTES (SPECIFIC PATHS FIRST)
// ============================================

// Get finance justifications - MUST BE BEFORE /:requestId/finance
router.get(
  '/finance/justifications',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getFinanceJustifications
);

// Get finance requests (pending approval and disbursement)
router.get(
  '/finance',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getFinanceRequests
);

// ============================================
// ADMIN ROUTES (SPECIFIC PATHS FIRST)
// ============================================

// Get detailed request info (admin)
router.get(
  '/admin/:requestId',
  authMiddleware,
  requireRoles('admin'),
  cashRequestController.getAdminRequestDetails
);

// Get all cash requests (admin oversight)
router.get(
  '/admin',
  authMiddleware,
  requireRoles('admin'),
  cashRequestController.getAllRequests
);

// ============================================
// CREATE REQUEST (POST - before PUT routes)
// ============================================

router.post(
  '/',
  authMiddleware,
  (req, res, next) => {
    console.log('\n=== CASH REQUEST UPLOAD INITIATED ===');
    console.log('User:', req.user?.userId);
    console.log('Content-Type:', req.headers['content-type']);
    next();
  },
  upload.array('attachments', 10),
  handleMulterError,
  validateFiles,
  (req, res, next) => {
    console.log('Files uploaded successfully:');
    if (req.files) {
      req.files.forEach(file => {
        console.log(`  - ${file.originalname} (${file.size} bytes) at ${file.path}`);
      });
    }
    next();
  },
  cashRequestController.createRequest,
  cleanupTempFiles
);

// ============================================
// PUT/UPDATE ROUTES (SPECIFIC PATHS FIRST)
// ============================================

// Process supervisor justification decision - BEFORE /:requestId/supervisor
router.put(
  '/:requestId/supervisor/justification',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
  cashRequestController.processSupervisorJustificationDecision
);

// Process supervisor approval/denial decision
router.put(
  '/:requestId/supervisor',
  authMiddleware,
  cashRequestController.processSupervisorDecision
);

// Process finance justification decision - BEFORE /:requestId/finance
router.put(
  '/:requestId/finance/justification',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processFinanceJustificationDecision
);

// Process finance approval/denial with budget allocation
router.put(
  '/:requestId/finance',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processFinanceDecision
);

// ============================================
// SUBMIT JUSTIFICATION (POST with files)
// ============================================

router.post(
  '/:requestId/justification',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
  upload.array('documents', 10),
  handleMulterError,
  validateFiles,
  cashRequestController.submitJustification,
  cleanupTempFiles
);

// ============================================
// GENERIC ROUTES (MUST BE LAST)
// ============================================

// Get single request by ID - MUST BE LAST
router.get(
  '/:requestId',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const CashRequest = require('../models/CashRequest');
      const User = require('../models/User');

      console.log(`\n=== GET REQUEST DETAILS ===`);
      console.log(`Request ID: ${requestId}`);
      console.log(`User: ${req.user.userId} (${req.user.role})`);

      const request = await CashRequest.findById(requestId)
        .populate('employee', 'fullName email department position')
        .populate('projectId', 'name code')
        .populate('budgetAllocation.budgetCodeId', 'code name');

      if (!request) {
        console.log('❌ Request not found');
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      const user = await User.findById(req.user.userId);

      // Check if user has permission to view this request
      const isOwner = request.employee._id.equals(req.user.userId);
      const isApprover = request.approvalChain.some(step => 
        step.approver.email === user.email
      );
      const isAdmin = user.role === 'admin';
      const isFinance = user.role === 'finance';

      if (!isOwner && !isApprover && !isAdmin && !isFinance) {
        console.log('❌ Access denied');
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      console.log('✅ Request found and access granted');
      console.log(`Status: ${request.status}`);

      res.json({
        success: true,
        data: request
      });

    } catch (error) {
      console.error('Get request details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch request details',
        error: error.message
      });
    }
  }
);

// ============================================
// ERROR HANDLING MIDDLEWARE (MUST BE LAST)
// ============================================

router.use((error, req, res, next) => {
  console.error('Cash request route error:', error);
  
  if (req.files) {
    const { cleanupFiles } = require('../middleware/upload');
    cleanupFiles(req.files);
  }
  
  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

module.exports = router;










// const express = require('express');
// const router = express.Router();
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const upload = require('../middlewares/uploadMiddleware');
// const cashRequestController = require('../controllers/cashRequestController');

// // Import error handlers from upload middleware
// const { handleMulterError, cleanupTempFiles, validateFiles } = require('../middlewares/uploadMiddleware');

// // ============================================
// // EMPLOYEE ROUTES
// // ============================================

// // Get employee's own requests
// router.get(
//   '/employee',
//   authMiddleware,
// //  requireRoles(['employee', 'supervisor', 'admin', 'finance']),
//   cashRequestController.getEmployeeRequests
// );

// // Get single request details (employee's own)
// router.get(
//   '/employee/:requestId',
//   authMiddleware,
//  requireRoles('employee', 'supervisor', 'admin', 'finance'),
//   cashRequestController.getEmployeeRequest
// );

// // Create new cash request with file upload
// router.post(
//   '/',
//   authMiddleware,
//   // requireRoles(['employee', 'supervisor', 'admin', 'finance', 'it']),
//   (req, res, next) => {
//     console.log('\n=== CASH REQUEST UPLOAD INITIATED ===');
//     console.log('User:', req.user?.userId);
//     console.log('Content-Type:', req.headers['content-type']);
//     next();
//   },
//   upload.array('attachments', 10), // Allow up to 10 files
//   handleMulterError, // Handle multer errors
//   validateFiles, // Validate uploaded files
//   (req, res, next) => {
//     console.log('Files uploaded successfully:');
//     if (req.files) {
//       req.files.forEach(file => {
//         console.log(`  - ${file.originalname} (${file.size} bytes) at ${file.path}`);
//       });
//     }
//     next();
//   },
//   cashRequestController.createRequest,
//   cleanupTempFiles // Cleanup after response
// );

// // Submit justification with receipts
// router.post(
//   '/:requestId/justification',
//   authMiddleware,
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
//   upload.array('documents', 10),
//   handleMulterError,
//   validateFiles,
//   cashRequestController.submitJustification,
//   cleanupTempFiles
// );

// // Get request for justification submission
// router.get(
//   '/:requestId/justification',
//   authMiddleware,
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
//   cashRequestController.getRequestForJustification
// );

// // ============================================
// // SUPERVISOR ROUTES
// // ============================================

// // Get supervisor's pending approvals
// router.get(
//   '/supervisor',
//   authMiddleware,
// //  requireRoles('supervisor', 'admin'),
//   cashRequestController.getSupervisorRequests
// );

// // Get single request for supervisor approval
// router.get(
//   '/supervisor/:requestId',
//   authMiddleware,
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
//   cashRequestController.getSupervisorRequest
// );

// // Process supervisor approval/denial decision
// router.put(
//   '/:requestId/supervisor',
//   authMiddleware,
// //  requireRoles('supervisor', 'admin', 'hr'),
//   cashRequestController.processSupervisorDecision
// );

// // Get supervisor justification approvals
// router.get(
//   '/supervisor/justifications',
//   authMiddleware,
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
//   cashRequestController.getSupervisorJustifications
// );

// // Get single justification for supervisor review
// router.get(
//   '/supervisor/justification/:requestId',
//   authMiddleware,
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
//   cashRequestController.getSupervisorJustification
// );

// // Process supervisor justification decision
// router.put(
//   '/:requestId/supervisor/justification',
//   authMiddleware,
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
//   cashRequestController.processSupervisorJustificationDecision
// );

// // ============================================
// // FINANCE ROUTES
// // ============================================

// // Get finance requests (pending approval and disbursement)
// router.get(
//   '/finance',
//   authMiddleware,
//  requireRoles('finance', 'admin'),
//   cashRequestController.getFinanceRequests
// );

// // Process finance approval/denial with budget allocation
// router.put(
//   '/:requestId/finance',
//   authMiddleware,
//  requireRoles('finance', 'admin'),
//   cashRequestController.processFinanceDecision
// );

// // Get finance justifications
// router.get(
//   '/finance/justifications',
//   authMiddleware,
//  requireRoles('finance', 'admin'),
//   cashRequestController.getFinanceJustifications
// );

// // Process finance justification decision
// router.put(
//   '/:requestId/finance/justification',
//   authMiddleware,
//  requireRoles('finance', 'admin'),
//   cashRequestController.processFinanceJustificationDecision
// );

// // ============================================
// // ADMIN ROUTES
// // ============================================

// // Get all cash requests (admin oversight)
// router.get(
//   '/admin',
//   authMiddleware,
//  requireRoles('admin'),
//   cashRequestController.getAllRequests
// );

// // Get detailed request info (admin)
// router.get(
//   '/admin/:requestId',
//   authMiddleware,
//  requireRoles('admin'),
//   cashRequestController.getAdminRequestDetails
// );

// // ============================================
// // UTILITY ROUTES
// // ============================================

// // Get approval chain preview (for form)
// router.post(
//   '/approval-chain-preview',
//   authMiddleware,
//  requireRoles('employee', 'supervisor', 'admin', 'finance'),
//   cashRequestController.getApprovalChainPreview
// );

// // Dashboard stats
// router.get(
//   '/dashboard-stats',
//   authMiddleware,
//  requireRoles('employee', 'supervisor', 'admin', 'finance'),
//   async (req, res) => {
//     try {
//       const CashRequest = require('../models/CashRequest');
//       const User = require('../models/User');
      
//       const user = await User.findById(req.user.userId);
      
//       let filter = {};
      
//       if (user.role === 'employee') {
//         filter = { employee: req.user.userId };
//       } else if (user.role === 'supervisor') {
//         filter = {
//           'approvalChain': {
//             $elemMatch: {
//               'approver.email': user.email,
//               'status': 'pending'
//             }
//           }
//         };
//       } else if (user.role === 'finance') {
//         filter = {
//           $or: [
//             { status: 'pending_finance' },
//             { status: 'approved' },
//             { status: 'disbursed' }
//           ]
//         };
//       }
      
//       const stats = {
//         total: await CashRequest.countDocuments(filter),
//         pending: await CashRequest.countDocuments({ ...filter, status: /pending/ }),
//         approved: await CashRequest.countDocuments({ ...filter, status: 'approved' }),
//         disbursed: await CashRequest.countDocuments({ ...filter, status: 'disbursed' }),
//         completed: await CashRequest.countDocuments({ ...filter, status: 'completed' }),
//         denied: await CashRequest.countDocuments({ ...filter, status: 'denied' })
//       };
      
//       res.json({
//         success: true,
//         data: stats
//       });
      
//     } catch (error) {
//       console.error('Dashboard stats error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch dashboard stats',
//         error: error.message
//       });
//     }
//   }
// );


// router.get(
//   '/:requestId',
//   authMiddleware,
//   // requireRoles('employee', 'supervisor', 'admin', 'finance',),
//   async (req, res, next) => {
//     try {
//       const { requestId } = req.params;
//       const CashRequest = require('../models/CashRequest');
//       const User = require('../models/User');

//       console.log(`\n=== GET REQUEST DETAILS ===`);
//       console.log(`Request ID: ${requestId}`);
//       console.log(`User: ${req.user.userId} (${req.user.role})`);

//       const request = await CashRequest.findById(requestId)
//         .populate('employee', 'fullName email department position')
//         .populate('projectId', 'name code')
//         .populate('budgetAllocation.budgetCodeId', 'code name');

//       if (!request) {
//         console.log('❌ Request not found');
//         return res.status(404).json({
//           success: false,
//           message: 'Request not found'
//         });
//       }

//       const user = await User.findById(req.user.userId);

//       // Check if user has permission to view this request
//       const isOwner = request.employee._id.equals(req.user.userId);
//       const isApprover = request.approvalChain.some(step => 
//         step.approver.email === user.email
//       );
//       const isAdmin = user.role === 'admin';
//       const isFinance = user.role === 'finance';

//       if (!isOwner && !isApprover && !isAdmin && !isFinance) {
//         console.log('❌ Access denied');
//         return res.status(403).json({
//           success: false,
//           message: 'Access denied'
//         });
//       }

//       console.log('✅ Request found and access granted');
//       console.log(`Status: ${request.status}`);

//       res.json({
//         success: true,
//         data: request
//       });

//     } catch (error) {
//       console.error('Get request details error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch request details',
//         error: error.message
//       });
//     }
//   }
// );


// // Error handling middleware for this router
// router.use((error, req, res, next) => {
//   console.error('Cash request route error:', error);
  
//   // Cleanup any uploaded files on error
//   if (req.files) {
//     const { cleanupFiles } = require('../middleware/upload');
//     cleanupFiles(req.files);
//   }
  
//   res.status(500).json({
//     success: false,
//     message: error.message || 'Internal server error',
//     error: process.env.NODE_ENV === 'development' ? error.stack : undefined
//   });
// });

// module.exports = router;












// const express = require('express');
// const router = express.Router();
// const multer = require('multer');
// const path = require('path');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const {
//   createRequest,
//   processApprovalDecision,
//   getPendingApprovals,
//   getAdminApprovals,
//   getSupervisorRequests,
//   processSupervisorDecision,
//   getEmployeeRequests,
//   getEmployeeRequest,
//   getAllRequests,
//   getFinanceRequests,
//   processFinanceDecision,
//   getApprovalChainPreview,
//   getSupervisorJustifications,
//   getFinanceJustifications,
//   submitJustification,
//   getAdminRequestDetails,
//   processSupervisorJustificationDecision,
//   processFinanceJustificationDecision,
//   getRequestForJustification,
//   getSupervisorRequest,
//   getSupervisorJustification,
//   getDashboardStats,
//   getAnalytics
// } = require('../controllers/cashRequestController');

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/temp/');
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 10 * 1024 * 1024 // 10MB
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|rtf/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);

//     if (mimetype && extname) {
//       return cb(null, true);
//     } else {
//       cb(new Error('Only images, PDFs, Word docs, Excel files, and text files are allowed!'));
//     }
//   }
// });

// // Apply authentication middleware to all routes
// router.use(authMiddleware);

// // ============================================
// // IMPORTANT: SPECIFIC ROUTES MUST COME BEFORE DYNAMIC ROUTES
// // Routes with specific paths like /stats, /preview-approval-chain, etc.
// // must be defined BEFORE routes with dynamic parameters like /:requestId
// // ============================================

// // Dashboard and Analytics Routes (NO PARAMETERS)
// router.get('/dashboard/stats',
//   requireRoles('admin', 'finance', 'supervisor', 'employee'),
//   getDashboardStats
// );

// router.get('/analytics/statistics',
//   requireRoles('admin', 'finance', 'supervisor'),
//   getAnalytics
// );

// // Preview Routes (NO PARAMETERS)
// router.post('/preview-approval-chain',
//   requireRoles('admin', 'finance', 'supervisor', 'employee'),
//   getApprovalChainPreview
// );

// // Supervisor Routes (SPECIFIC PATHS FIRST)
// router.get('/supervisor/stats',
//   requireRoles('supervisor', 'admin'),
//   async (req, res) => {
//     try {
//       // Implement supervisor stats logic here
//       const stats = {
//         pendingApprovals: 0,
//         approvedRequests: 0,
//         pendingJustifications: 0
//       };
      
//       res.json({
//         success: true,
//         data: stats
//       });
//     } catch (error) {
//       console.error('Get supervisor stats error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch supervisor stats',
//         error: error.message
//       });
//     }
//   }
// );

// router.get('/supervisor/justifications',
//   requireRoles('supervisor', 'admin'),
//   getSupervisorJustifications
// );

// router.get('/supervisor',
//   requireRoles('supervisor', 'admin', 'hr'),
//   getSupervisorRequests
// );

// // Finance Routes (SPECIFIC PATHS FIRST)
// router.get('/finance/justifications',
//   requireRoles('finance', 'admin'),
//   getFinanceJustifications
// );

// router.get('/finance',
//   requireRoles('finance', 'admin'),
//   getFinanceRequests
// );

// // Employee Routes (SPECIFIC PATHS FIRST)
// router.get('/employee',
//   requireRoles('employee', 'supervisor', 'admin', 'finance'),
//   getEmployeeRequests
// );

// // Admin Routes (SPECIFIC PATHS FIRST)
// router.get('/admin-approvals',
//   requireRoles('admin'),
//   getAdminApprovals
// );

// router.get('/admin',
//   requireRoles('admin'),
//   getAllRequests
// );

// // Pending Approvals (SPECIFIC PATH)
// router.get('/pending-approvals',
//   requireRoles('admin', 'supervisor', 'finance'),
//   getPendingApprovals
// );

// // Create new cash request
// router.post('/',
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'supply_chain', 'it'),
//   upload.array('attachments', 5),
//   createRequest
// );

// // ============================================
// // DYNAMIC ROUTES WITH :requestId PARAMETER
// // These MUST come AFTER all specific routes above
// // ============================================

// // Justification Routes with :requestId
// router.post('/:requestId/justification',
//   requireRoles('employee', 'supervisor', 'admin'),
//   upload.array('documents', 10),
//   submitJustification
// );

// router.get('/:requestId/justify',
//   requireRoles('employee', 'supervisor', 'admin'),
//   getRequestForJustification
// );

// // Supervisor Decision Routes with :requestId
// router.put('/:requestId/supervisor',
//   requireRoles('supervisor', 'admin'),
//   processSupervisorDecision
// );

// router.put('/:requestId/supervisor/justification',
//   requireRoles('supervisor', 'admin'),
//   processSupervisorJustificationDecision
// );

// router.get('/supervisor/justification/:requestId',
//   requireRoles('supervisor', 'admin'),
//   getSupervisorJustification
// );

// router.get('/supervisor/:requestId',
//   requireRoles('supervisor', 'admin'),
//   getSupervisorRequest
// );

// // Finance Decision Routes with :requestId
// router.put('/:requestId/finance',
//   requireRoles('finance', 'admin'),
//   processFinanceDecision
// );

// router.put('/:requestId/finance/justification',
//   requireRoles('finance', 'admin'),
//   processFinanceJustificationDecision
// );

// // Approval Routes with :requestId
// router.put('/:requestId/approve',
//   requireRoles('admin', 'supervisor', 'finance'),
//   processApprovalDecision
// );

// // Admin Routes with :requestId
// router.get('/admin/:requestId',
//   requireRoles('admin'),
//   getAdminRequestDetails
// );

// // Employee Routes with :requestId
// router.get('/employee/:requestId',
//   requireRoles('employee', 'supervisor', 'admin', 'finance'),
//   getEmployeeRequest
// );

// // Generic Routes with :requestId (MUST BE LAST)
// router.get('/:requestId',
//   requireRoles('employee', 'supervisor', 'admin', 'finance'),
//   async (req, res, next) => {
//     const { requestId } = req.params;
    
//     // Validate that requestId is a valid MongoDB ObjectId
//     if (!/^[0-9a-fA-F]{24}$/.test(requestId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid request ID format'
//       });
//     }
    
//     next();
//   },
//   getEmployeeRequest
// );

// // Error handling middleware for multer
// router.use((error, req, res, next) => {
//   if (error instanceof multer.MulterError) {
//     if (error.code === 'LIMIT_FILE_SIZE') {
//       return res.status(400).json({
//         success: false,
//         message: 'File too large. Maximum size is 10MB'
//       });
//     }
//     return res.status(400).json({
//       success: false,
//       message: `Upload error: ${error.message}`
//     });
//   }
  
//   if (error) {
//     console.error('Route error:', error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || 'Server error'
//     });
//   }
  
//   next();
// });

// module.exports = router;
