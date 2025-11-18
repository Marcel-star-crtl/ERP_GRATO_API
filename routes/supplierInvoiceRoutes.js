const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const unifiedSupplierController = require('../controllers/unifiedSupplierController');
const contractController = require('../controllers/contractController');
const supplierInvoiceController = require('../controllers/supplierInvoiceController');
const supplierOnboardingController = require('../controllers/supplierOnboardingController');
const supplierRfqController = require('../controllers/supplierRfqController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const { 
  supplierAuthMiddleware, 
  requireActiveSupplier, 
  requireSupplierType,
  combinedAuthMiddleware 
} = require('../middlewares/supplierAuthMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// ===============================
// SUPPLIER REGISTRATION & AUTH
// ===============================

router.post('/register-onboard',
  upload.fields([
    { name: 'businessRegistrationCertificate', maxCount: 1 },
    { name: 'taxClearanceCertificate', maxCount: 1 },
    { name: 'bankStatement', maxCount: 1 },
    { name: 'insuranceCertificate', maxCount: 1 },
    { name: 'additionalDocuments', maxCount: 5 }
  ]),
  unifiedSupplierController.registerAndOnboardSupplier
);

router.post('/register', supplierController.registerSupplier);
router.get('/verify-email/:token', supplierController.verifySupplierEmail);
router.post('/login', supplierController.loginSupplier);

// ===============================
// SUPPLY CHAIN COORDINATOR ROUTES (WITH DOCUMENT SIGNING)
// ===============================

// Get invoices pending supply chain assignment
router.get('/supply-chain/invoices/pending',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  supplierInvoiceController.getSupplierInvoicesPendingSupplyChainAssignment
);

// NEW: Download invoice for signing (Supply Chain & Approvers)
router.get('/invoices/:invoiceId/download-for-signing',
  authMiddleware,
  supplierInvoiceController.downloadInvoiceForSigning
);

// Assign invoice to department WITH signed document upload
router.post('/supply-chain/invoices/:invoiceId/assign',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  upload.fields([
    { name: 'signedDocument', maxCount: 1 }
  ]),
  upload.validateFiles,
  upload.cleanupTempFiles,
  supplierInvoiceController.assignSupplierInvoiceBySupplyChain
);

// Reject invoice (Supply Chain Coordinator)
router.post('/supply-chain/invoices/:invoiceId/reject',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  supplierInvoiceController.rejectSupplierInvoiceBySupplyChain
);

// Bulk assign invoices (Supply Chain Coordinator)
router.post('/supply-chain/invoices/bulk-assign',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  supplierInvoiceController.bulkAssignSupplierInvoicesBySupplyChain
);

// Get Supply Chain dashboard statistics
router.get('/supply-chain/dashboard/stats',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  supplierInvoiceController.getSupplyChainDashboardStats
);

// ===============================
// SUPERVISOR/APPROVER ROUTES (WITH DOCUMENT SIGNING)
// ===============================

// Get pending supplier approvals for user
router.get('/supervisor/pending',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'finance', 'hr', 'it', 'technical'),
  supplierInvoiceController.getPendingSupplierApprovalsForUser
);

// Process supplier invoice approval/rejection WITH signed document
router.put('/supervisor/invoices/:invoiceId/decision',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'finance', 'hr', 'it', 'technical'),
  upload.fields([
    { name: 'signedDocument', maxCount: 1 }
  ]),
  upload.validateFiles,
  upload.cleanupTempFiles,
  supplierInvoiceController.processSupplierApprovalStep
);

// ===============================
// SUPPLIER PROFILE MANAGEMENT
// ===============================

router.get('/:supplierId/complete-profile',
  authMiddleware,
  unifiedSupplierController.getCompleteSupplierProfile
);

router.put('/:supplierId/profile',
  authMiddleware,
  unifiedSupplierController.updateSupplierProfile
);

router.get('/dashboard',
  supplierAuthMiddleware,
  requireActiveSupplier,
  unifiedSupplierController.getSupplierDashboard
);

router.get('/profile', 
  supplierAuthMiddleware, 
  supplierController.getSupplierProfile
);

router.put('/profile', 
  supplierAuthMiddleware, 
  requireActiveSupplier,
  supplierController.updateSupplierProfile
);

// ===============================
// SUPPLIER RFQ ROUTES
// ===============================

router.get('/rfq-requests',
  supplierAuthMiddleware,
  requireActiveSupplier,
  supplierRfqController.getSupplierRfqRequests
);

router.get('/rfq-requests/:rfqId',
  supplierAuthMiddleware,
  requireActiveSupplier,
  supplierRfqController.getSupplierRfqById
);

router.post('/rfq-requests/:rfqId/submit-quote',
  supplierAuthMiddleware,
  requireActiveSupplier,
  upload.fields([
    { name: 'quoteDocuments', maxCount: 5 },
    { name: 'technicalSpecs', maxCount: 10 },
    { name: 'certificates', maxCount: 5 }
  ]),
  upload.validateFiles,
  upload.cleanupTempFiles,
  supplierRfqController.submitQuote
);

router.get('/quotes',
  supplierAuthMiddleware,
  requireActiveSupplier,
  supplierRfqController.getSupplierQuotes
);

// ===============================
// ADMIN OPERATIONS
// ===============================

router.post('/bulk-import',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  unifiedSupplierController.bulkImportSuppliers
);

router.post('/:supplierId/approve-reject',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  unifiedSupplierController.approveOrRejectSupplier
);

router.get('/admin/all',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  supplierController.getAllSuppliers
);

router.put('/admin/:supplierId/status',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierController.updateSupplierStatus
);

// ===============================
// SUPPLIER ONBOARDING ADMIN ROUTES
// ===============================

router.get('/admin/onboarding/applications',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.getAllApplications
);

router.get('/admin/onboarding/applications/:applicationId',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.getApplicationById
);

router.put('/admin/onboarding/applications/:applicationId/status',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.updateApplicationStatus
);

router.post('/admin/onboarding/applications/:applicationId/notes',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.addReviewNote
);

router.post('/admin/onboarding/applications/:applicationId/documents',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  upload.fields([
    { name: 'documents', maxCount: 10 }
  ]),
  upload.validateFiles,
  upload.cleanupTempFiles,
  supplierOnboardingController.uploadAdditionalDocuments
);

router.get('/admin/onboarding/applications/:applicationId/documents/:documentId',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.downloadDocument
);

router.get('/admin/onboarding/statistics',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.getOnboardingStatistics
);

router.put('/admin/onboarding/applications/bulk-update',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.bulkUpdateApplications
);

router.get('/admin/onboarding/export',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.exportApplications
);

// ===============================
// CONTRACT MANAGEMENT
// ===============================

router.post('/contracts',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  contractController.createContract
);

router.get('/:supplierId/contracts',
  authMiddleware,
  contractController.getSupplierContracts
);

router.post('/contracts/:contractId/link-invoice',
  authMiddleware,
  requireRoles('admin', 'finance'),
  contractController.linkInvoiceToContract
);

router.delete('/contracts/:contractId/invoices/:invoiceId',
  authMiddleware,
  requireRoles('admin', 'finance'),
  contractController.unlinkInvoiceFromContract
);

router.get('/contracts/:contractId/with-invoices',
  authMiddleware,
  contractController.getContractWithInvoices
);

// ===============================
// SUPPLIER INVOICE SUBMISSION
// ===============================

router.post('/invoices',
  supplierAuthMiddleware,
  requireActiveSupplier,
  upload.fields([
    { name: 'invoiceFile', maxCount: 1 },
    { name: 'poFile', maxCount: 1 }
  ]),
  upload.validateFiles,
  upload.cleanupTempFiles,
  supplierInvoiceController.submitSupplierInvoice
);

router.get('/invoices',
  supplierAuthMiddleware,
  requireActiveSupplier,
  supplierInvoiceController.getSupplierInvoices
);

router.get('/invoices/:invoiceId',
  combinedAuthMiddleware,
  supplierInvoiceController.getSupplierInvoiceDetails
);

// ===============================
// FINANCE ADMIN ROUTES
// ===============================

router.get('/admin/invoices',
  authMiddleware,
  requireRoles('admin', 'finance'),
  supplierInvoiceController.getSupplierInvoicesForFinance
);

router.put('/admin/invoices/:invoiceId/details',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.updateSupplierInvoiceDetails
);

router.post('/admin/invoices/:invoiceId/process-and-assign',
  authMiddleware,
  requireRoles('finance', 'admin'),
  async (req, res) => {
    const { department, comments, updateDetails } = req.body;
    req.body = { department, comments, updateDetails };
    return supplierInvoiceController.assignSupplierInvoiceToDepartment(req, res);
  }
);

router.post('/admin/invoices/:invoiceId/assign',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.assignSupplierInvoiceToDepartment
);

router.post('/admin/invoices/bulk-assign',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.bulkAssignSupplierInvoices
);

router.post('/admin/invoices/:invoiceId/payment',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.processSupplierInvoicePayment
);

router.put('/admin/invoices/:invoiceId/process',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.markSupplierInvoiceAsProcessed
);

router.get('/admin/analytics',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.getSupplierInvoiceAnalytics
);

module.exports = router;



