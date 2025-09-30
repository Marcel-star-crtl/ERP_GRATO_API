const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const invoiceApprovalController = require('../controllers/invoiceApprovalController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

const uploadMiddleware = require('../middlewares/uploadMiddleware');
const upload = uploadMiddleware.upload || uploadMiddleware; 

// Employee routes
router.post('/upload',
  authMiddleware,
  requireRoles('employee', 'admin'),
  upload.fields([
    { name: 'poFile', maxCount: 1 },
    { name: 'invoiceFile', maxCount: 1 }
  ]),
  invoiceApprovalController.uploadInvoiceWithApprovalChain
);

router.get('/employee',
  authMiddleware,
  requireRoles('employee', 'admin', 'finance'),
  invoiceController.getEmployeeInvoices
);

// Finance routes for invoice management
router.get('/finance',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.getInvoicesForFinance
);

router.post('/finance/assign/:invoiceId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.assignInvoiceToDepartment
);

router.post('/finance/bulk-assign',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.bulkAssignInvoices
);

router.put('/finance/process/:invoiceId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.markInvoiceAsProcessed
);

// Supervisor/Department approval routes
router.get('/supervisor/pending',
  authMiddleware,
  requireRoles('supervisor', 'admin'),
  invoiceApprovalController.getPendingApprovalsForUser
);

router.get('/supervisor/all',
  authMiddleware,
  requireRoles('supervisor', 'admin'),
  invoiceApprovalController.getSupervisorInvoices
);

router.put('/supervisor/approve/:invoiceId',
  authMiddleware,
  requireRoles('supervisor', 'admin'),
  invoiceApprovalController.processApprovalStep
);

// Alternative route naming for clarity
router.get('/approvals/pending',
  authMiddleware,
  requireRoles('supervisor', 'admin'),
  invoiceApprovalController.getPendingApprovalsForUser
);

router.put('/approvals/:invoiceId/decision',
  authMiddleware,
  requireRoles('supervisor', 'admin'),
  invoiceApprovalController.processApprovalStep
);

// Common routes
router.get('/:invoiceId',
  authMiddleware,
  invoiceApprovalController.getInvoiceDetails
);

// Analytics and reporting routes
router.get('/analytics/dashboard',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.getApprovalStatistics
);

// Department management routes
router.get('/departments',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.getDepartments
);

router.get('/departments/:department/employees',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.getDepartmentEmployees
);

// Legacy routes for backward compatibility
router.get('/all',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceController.getAllInvoices
);

router.put('/:invoiceId/decision',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceController.processInvoiceDecision
);

module.exports = router;