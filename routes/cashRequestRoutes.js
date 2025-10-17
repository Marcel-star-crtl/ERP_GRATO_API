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
      console.log(`=== DASHBOARD STATS for ${user.role}: ${user.email} ===`);
      
      let baseFilter = {};
      let pendingFilter = {};
      
      if (user.role === 'employee') {
        baseFilter = { employee: req.user.userId };
        pendingFilter = {
          employee: req.user.userId,
          status: { $regex: /pending/ }
        };
      } else if (user.role === 'supervisor') {
        // Supervisor sees team requests that need their approval
        baseFilter = {
          'approvalChain': {
            $elemMatch: {
              'approver.email': user.email
            }
          }
        };
        pendingFilter = {
          'approvalChain': {
            $elemMatch: {
              'approver.email': user.email,
              'status': 'pending'
            }
          }
        };
      } else if (user.role === 'finance') {
        // Finance sees all requests at finance level or beyond
        baseFilter = {
          $or: [
            { status: { $regex: /pending_finance/ } },
            { status: 'approved' },
            { status: 'disbursed' },
            { status: 'completed' },
            {
              'approvalChain': {
                $elemMatch: {
                  'approver.role': 'Finance Officer'
                }
              }
            }
          ]
        };
        pendingFilter = {
          $or: [
            { status: { $regex: /pending_finance/ } },
            {
              'approvalChain': {
                $elemMatch: {
                  'approver.email': user.email,
                  'approver.role': 'Finance Officer',
                  'status': 'pending'
                }
              }
            }
          ]
        };
      } else if (user.role === 'admin') {
        // Admin sees everything
        baseFilter = {};
        pendingFilter = {
          status: { $regex: /pending/ }
        };
      }
      
      console.log('Base filter:', JSON.stringify(baseFilter, null, 2));
      console.log('Pending filter:', JSON.stringify(pendingFilter, null, 2));
      
      const [total, pending, approved, disbursed, completed, denied] = await Promise.all([
        CashRequest.countDocuments(baseFilter),
        CashRequest.countDocuments(pendingFilter),
        CashRequest.countDocuments({ ...baseFilter, status: 'approved' }),
        CashRequest.countDocuments({ ...baseFilter, status: 'disbursed' }),
        CashRequest.countDocuments({ ...baseFilter, status: 'completed' }),
        CashRequest.countDocuments({ ...baseFilter, status: 'denied' })
      ]);
      
      const stats = {
        total,
        pending,
        approved,
        disbursed,
        completed,
        denied
      };
      
      console.log('Stats calculated:', stats);
      
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
  // Support both 'documents' and 'attachments' field names for justification uploads
  (req, res, next) => {
    console.log('=== JUSTIFICATION UPLOAD MIDDLEWARE ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request has files:', !!req.files);
    next();
  },
  upload.fields([
    { name: 'documents', maxCount: 10 },
    { name: 'attachments', maxCount: 10 },
    { name: 'justificationDocuments', maxCount: 10 }
  ]),
  // Normalize file field names
  (req, res, next) => {
    if (req.files) {
      // Combine all file fields into a single array
      const allFiles = [];
      if (req.files.documents) allFiles.push(...req.files.documents);
      if (req.files.attachments) allFiles.push(...req.files.attachments);
      if (req.files.justificationDocuments) allFiles.push(...req.files.justificationDocuments);
      
      // Replace req.files with normalized array
      req.files = allFiles;
      console.log(`Normalized ${allFiles.length} files for justification upload`);
    }
    next();
  },
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


