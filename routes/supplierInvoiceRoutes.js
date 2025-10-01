const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
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

router.post('/register', supplierController.registerSupplier);

// Email verification (public)
router.get('/verify-email/:token', supplierController.verifySupplierEmail);

// Supplier login (public)
router.post('/login', supplierController.loginSupplier);

router.get('/profile', 
  supplierAuthMiddleware, 
  supplierController.getSupplierProfile
);

router.put('/profile', 
  supplierAuthMiddleware, 
  requireActiveSupplier,
  supplierController.updateSupplierProfile
);

router.get('/rfq-requests',
  supplierAuthMiddleware,
  requireActiveSupplier,
  supplierRfqController.getSupplierRfqRequests
);

// Get specific RFQ details
router.get('/rfq-requests/:rfqId',
  supplierAuthMiddleware,
  requireActiveSupplier,
  supplierRfqController.getSupplierRfqById
);

// Submit quote for RFQ
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

// Get supplier's submitted quotes
router.get('/quotes',
  supplierAuthMiddleware,
  requireActiveSupplier,
  supplierRfqController.getSupplierQuotes
);

// Get supplier dashboard data
router.get('/dashboard',
  supplierAuthMiddleware,
  requireActiveSupplier,
  supplierRfqController.getSupplierDashboard
);

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

// Get supplier's invoices
router.get('/invoices',
  supplierAuthMiddleware,
  requireActiveSupplier,
  supplierInvoiceController.getSupplierInvoices
);

// Get specific supplier invoice details
router.get('/invoices/:invoiceId',
  combinedAuthMiddleware,
  supplierInvoiceController.getSupplierInvoiceDetails
);

router.get('/admin/all',
  authMiddleware,
  requireRoles('admin', 'finance', 'supply_chain'),
  supplierController.getAllSuppliers
);

// Approve/reject supplier (admin/finance only)
router.put('/admin/:supplierId/status',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierController.updateSupplierStatus
);

router.get('/admin/onboarding/applications',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.getAllApplications
);

// Get specific application by ID
router.get('/admin/onboarding/applications/:applicationId',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.getApplicationById
);

// Update application status (review, approve, reject)
router.put('/admin/onboarding/applications/:applicationId/status',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.updateApplicationStatus
);

// Add review comments/notes to application
router.post('/admin/onboarding/applications/:applicationId/notes',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.addReviewNote
);

// Upload additional documents for application
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

// Download application documents
router.get('/admin/onboarding/applications/:applicationId/documents/:documentId',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.downloadDocument
);

// Get onboarding statistics/dashboard data
router.get('/admin/onboarding/statistics',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.getOnboardingStatistics
);

// Bulk update applications
router.put('/admin/onboarding/applications/bulk-update',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.bulkUpdateApplications
);

// Export applications data
router.get('/admin/onboarding/export',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  supplierOnboardingController.exportApplications
);

router.get('/admin/invoices',
  authMiddleware,
  requireRoles('admin', 'finance'),
  supplierInvoiceController.getSupplierInvoicesForFinance
);

// Update supplier invoice details (finance only) - OPTIONAL
router.put('/admin/invoices/:invoiceId/details',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.updateSupplierInvoiceDetails
);

// Combined process and assign endpoint
router.post('/admin/invoices/:invoiceId/process-and-assign',
  authMiddleware,
  requireRoles('finance', 'admin'),
  async (req, res) => {
    // This endpoint allows updating details and assigning in one API call
    const { department, comments, updateDetails } = req.body;
    
    // Reuse the existing assign endpoint with updateDetails
    req.body = { department, comments, updateDetails };
    return supplierInvoiceController.assignSupplierInvoiceToDepartment(req, res);
  }
);

// Assign supplier invoice to department (finance only)
router.post('/admin/invoices/:invoiceId/assign',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.assignSupplierInvoiceToDepartment
);

// Bulk assign supplier invoices
router.post('/admin/invoices/bulk-assign',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.bulkAssignSupplierInvoices
);

// Process supplier invoice payment
router.post('/admin/invoices/:invoiceId/payment',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.processSupplierInvoicePayment
);

// Mark supplier invoice as processed (NEW - final finance step)
router.put('/admin/invoices/:invoiceId/process',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.markSupplierInvoiceAsProcessed
);

// Get supplier invoice analytics
router.get('/admin/analytics',
  authMiddleware,
  requireRoles('finance', 'admin'),
  supplierInvoiceController.getSupplierInvoiceAnalytics
);

router.get('/supervisor/pending',
  authMiddleware,
  requireRoles('supervisor', 'admin'),
  supplierInvoiceController.getPendingSupplierApprovalsForUser
);

// Process supplier invoice approval/rejection
router.put('/supervisor/invoices/:invoiceId/decision',
  authMiddleware,
  requireRoles('supervisor', 'admin'),
  supplierInvoiceController.processSupplierApprovalStep
);

// Export routes
module.exports = router;


