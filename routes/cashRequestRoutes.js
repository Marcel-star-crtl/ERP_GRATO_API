const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const cashRequestController = require('../controllers/cashRequestController');

// Import error handlers from upload middleware
const { handleMulterError, cleanupTempFiles, validateFiles } = require('../middlewares/uploadMiddleware');

// ============================================
// DASHBOARD STATS
// ============================================
router.get(
  '/dashboard-stats',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
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

// Delete cash request (only if pending and no approvals)
router.delete(
  '/:requestId',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const request = await CashRequest.findById(requestId)
        .populate('employee', 'fullName email');

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      // Only owner can delete
      if (!request.employee._id.equals(req.user.userId)) {
        return res.status(403).json({
          success: false,
          message: 'Only the request owner can delete it'
        });
      }

      // STRICT: Must be pending_supervisor
      if (request.status !== 'pending_supervisor') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete request after approval process has started. Only pending_supervisor requests can be deleted.',
          currentStatus: request.status
        });
      }

      // STRICT: First approver must not have acted
      const firstStep = request.approvalChain?.[0];
      if (!firstStep || firstStep.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete request - approval process has already started. Once any approver takes action, deletion is no longer possible.'
        });
      }

      // ADDITIONAL CHECK: Verify no other steps have been touched
      const anyApprovalTaken = request.approvalChain.some(step => 
        step.status !== 'pending'
      );

      if (anyApprovalTaken) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete request - approvals have been recorded'
        });
      }

      // Delete associated files
      if (request.attachments && request.attachments.length > 0) {
        await deleteFiles(request.attachments);
      }

      // Delete request
      await request.deleteOne();

      console.log(`✓ Request ${requestId} deleted by ${request.employee.email}`);

      res.json({
        success: true,
        message: 'Request deleted successfully'
      });

    } catch (error) {
      console.error('Delete request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete request',
        error: error.message
      });
    }
  }
);


// Edit cash request
router.put(
  '/:requestId/edit',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  upload.array('attachments', 10),
  handleMulterError,
  validateFiles,
  cashRequestController.editCashRequest,
  cleanupTempFiles
);

// Get edit history
router.get(
  '/:requestId/edit-history',
  authMiddleware,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const request = await CashRequest.findById(requestId)
        .populate('editHistory.editedBy', 'fullName email')
        .select('editHistory totalEdits isEdited originalValues');

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      res.json({
        success: true,
        data: {
          isEdited: request.isEdited,
          totalEdits: request.totalEdits,
          editHistory: request.editHistory || [],
          originalValues: request.originalValues
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch edit history',
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
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getApprovalChainPreview
);

router.get(
  '/check-pending',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.checkPendingRequests
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
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getRequestForJustification
);

// Get single request details (employee's own)
router.get(
  '/employee/:requestId',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getEmployeeRequest
);

// Get supervisor justifications
router.get(
  '/supervisor/justifications',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorJustifications
);

// Get supervisor's pending approvals (NEW - to handle the "pending" path)
router.get(
  '/supervisor/pending',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorRequests
);

// Get single justification for supervisor review
router.get(
  '/supervisor/justification/:requestId',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorJustification
);

// Process supervisor justification decision
router.put(
  '/justification/:requestId/decision',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.processJustificationDecision
);

// Process supervisor approval/denial decision
router.put(
  '/:requestId/supervisor',
  authMiddleware,
  cashRequestController.processSupervisorDecision
);

// Get supervisor's team requests (general)
router.get(
  '/supervisor',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorRequests
);

// Process supervisor approval/denial decision (for cash requests)
router.put(
  '/supervisor/:requestId',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.processSupervisorDecision
);

// Get single request for supervisor approval - MUST BE LAST IN SUPERVISOR SECTION
router.get(
  '/supervisor/:requestId',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorRequest
);

// ============================================
// FINANCE ROUTES (SPECIFIC PATHS FIRST)
// ============================================

// Get finance justifications
router.get(
  '/finance/justifications',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getFinanceJustifications
);

// Process finance justification decision
router.put(
  '/finance/justification/:requestId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processFinanceJustificationDecision
);

// Get finance requests (pending approval and disbursement)
router.get(
  '/finance',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getFinanceRequests
);

// Process finance approval/denial with budget allocation
router.put(
  '/finance/:requestId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processFinanceDecision
);

router.put(
  '/:requestId/finance',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processFinanceDecision
);

// Disbursement routes
router.post(
  '/:requestId/disburse',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processDisbursement
);

router.get(
  '/:requestId/disbursements',
  authMiddleware,
  requireRoles('finance', 'admin', 'employee'),
  cashRequestController.getDisbursementHistory
);

// Export routes
router.get(
  '/export',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.exportCashRequests
);

// ============================================
// JUSTIFICATION ROUTES
// ============================================

// // Process justification decision (generic)
// router.post(
//   '/justification/:requestId/decision',
//   authMiddleware,
//   cashRequestController.processJustificationDecision
// );

// Process justification decision (generic)
router.put(
  '/justification/:requestId/decision',
  authMiddleware,
  cashRequestController.processJustificationDecision
);

// Get supervisor justifications pending (alternative path)
router.get(
  '/justifications/supervisor/pending',
  authMiddleware,
  cashRequestController.getSupervisorJustifications
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
// CREATE REQUEST (POST - before generic GET routes)
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
// SUBMIT JUSTIFICATION (POST with files)
// ============================================

router.post(
  '/:requestId/justification',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
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
  (req, res, next) => {
    if (req.files) {
      const allFiles = [];
      if (req.files.documents) allFiles.push(...req.files.documents);
      if (req.files.attachments) allFiles.push(...req.files.attachments);
      if (req.files.justificationDocuments) allFiles.push(...req.files.justificationDocuments);
      
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
// GENERIC ROUTES (MUST BE ABSOLUTELY LAST)
// ============================================

// Get single request by ID - THIS MUST BE THE LAST ROUTE
router.get(
  '/:requestId',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { requestId } = req.params;
      
      // Validate ObjectId format before querying
      if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request ID format'
        });
      }
      
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

router.get(
  '/:requestId/pdf',
  authMiddleware,
  cashRequestController.generateCashRequestPDF
);

// ============================================
// ERROR HANDLING MIDDLEWARE (MUST BE LAST)
// ============================================

router.use((error, req, res, next) => {
  console.error('Cash request route error:', error);
  
  if (req.files) {
    const { cleanupFiles } = require('../middlewares/uploadMiddleware');
    cleanupFiles(req.files);
  }
  
  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// Reimbursement routes
// router.post(
//   '/reimbursement',
//   authMiddleware,
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain'),
//   upload.array('receiptDocuments', 10),
//   handleMulterError,
//   validateFiles,
//   cashRequestController.createReimbursementRequest,
//   cleanupTempFiles
// );

// Create reimbursement request - CRITICAL: Accept multiple possible field names
router.post(
  '/reimbursement',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  (req, res, next) => {
    console.log('\n=== REIMBURSEMENT REQUEST UPLOAD INITIATED ===');
    console.log('User:', req.user?.userId);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw body keys:', Object.keys(req.body));
    console.log('Has files object:', !!req.files);
    next();
  },
  // FIXED: Accept files from multiple possible field names
  upload.fields([
    { name: 'receiptDocuments', maxCount: 10 },
    { name: 'attachments', maxCount: 10 },
    { name: 'documents', maxCount: 10 }
  ]),
  // Normalize file fields into a single array
  (req, res, next) => {
    if (req.files) {
      const allFiles = [];
      
      // Collect files from all possible fields
      if (req.files.receiptDocuments) {
        console.log(`Found ${req.files.receiptDocuments.length} files in 'receiptDocuments'`);
        allFiles.push(...req.files.receiptDocuments);
      }
      if (req.files.attachments) {
        console.log(`Found ${req.files.attachments.length} files in 'attachments'`);
        allFiles.push(...req.files.attachments);
      }
      if (req.files.documents) {
        console.log(`Found ${req.files.documents.length} files in 'documents'`);
        allFiles.push(...req.files.documents);
      }
      
      // Convert to simple array for downstream processing
      req.files = allFiles;
      console.log(`Normalized ${allFiles.length} total files for reimbursement`);
    } else {
      console.log('⚠️ No files detected in request');
    }
    next();
  },
  handleMulterError,
  validateFiles,
  (req, res, next) => {
    console.log('Files after validation:', req.files?.length || 0);
    if (req.files && req.files.length > 0) {
      console.log('Receipt documents:');
      req.files.forEach(file => {
        console.log(`  - ${file.originalname} (${file.size} bytes)`);
      });
    }
    next();
  },
  cashRequestController.createReimbursementRequest,
  cleanupTempFiles
);

router.get(
  '/reimbursement/limit-status',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getReimbursementLimitStatus
);

router.get(
  '/reports/analytics',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getFinanceReportsData
);


module.exports = router;









