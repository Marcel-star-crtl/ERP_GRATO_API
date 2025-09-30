const express = require('express');
const router = express.Router();
const cashRequestController = require('../controllers/cashRequestController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

const uploadMiddleware = require('../middlewares/uploadMiddleware');
const upload = uploadMiddleware.upload || uploadMiddleware; 

router.post('/', 
  authMiddleware, 
  upload.array('attachments', 5),
  cashRequestController.createRequest
);

router.get('/employee', 
  authMiddleware, 
  cashRequestController.getEmployeeRequests
);

router.post('/preview-approval-chain',
  authMiddleware,
  cashRequestController.getApprovalChainPreview
);

// New universal approval routes for 4-level hierarchy
router.get('/pending-approvals', 
  authMiddleware, 
  requireRoles('supervisor', 'admin', 'finance'),
  cashRequestController.getPendingApprovals
);

router.get('/admin-approvals', 
  authMiddleware, 
  requireRoles('admin'),
  cashRequestController.getAdminApprovals
);

router.put('/:requestId/approve', 
  authMiddleware, 
  requireRoles('supervisor', 'admin', 'finance'),
  cashRequestController.processApprovalDecision
);

// Legacy routes - kept for backward compatibility
router.get('/supervisor', 
  authMiddleware, 
  requireRoles('supervisor', 'admin'), 
  cashRequestController.getSupervisorRequests
);

router.get('/supervisor/justifications', 
  authMiddleware, 
  requireRoles('supervisor', 'admin'),
  cashRequestController.getSupervisorJustifications
);

router.get('/supervisor/justification/:requestId', 
  authMiddleware, 
  requireRoles('supervisor', 'admin'),
  cashRequestController.getSupervisorJustification
);

router.get('/supervisor/:requestId', 
  authMiddleware, 
  requireRoles('supervisor', 'admin'),
  cashRequestController.getSupervisorRequest
);

router.get('/finance', 
  authMiddleware, 
  requireRoles('admin', 'finance'),
  cashRequestController.getFinanceRequests
);

router.get('/finance/justifications', 
  authMiddleware, 
  requireRoles('finance', 'admin'),
  cashRequestController.getFinanceJustifications
);

router.get('/admin', 
  authMiddleware, 
  requireRoles('admin'), 
  cashRequestController.getAllRequests
);

router.get('/admin/analytics', 
  authMiddleware, 
  requireRoles('admin'),
  cashRequestController.getAnalytics
);

router.get('/admin/:requestId', 
  authMiddleware, 
  requireRoles('admin', 'finance'),
  cashRequestController.getAdminRequestDetails
);

router.get('/employee/:requestId/justify', 
  authMiddleware, 
  requireRoles('admin', 'finance', 'employee'),
  cashRequestController.getRequestForJustification
);

router.put('/:requestId/supervisor', 
  authMiddleware, 
  requireRoles('supervisor', 'admin'), 
  cashRequestController.processSupervisorDecision
);

router.put('/:requestId/supervisor/justification', 
  authMiddleware, 
  requireRoles('supervisor', 'admin'),
  cashRequestController.processSupervisorJustificationDecision
);

router.put('/:requestId/finance', 
  authMiddleware, 
  requireRoles('admin', 'finance'),
  cashRequestController.processFinanceDecision
);

router.put('/:requestId/finance/justification', 
  authMiddleware, 
  requireRoles('finance', 'admin'),
  cashRequestController.processFinanceJustificationDecision
);

router.post('/:requestId/justification', 
  authMiddleware, 
  requireRoles('employee', 'admin'),
  upload.array('attachments', 5),
  cashRequestController.submitJustification
);

router.get('/:requestId', 
  authMiddleware, 
  cashRequestController.getEmployeeRequest
);

module.exports = router;