const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const invoiceApprovalController = require('../controllers/invoiceApprovalController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

const uploadMiddleware = require('../middlewares/uploadMiddleware');
const upload = uploadMiddleware.upload || uploadMiddleware; 

// ==================== FILE DOWNLOAD ROUTE ====================
router.get('/files/:type/:publicId',
  authMiddleware,
  async (req, res) => {
    try {
      const Invoice = require('../models/Invoice');
      const { type, publicId } = req.params;
      
      const invoice = await Invoice.findOne({
        $or: [
          { 'poFile.publicId': publicId },
          { 'invoiceFile.publicId': publicId }
        ]
      }).populate('employee', 'email');

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const isEmployee = invoice.employee._id.toString() === req.user.userId;
      const isFinance = ['finance', 'admin'].includes(req.user.role);
      const isApprover = invoice.approvalChain?.some(
        step => step.approver.email === req.user.email
      );

      if (!isEmployee && !isFinance && !isApprover) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to download this file'
        });
      }

      const fileData = type === 'po' ? invoice.poFile : invoice.invoiceFile;
      
      if (!fileData || !fileData.url) {
        return res.status(404).json({
          success: false,
          message: 'File not available'
        });
      }

      res.json({
        success: true,
        data: {
          url: fileData.url,
          filename: fileData.originalName,
          publicId: fileData.publicId
        }
      });

    } catch (error) {
      console.error('File download error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process file download'
      });
    }
  }
);


/**
 * @route   GET /api/invoices/:invoiceId/download/po
 * @desc    Download PO file
 * @access  Private (Employee, Approvers, Finance, Admin)
 */
router.get(
  '/:invoiceId/download/po',
  authMiddleware,
  invoiceApprovalController.downloadPOFile
);

/**
 * @route   GET /api/invoices/:invoiceId/download/invoice
 * @desc    Download Invoice file
 * @access  Private (Employee, Approvers, Finance, Admin)
 */
router.get(
  '/:invoiceId/download/invoice',
  authMiddleware,
  invoiceApprovalController.downloadInvoiceFile
);

/**
 * @route   GET /api/invoices/:invoiceId/preview/:fileType
 * @desc    Preview file in browser (fileType: 'po' or 'invoice')
 * @access  Private (Employee, Approvers, Finance, Admin)
 */
router.get(
  '/:invoiceId/preview/:fileType',
  authMiddleware,
  invoiceApprovalController.previewFile
);


// ==================== FINANCE ROUTES ====================
// IMPORTANT: Finance routes MUST come BEFORE parameterized routes

// Get all invoices for finance management (LIST)
router.get('/finance',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.getInvoicesForFinance
);

// Assign single invoice to department
router.post('/finance/assign/:invoiceId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.assignInvoiceToDepartment
);

// Bulk assign invoices to department
router.post('/finance/bulk-assign',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.bulkAssignInvoices
);

// Mark invoice as processed (final finance step)
router.put('/finance/process/:invoiceId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.markInvoiceAsProcessed
);

// ==================== UPLOAD ROUTE ====================
router.post('/upload',
  authMiddleware,
  upload.fields([
    { name: 'poFile', maxCount: 1 },
    { name: 'invoiceFile', maxCount: 1 }
  ]),
  invoiceApprovalController.uploadInvoiceWithApprovalChain  
);

// ==================== EMPLOYEE ROUTES ====================
// Get invoices for logged-in employee
router.get('/employee',
  authMiddleware,
  invoiceController.getEmployeeInvoices
);

// ==================== SUPERVISOR/APPROVER ROUTES ====================
// Get pending approvals for current user
router.get('/supervisor/pending',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'finance', 'hr', 'it', 'buyer', 'supply_chain'),
  invoiceApprovalController.getPendingApprovalsForUser
);

// Get all invoices for supervisor (including upcoming)
router.get('/supervisor/all',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'finance'),
  invoiceApprovalController.getSupervisorInvoices
);

// Process approval decision
router.put('/supervisor/approve/:invoiceId',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'hr', 'it', 'finance', 'buyer', 'supply_chain'),
  invoiceApprovalController.processApprovalStep
);

// Alternative approval routes
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

// ==================== ANALYTICS & REPORTING ====================
router.get('/analytics/dashboard',
  authMiddleware,
  requireRoles('finance', 'admin'),
  invoiceApprovalController.getApprovalStatistics
);

// ==================== DEPARTMENT MANAGEMENT ====================
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

// ==================== INDIVIDUAL INVOICE ROUTES ====================
// IMPORTANT: These MUST come LAST to avoid catching other routes

// Get single invoice details
router.get('/:invoiceId',
  authMiddleware,
  invoiceApprovalController.getInvoiceDetails
);

// ==================== LEGACY ROUTES (Backward Compatibility) ====================
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









// const express = require('express');
// const router = express.Router();
// const invoiceController = require('../controllers/invoiceController');
// const invoiceApprovalController = require('../controllers/invoiceApprovalController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// const uploadMiddleware = require('../middlewares/uploadMiddleware');
// const upload = uploadMiddleware.upload || uploadMiddleware; 

// router.post('/upload',
//   authMiddleware,
//   upload.fields([
//     { name: 'poFile', maxCount: 1 },
//     { name: 'invoiceFile', maxCount: 1 }
//   ]),
//   invoiceApprovalController.uploadInvoiceWithApprovalChain  
// );


// // Get pending approvals for current user
// router.get('/supervisor/pending',
//   authMiddleware,
//   requireRoles('supervisor', 'admin', 'finance', 'hr'),
//   invoiceApprovalController.getPendingApprovalsForUser
// );

// // Get all invoices for supervisor (including upcoming)
// router.get('/supervisor/all',
//   authMiddleware,
//   requireRoles('supervisor', 'admin', 'finance'),
//   invoiceApprovalController.getSupervisorInvoices
// );

// // Get invoice details
// router.get('/:invoiceId',
//   authMiddleware,
//   invoiceApprovalController.getInvoiceDetails
// );

// router.get('/employee',
//   authMiddleware,
//   // requireRoles('employee', 'admin', 'finance', 'it'),
//   invoiceController.getEmployeeInvoices
// );

// // Finance routes for invoice management
// router.get('/finance',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   invoiceApprovalController.getInvoicesForFinance
// );

// router.post('/finance/assign/:invoiceId',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   invoiceApprovalController.assignInvoiceToDepartment
// );

// router.post('/finance/bulk-assign',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   invoiceApprovalController.bulkAssignInvoices
// );

// router.put('/finance/process/:invoiceId',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   invoiceApprovalController.markInvoiceAsProcessed
// );



// router.put('/supervisor/approve/:invoiceId',
//   authMiddleware,
//   requireRoles('supervisor', 'admin', 'hr', 'it', 'finance', 'buyer', 'supply_chain' ),
//   invoiceApprovalController.processApprovalStep
// );

// // Alternative route naming for clarity
// router.get('/approvals/pending',
//   authMiddleware,
//   requireRoles('supervisor', 'admin'),
//   invoiceApprovalController.getPendingApprovalsForUser
// );

// router.put('/approvals/:invoiceId/decision',
//   authMiddleware,
//   requireRoles('supervisor', 'admin'),
//   invoiceApprovalController.processApprovalStep
// );


// // Analytics and reporting routes
// router.get('/analytics/dashboard',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   invoiceApprovalController.getApprovalStatistics
// );

// // Department management routes
// router.get('/departments',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   invoiceApprovalController.getDepartments
// );

// router.get('/departments/:department/employees',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   invoiceApprovalController.getDepartmentEmployees
// );

// // Legacy routes for backward compatibility
// router.get('/all',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   invoiceController.getAllInvoices
// );

// router.put('/:invoiceId/decision',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   invoiceController.processInvoiceDecision
// );

// // File download route - add this after line 12 (after upload route)
// router.get('/files/:type/:publicId',
//   authMiddleware,
//   async (req, res) => {
//     try {
//       const { type, publicId } = req.params;
      
//       // Find invoice with this file
//       const invoice = await Invoice.findOne({
//         $or: [
//           { 'poFile.publicId': publicId },
//           { 'invoiceFile.publicId': publicId }
//         ]
//       }).populate('employee', 'email');

//       if (!invoice) {
//         return res.status(404).json({
//           success: false,
//           message: 'File not found'
//         });
//       }

//       // Check authorization
//       const isEmployee = invoice.employee._id.toString() === req.user.userId;
//       const isFinance = ['finance', 'admin'].includes(req.user.role);
//       const isApprover = invoice.approvalChain?.some(
//         step => step.approver.email === req.user.email
//       );

//       if (!isEmployee && !isFinance && !isApprover) {
//         return res.status(403).json({
//           success: false,
//           message: 'Not authorized to download this file'
//         });
//       }

//       // Get file data
//       const fileData = type === 'po' ? invoice.poFile : invoice.invoiceFile;
      
//       if (!fileData || !fileData.url) {
//         return res.status(404).json({
//           success: false,
//           message: 'File not available'
//         });
//       }

//       // Return file URL for direct download
//       res.json({
//         success: true,
//         data: {
//           url: fileData.url,
//           filename: fileData.originalName,
//           publicId: fileData.publicId
//         }
//       });

//     } catch (error) {
//       console.error('File download error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to process file download'
//       });
//     }
//   }
// );

// module.exports = router;