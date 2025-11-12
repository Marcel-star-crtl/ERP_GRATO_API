const express = require('express');
const router = express.Router();
const purchaseRequisitionController = require('../controllers/purchaseRequisitionController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const path = require('path');
const fs = require('fs');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

// ============================================
// DIAGNOSTIC MIDDLEWARE - Remove after debugging
// ============================================
router.use((req, res, next) => {
  console.log(`\n=== ROUTE DEBUG ===`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log(`Full URL: ${req.originalUrl}`);
  console.log(`==================\n`);
  next();
});

// ============================================
// STATIC ROUTES FIRST (must come before /:requisitionId)
// ============================================

// Dashboard stats - multiple path variants for safety
router.get('/dashboard-stats', 
  authMiddleware,
  purchaseRequisitionController.getDashboardStats
);

router.get('/dashboard/stats', 
  authMiddleware,
  purchaseRequisitionController.getDashboardStats
);

// Employee routes
router.post('/', 
  authMiddleware, 
  upload.array('attachments', 5),
  purchaseRequisitionController.createRequisition
);

router.get('/employee', 
  authMiddleware, 
  purchaseRequisitionController.getEmployeeRequisitions
);

// Preview approval chain
router.post('/preview-approval-chain',
  authMiddleware,
  purchaseRequisitionController.getApprovalChainPreview
);

// Finance routes
router.get('/finance', 
  authMiddleware, 
  requireRoles('finance', 'admin'),
  purchaseRequisitionController.getFinanceRequisitions
);

router.get('/finance/dashboard-data', 
  authMiddleware, 
  requireRoles('finance', 'admin'),
  purchaseRequisitionController.getFinanceDashboardData
);

router.get('/finance/budget-codes', 
  authMiddleware,
  requireRoles('finance', 'admin'),
  purchaseRequisitionController.getBudgetCodesForVerification
);

// Supervisor routes
router.get('/supervisor', 
  authMiddleware, 
  requireRoles('supervisor', 'admin', 'hr', 'hse', 'it', 'finance', 'supply_chain'), 
  purchaseRequisitionController.getSupervisorRequisitions
);

// Supply Chain routes
router.get('/supply-chain', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.getSupplyChainRequisitions
);

// Buyer routes
router.get('/buyers/available',
  authMiddleware,
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.getAvailableBuyers
);

router.get('/buyer', 
  authMiddleware, 
  requireRoles('buyer', 'supply_chain', 'admin'),
  purchaseRequisitionController.getBuyerRequisitions
);

router.get('/buyer/assigned',
  authMiddleware,
  requireRoles('buyer', 'supply_chain', 'admin'),
  purchaseRequisitionController.getBuyerRequisitions
);

// Head approval routes
router.get('/head-approval', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.getHeadApprovalRequisitions
);

// Admin routes
router.get('/admin', 
  authMiddleware, 
  requireRoles('admin'), 
  purchaseRequisitionController.getAllRequisitions
);

// Draft management
router.post('/draft',
  authMiddleware,
  purchaseRequisitionController.saveDraft
);

// Role-based requisitions
router.get('/role',
  authMiddleware,
  purchaseRequisitionController.getRequisitionsByRole
);

// Analytics routes
router.get('/analytics/categories',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  purchaseRequisitionController.getCategoryAnalytics
);

router.get('/analytics/vendors',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  purchaseRequisitionController.getVendorPerformance
);

// Procurement planning
router.get('/procurement/planning',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  purchaseRequisitionController.getProcurementPlanningData
);

// Statistics
router.get('/statistics',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance'),
  purchaseRequisitionController.getRequisitionStats
);

// ============================================
// PARAMETERIZED ROUTES (after specific paths)
// ============================================

// Supervisor specific requisition
router.get('/supervisor/:requisitionId', 
  authMiddleware, 
  requireRoles('supervisor', 'admin'),
  purchaseRequisitionController.getEmployeeRequisition
);

// Supply chain specific requisition
router.get('/supply-chain/:requisitionId', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.getEmployeeRequisition
);

// Admin specific requisition
router.get('/admin/:requisitionId', 
  authMiddleware, 
  requireRoles('admin'),
  purchaseRequisitionController.getEmployeeRequisition
);

// ============================================
// ACTION ROUTES (PUT/POST for updates)
// Support both PUT and POST for compatibility
// ============================================

// Finance verification - BOTH PUT AND POST
router.put('/:requisitionId/finance-verification', 
  authMiddleware, 
  requireRoles('finance', 'admin'),
  purchaseRequisitionController.processFinanceVerification
);

router.post('/:requisitionId/finance-verification', 
  authMiddleware, 
  requireRoles('finance', 'admin'),
  purchaseRequisitionController.processFinanceVerification
);

// Supervisor decision - BOTH PUT AND POST
router.put('/:requisitionId/supervisor', 
  authMiddleware, 
  requireRoles('supervisor', 'admin'), 
  purchaseRequisitionController.processSupervisorDecision
);

router.post('/:requisitionId/supervisor', 
  authMiddleware, 
  requireRoles('supervisor', 'admin'), 
  purchaseRequisitionController.processSupervisorDecision
);

// Supply chain decision - BOTH PUT AND POST
router.put('/:requisitionId/supply-chain', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.processSupplyChainDecision
);

router.post('/:requisitionId/supply-chain', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.processSupplyChainDecision
);

// Buyer assignment - BOTH PUT AND POST
router.put('/:requisitionId/assign-buyer', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.assignBuyer
);

router.post('/:requisitionId/assign-buyer', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.assignBuyer
);

// Head approval - BOTH PUT AND POST
router.put('/:requisitionId/head-approval', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.processHeadApproval
);

router.post('/:requisitionId/head-approval', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.processHeadApproval
);

// Procurement updates - BOTH PUT AND POST
router.put('/:requisitionId/procurement',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'buyer'),
  purchaseRequisitionController.updateProcurementStatus
);

router.post('/:requisitionId/procurement',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'buyer'),
  purchaseRequisitionController.updateProcurementStatus
);

// Buyer specific actions
router.post('/buyer/:requisitionId/start-procurement',
  authMiddleware,
  requireRoles('buyer', 'supply_chain', 'admin'),
  async (req, res) => {
    try {
      const { requisitionId } = req.params;
      const { procurementMethod, expectedDeliveryDate, notes } = req.body;

      const requisition = await PurchaseRequisition.findById(requisitionId)
        .populate('employee', 'fullName email');

      if (!requisition) {
        return res.status(404).json({
          success: false,
          message: 'Requisition not found'
        });
      }

      const user = await User.findById(req.user.userId);
      const isAssignedBuyer = requisition.supplyChainReview?.assignedBuyer?.toString() === req.user.userId;
      const isAuthorized = user.role === 'admin' || user.role === 'supply_chain' || isAssignedBuyer;

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to start procurement for this requisition'
        });
      }

      requisition.status = 'in_procurement';
      
      if (!requisition.procurementDetails) {
        requisition.procurementDetails = {};
      }

      requisition.procurementDetails = {
        ...requisition.procurementDetails,
        assignedOfficer: req.user.userId,
        procurementMethod: procurementMethod || 'direct_purchase',
        procurementStartDate: new Date(),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
        notes: notes
      };

      await requisition.save();

      res.json({
        success: true,
        message: 'Procurement started successfully',
        data: requisition
      });

    } catch (error) {
      console.error('Start procurement error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start procurement',
        error: error.message
      });
    }
  }
);

router.put('/buyer/:requisitionId/update-status',
  authMiddleware,
  requireRoles('buyer', 'supply_chain', 'admin'),
  async (req, res) => {
    try {
      const { requisitionId } = req.params;
      const { status, notes, vendorSelected, actualCost, deliveryDate } = req.body;

      const requisition = await PurchaseRequisition.findById(requisitionId)
        .populate('employee', 'fullName email');

      if (!requisition) {
        return res.status(404).json({
          success: false,
          message: 'Requisition not found'
        });
      }

      const user = await User.findById(req.user.userId);
      const isAssignedBuyer = requisition.supplyChainReview?.assignedBuyer?.toString() === req.user.userId;
      const isAuthorized = user.role === 'admin' || user.role === 'supply_chain' || isAssignedBuyer;

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this requisition'
        });
      }

      if (status) {
        requisition.status = status;
      }

      if (!requisition.procurementDetails) {
        requisition.procurementDetails = {};
      }

      requisition.procurementDetails = {
        ...requisition.procurementDetails,
        lastUpdated: new Date(),
        lastUpdatedBy: req.user.userId,
        notes: notes,
        selectedVendor: vendorSelected || requisition.procurementDetails.selectedVendor,
        finalCost: actualCost ? parseFloat(actualCost) : requisition.procurementDetails.finalCost,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : requisition.procurementDetails.deliveryDate
      };

      if (status === 'procurement_complete') {
        requisition.procurementDetails.completionDate = new Date();
      } else if (status === 'delivered') {
        requisition.procurementDetails.deliveryDate = new Date();
        
        await User.findByIdAndUpdate(req.user.userId, {
          $inc: { 'buyerDetails.workload.currentAssignments': -1 }
        });
      }

      await requisition.save();

      if (status === 'delivered') {
        try {
          await sendEmail({
            to: requisition.employee.email,
            subject: `Items Delivered - ${requisition.title}`,
            html: `
              <h3>Your Purchase Requisition Items Have Been Delivered</h3>
              <p>Dear ${requisition.employee.fullName},</p>
              <p>Your requested items have been successfully delivered.</p>
              <ul>
                <li><strong>Requisition:</strong> ${requisition.title}</li>
                <li><strong>Delivery Date:</strong> ${new Date().toLocaleDateString('en-GB')}</li>
                ${vendorSelected ? `<li><strong>Supplier:</strong> ${vendorSelected}</li>` : ''}
                ${actualCost ? `<li><strong>Final Cost:</strong> XAF ${parseFloat(actualCost).toLocaleString()}</li>` : ''}
              </ul>
              <p>Thank you for using our procurement system!</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send delivery notification:', emailError);
        }
      }

      res.json({
        success: true,
        message: 'Requisition updated successfully',
        data: requisition
      });

    } catch (error) {
      console.error('Update buyer status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update requisition status',
        error: error.message
      });
    }
  }
);

// Attachment routes
router.get('/:requisitionId/attachments/:attachmentId/download',
  authMiddleware,
  async (req, res) => {
    try {
      const { requisitionId, attachmentId } = req.params;

      const requisition = await PurchaseRequisition.findById(requisitionId)
        .populate('employee', 'fullName email department');

      if (!requisition) {
        return res.status(404).json({
          success: false,
          message: 'Requisition not found'
        });
      }

      const user = await User.findById(req.user.userId);
      const canDownload = 
        requisition.employee._id.equals(req.user.userId) ||
        user.role === 'admin' ||
        user.role === 'supply_chain' ||
        user.role === 'finance' ||
        requisition.approvalChain?.some(step => step.approver.email === user.email);

      if (!canDownload) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const attachment = requisition.attachments.find(
        att => att._id.toString() === attachmentId
      );

      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: 'Attachment not found'
        });
      }

      const filePath = path.join(__dirname, '../uploads/requisitions', attachment.publicId);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found on server'
        });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${attachment.name}"`);
      res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('Error streaming file:', error);
        if (!res.headersSent) {
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

router.get('/:requisitionId/attachments/:attachmentId/preview',
  authMiddleware,
  async (req, res) => {
    try {
      const { requisitionId, attachmentId } = req.params;

      const requisition = await PurchaseRequisition.findById(requisitionId)
        .populate('employee', 'fullName email department');

      if (!requisition) {
        return res.status(404).json({
          success: false,
          message: 'Requisition not found'
        });
      }

      const user = await User.findById(req.user.userId);
      const canView = 
        requisition.employee._id.equals(req.user.userId) ||
        user.role === 'admin' ||
        user.role === 'supply_chain' ||
        user.role === 'finance' ||
        requisition.approvalChain?.some(step => step.approver.email === user.email);

      if (!canView) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const attachment = requisition.attachments.find(
        att => att._id.toString() === attachmentId
      );

      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: 'Attachment not found'
        });
      }

      const filePath = path.join(__dirname, '../uploads/requisitions', attachment.publicId);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found on server'
        });
      }

      res.setHeader('Content-Disposition', `inline; filename="${attachment.name}"`);
      res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('Error streaming file:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error previewing file'
          });
        }
      });

    } catch (error) {
      console.error('Preview attachment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to preview attachment',
        error: error.message
      });
    }
  }
);

// Generic update/delete routes
router.put('/:requisitionId',
  authMiddleware,
  purchaseRequisitionController.updateRequisition
);

router.delete('/:requisitionId',
  authMiddleware,
  purchaseRequisitionController.deleteRequisition
);

// ============================================
// LAST: Generic GET route for single requisition
// ============================================
router.get('/:requisitionId', 
  authMiddleware, 
  purchaseRequisitionController.getEmployeeRequisition
);

module.exports = router;












// const express = require('express');
// const router = express.Router();
// const purchaseRequisitionController = require('../controllers/purchaseRequisitionController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const upload = require('../middlewares/uploadMiddleware');
// const path = require('path');
// const fs = require('fs');

// // ============================================
// // CRITICAL FIX: Specific routes MUST come before parameterized routes
// // Place all static paths (like /dashboard-stats, /finance/budget-codes) 
// // BEFORE dynamic paths (like /:requisitionId)
// // ============================================

// // Employee routes
// router.post('/', 
//   authMiddleware, 
//   upload.array('attachments', 5),
//   purchaseRequisitionController.createRequisition
// );

// router.get('/employee', 
//   authMiddleware, 
//   purchaseRequisitionController.getEmployeeRequisitions
// );

// // Preview approval chain endpoint
// router.post('/preview-approval-chain',
//   authMiddleware,
//   purchaseRequisitionController.getApprovalChainPreview
// );

// // Finance routes - ALL must come before /:requisitionId
// router.get('/finance', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.getFinanceRequisitions
// );

// router.get('/finance/dashboard-data', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.getFinanceDashboardData
// );

// router.get('/finance/budget-codes', 
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.getBudgetCodesForVerification
// );

// router.put('/:requisitionId/finance-verification', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.processFinanceVerification
// );

// // Supervisor routes
// router.get('/supervisor', 
//   authMiddleware, 
//   requireRoles('supervisor', 'admin', 'hr', 'hse', 'it', 'finance'), 
//   purchaseRequisitionController.getSupervisorRequisitions
// );

// router.get('/supervisor/:requisitionId', 
//   authMiddleware, 
//   requireRoles('supervisor', 'admin', 'hr', 'hse', 'it', 'finance'),
//   purchaseRequisitionController.getEmployeeRequisition
// );

// router.put('/:requisitionId/supervisor', 
//   authMiddleware, 
//   requireRoles('supervisor', 'admin', 'hr', 'hse', 'it', 'finance'), 
//   purchaseRequisitionController.processSupervisorDecision
// );

// // Supply Chain routes
// router.get('/supply-chain', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getSupplyChainRequisitions
// );

// router.get('/supply-chain/:requisitionId', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getEmployeeRequisition
// );

// router.put('/:requisitionId/supply-chain', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processSupplyChainDecision
// );

// // Buyer assignment routes
// router.get('/buyers/available',
//   authMiddleware,
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getAvailableBuyers
// );

// router.put('/:requisitionId/assign-buyer', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.assignBuyer
// );

// // Head of Supply Chain approval routes
// router.get('/head-approval', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getHeadApprovalRequisitions
// );

// router.put('/:requisitionId/head-approval', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processHeadApproval
// );

// // Buyer routes for managing assigned requisitions
// router.get('/buyer', 
//   authMiddleware, 
//   requireRoles('buyer', 'supply_chain', 'admin'),
//   purchaseRequisitionController.getBuyerRequisitions
// );

// router.get('/buyer/assigned',
//   authMiddleware,
//   requireRoles('buyer', 'supply_chain', 'admin'),
//   purchaseRequisitionController.getBuyerRequisitions
// );

// router.post('/buyer/:requisitionId/start-procurement',
//   authMiddleware,
//   requireRoles('buyer', 'supply_chain', 'admin'),
//   async (req, res) => {
//     try {
//       const { requisitionId } = req.params;
//       const { procurementMethod, expectedDeliveryDate, notes } = req.body;

//       const requisition = await PurchaseRequisition.findById(requisitionId)
//         .populate('employee', 'fullName email');

//       if (!requisition) {
//         return res.status(404).json({
//           success: false,
//           message: 'Requisition not found'
//         });
//       }

//       // Verify buyer is assigned
//       const user = await User.findById(req.user.userId);
//       const isAssignedBuyer = requisition.supplyChainReview?.assignedBuyer?.toString() === req.user.userId;
//       const isAuthorized = user.role === 'admin' || user.role === 'supply_chain' || isAssignedBuyer;

//       if (!isAuthorized) {
//         return res.status(403).json({
//           success: false,
//           message: 'Not authorized to start procurement for this requisition'
//         });
//       }

//       // Update requisition status
//       requisition.status = 'in_procurement';
      
//       if (!requisition.procurementDetails) {
//         requisition.procurementDetails = {};
//       }

//       requisition.procurementDetails = {
//         ...requisition.procurementDetails,
//         assignedOfficer: req.user.userId,
//         procurementMethod: procurementMethod || 'direct_purchase',
//         procurementStartDate: new Date(),
//         expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
//         notes: notes
//       };

//       await requisition.save();

//       res.json({
//         success: true,
//         message: 'Procurement started successfully',
//         data: requisition
//       });

//     } catch (error) {
//       console.error('Start procurement error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to start procurement',
//         error: error.message
//       });
//     }
//   }
// );

// router.put('/buyer/:requisitionId/update-status',
//   authMiddleware,
//   requireRoles('buyer', 'supply_chain', 'admin'),
//   async (req, res) => {
//     try {
//       const { requisitionId } = req.params;
//       const { 
//         status, 
//         notes, 
//         vendorSelected, 
//         actualCost, 
//         deliveryDate 
//       } = req.body;

//       const requisition = await PurchaseRequisition.findById(requisitionId)
//         .populate('employee', 'fullName email');

//       if (!requisition) {
//         return res.status(404).json({
//           success: false,
//           message: 'Requisition not found'
//         });
//       }

//       // Verify authorization
//       const user = await User.findById(req.user.userId);
//       const isAssignedBuyer = requisition.supplyChainReview?.assignedBuyer?.toString() === req.user.userId;
//       const isAuthorized = user.role === 'admin' || user.role === 'supply_chain' || isAssignedBuyer;

//       if (!isAuthorized) {
//         return res.status(403).json({
//           success: false,
//           message: 'Not authorized to update this requisition'
//         });
//       }

//       // Update requisition
//       if (status) {
//         requisition.status = status;
//       }

//       if (!requisition.procurementDetails) {
//         requisition.procurementDetails = {};
//       }

//       requisition.procurementDetails = {
//         ...requisition.procurementDetails,
//         lastUpdated: new Date(),
//         lastUpdatedBy: req.user.userId,
//         notes: notes,
//         selectedVendor: vendorSelected || requisition.procurementDetails.selectedVendor,
//         finalCost: actualCost ? parseFloat(actualCost) : requisition.procurementDetails.finalCost,
//         deliveryDate: deliveryDate ? new Date(deliveryDate) : requisition.procurementDetails.deliveryDate
//       };

//       if (status === 'procurement_complete') {
//         requisition.procurementDetails.completionDate = new Date();
//       } else if (status === 'delivered') {
//         requisition.procurementDetails.deliveryDate = new Date();
        
//         // Decrease buyer workload
//         await User.findByIdAndUpdate(req.user.userId, {
//           $inc: { 'buyerDetails.workload.currentAssignments': -1 }
//         });
//       }

//       await requisition.save();

//       // Send notification to employee
//       if (status === 'delivered') {
//         try {
//           await sendEmail({
//             to: requisition.employee.email,
//             subject: `Items Delivered - ${requisition.title}`,
//             html: `
//               <h3>Your Purchase Requisition Items Have Been Delivered</h3>
//               <p>Dear ${requisition.employee.fullName},</p>
//               <p>Your requested items have been successfully delivered.</p>
//               <ul>
//                 <li><strong>Requisition:</strong> ${requisition.title}</li>
//                 <li><strong>Delivery Date:</strong> ${new Date().toLocaleDateString('en-GB')}</li>
//                 ${vendorSelected ? `<li><strong>Supplier:</strong> ${vendorSelected}</li>` : ''}
//                 ${actualCost ? `<li><strong>Final Cost:</strong> XAF ${parseFloat(actualCost).toLocaleString()}</li>` : ''}
//               </ul>
//               <p>Thank you for using our procurement system!</p>
//             `
//           });
//         } catch (emailError) {
//           console.error('Failed to send delivery notification:', emailError);
//         }
//       }

//       res.json({
//         success: true,
//         message: 'Requisition updated successfully',
//         data: requisition
//       });

//     } catch (error) {
//       console.error('Update buyer status error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to update requisition status',
//         error: error.message
//       });
//     }
//   }
// );

// // Admin routes
// router.get('/admin', 
//   authMiddleware, 
//   requireRoles('admin'), 
//   purchaseRequisitionController.getAllRequisitions
// );

// router.get('/admin/:requisitionId', 
//   authMiddleware, 
//   requireRoles('admin'),
//   purchaseRequisitionController.getEmployeeRequisition
// );

// // Draft management routes
// router.post('/draft',
//   authMiddleware,
//   purchaseRequisitionController.saveDraft
// );

// // Role-based requisitions endpoint
// router.get('/role',
//   authMiddleware,
//   purchaseRequisitionController.getRequisitionsByRole
// );

// // Dashboard and analytics routes - ALL BEFORE /:requisitionId
// router.get('/dashboard/stats',
//   authMiddleware,
//   purchaseRequisitionController.getDashboardStats
// );

// router.get('/analytics/categories',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain', 'finance'),
//   purchaseRequisitionController.getCategoryAnalytics
// );

// router.get('/analytics/vendors',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain'),
//   purchaseRequisitionController.getVendorPerformance
// );

// // Procurement planning
// router.get('/procurement/planning',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain'),
//   purchaseRequisitionController.getProcurementPlanningData
// );

// // Statistics and reporting
// router.get('/statistics',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain', 'finance'),
//   purchaseRequisitionController.getRequisitionStats
// );

// // Attachment routes with proper parameter handling
// router.get('/:requisitionId/attachments/:attachmentId/download',
//   authMiddleware,
//   async (req, res) => {
//     try {
//       const { requisitionId, attachmentId } = req.params;

//       const requisition = await PurchaseRequisition.findById(requisitionId)
//         .populate('employee', 'fullName email department');

//       if (!requisition) {
//         return res.status(404).json({
//           success: false,
//           message: 'Requisition not found'
//         });
//       }

//       // Check permissions
//       const user = await User.findById(req.user.userId);
//       const canDownload = 
//         requisition.employee._id.equals(req.user.userId) ||
//         user.role === 'admin' ||
//         user.role === 'supply_chain' ||
//         user.role === 'finance' ||
//         requisition.approvalChain?.some(step => step.approver.email === user.email);

//       if (!canDownload) {
//         return res.status(403).json({
//           success: false,
//           message: 'Access denied'
//         });
//       }

//       const attachment = requisition.attachments.find(
//         att => att._id.toString() === attachmentId
//       );

//       if (!attachment) {
//         return res.status(404).json({
//           success: false,
//           message: 'Attachment not found'
//         });
//       }

//       const filePath = path.join(__dirname, '../uploads/requisitions', attachment.publicId);

//       if (!fs.existsSync(filePath)) {
//         return res.status(404).json({
//           success: false,
//           message: 'File not found on server'
//         });
//       }

//       res.setHeader('Content-Disposition', `attachment; filename="${attachment.name}"`);
//       res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');

//       const fileStream = fs.createReadStream(filePath);
//       fileStream.pipe(res);

//       fileStream.on('error', (error) => {
//         console.error('Error streaming file:', error);
//         if (!res.headersSent) {
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

// router.get('/:requisitionId/attachments/:attachmentId/preview',
//   authMiddleware,
//   async (req, res) => {
//     try {
//       const { requisitionId, attachmentId } = req.params;

//       const requisition = await PurchaseRequisition.findById(requisitionId)
//         .populate('employee', 'fullName email department');

//       if (!requisition) {
//         return res.status(404).json({
//           success: false,
//           message: 'Requisition not found'
//         });
//       }

//       const user = await User.findById(req.user.userId);
//       const canView = 
//         requisition.employee._id.equals(req.user.userId) ||
//         user.role === 'admin' ||
//         user.role === 'supply_chain' ||
//         user.role === 'finance' ||
//         requisition.approvalChain?.some(step => step.approver.email === user.email);

//       if (!canView) {
//         return res.status(403).json({
//           success: false,
//           message: 'Access denied'
//         });
//       }

//       const attachment = requisition.attachments.find(
//         att => att._id.toString() === attachmentId
//       );

//       if (!attachment) {
//         return res.status(404).json({
//           success: false,
//           message: 'Attachment not found'
//         });
//       }

//       const filePath = path.join(__dirname, '../uploads/requisitions', attachment.publicId);

//       if (!fs.existsSync(filePath)) {
//         return res.status(404).json({
//           success: false,
//           message: 'File not found on server'
//         });
//       }

//       res.setHeader('Content-Disposition', `inline; filename="${attachment.name}"`);
//       res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');

//       const fileStream = fs.createReadStream(filePath);
//       fileStream.pipe(res);

//       fileStream.on('error', (error) => {
//         console.error('Error streaming file:', error);
//         if (!res.headersSent) {
//           res.status(500).json({
//             success: false,
//             message: 'Error previewing file'
//           });
//         }
//       });

//     } catch (error) {
//       console.error('Preview attachment error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to preview attachment',
//         error: error.message
//       });
//     }
//   }
// );

// // Update and Delete routes
// router.put('/:requisitionId',
//   authMiddleware,
//   purchaseRequisitionController.updateRequisition
// );

// router.delete('/:requisitionId',
//   authMiddleware,
//   purchaseRequisitionController.deleteRequisition
// );

// // Procurement status updates
// router.put('/:requisitionId/procurement',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain', 'buyer'),
//   purchaseRequisitionController.updateProcurementStatus
// );

// // ============================================
// // IMPORTANT: Generic parameterized route MUST be last
// // This catches all remaining GET /:requisitionId patterns
// // ============================================
// router.get('/:requisitionId', 
//   authMiddleware, 
//   purchaseRequisitionController.getEmployeeRequisition
// );

// module.exports = router;










// const express = require('express');
// const router = express.Router();
// const purchaseRequisitionController = require('../controllers/purchaseRequisitionController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const upload = require('../middlewares/uploadMiddleware');
// const path = require('path');
// const fs = require('fs');

// // Employee routes
// router.post('/', 
//   authMiddleware, 
//   upload.array('attachments', 5),
//   purchaseRequisitionController.createRequisition
// );

// // Download attachment
// router.get('/:requisitionId/attachments/:attachmentId/download',
//   authMiddleware,
//   async (req, res) => {
//     try {
//       const { requisitionId, attachmentId } = req.params;

//       const requisition = await PurchaseRequisition.findById(requisitionId)
//         .populate('employee', 'fullName email department');

//       if (!requisition) {
//         return res.status(404).json({
//           success: false,
//           message: 'Requisition not found'
//         });
//       }

//       // Check permissions
//       const user = await User.findById(req.user.userId);
//       const canDownload = 
//         requisition.employee._id.equals(req.user.userId) || // Owner
//         user.role === 'admin' || // Admin
//         user.role === 'supply_chain' || // Supply chain
//         user.role === 'finance' || // Finance
//         requisition.approvalChain?.some(step => step.approver.email === user.email); // Approver

//       if (!canDownload) {
//         return res.status(403).json({
//           success: false,
//           message: 'Access denied'
//         });
//       }

//       // Find attachment
//       const attachment = requisition.attachments.find(
//         att => att._id.toString() === attachmentId
//       );

//       if (!attachment) {
//         return res.status(404).json({
//           success: false,
//           message: 'Attachment not found'
//         });
//       }

//       // Build file path
//       const filePath = path.join(__dirname, '../uploads/requisitions', attachment.publicId);

//       // Check if file exists
//       if (!fs.existsSync(filePath)) {
//         return res.status(404).json({
//           success: false,
//           message: 'File not found on server'
//         });
//       }

//       // Set headers for download
//       res.setHeader('Content-Disposition', `attachment; filename="${attachment.name}"`);
//       res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');

//       // Stream the file
//       const fileStream = fs.createReadStream(filePath);
//       fileStream.pipe(res);

//       fileStream.on('error', (error) => {
//         console.error('Error streaming file:', error);
//         if (!res.headersSent) {
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

// // Preview attachment (opens in browser)
// router.get('/:requisitionId/attachments/:attachmentId/preview',
//   authMiddleware,
//   async (req, res) => {
//     try {
//       const { requisitionId, attachmentId } = req.params;

//       const requisition = await PurchaseRequisition.findById(requisitionId)
//         .populate('employee', 'fullName email department');

//       if (!requisition) {
//         return res.status(404).json({
//           success: false,
//           message: 'Requisition not found'
//         });
//       }

//       // Check permissions
//       const user = await User.findById(req.user.userId);
//       const canView = 
//         requisition.employee._id.equals(req.user.userId) ||
//         user.role === 'admin' ||
//         user.role === 'supply_chain' ||
//         user.role === 'finance' ||
//         requisition.approvalChain?.some(step => step.approver.email === user.email);

//       if (!canView) {
//         return res.status(403).json({
//           success: false,
//           message: 'Access denied'
//         });
//       }

//       // Find attachment
//       const attachment = requisition.attachments.find(
//         att => att._id.toString() === attachmentId
//       );

//       if (!attachment) {
//         return res.status(404).json({
//           success: false,
//           message: 'Attachment not found'
//         });
//       }

//       // Build file path
//       const filePath = path.join(__dirname, '../uploads/requisitions', attachment.publicId);

//       // Check if file exists
//       if (!fs.existsSync(filePath)) {
//         return res.status(404).json({
//           success: false,
//           message: 'File not found on server'
//         });
//       }

//       // Set headers for inline display
//       res.setHeader('Content-Disposition', `inline; filename="${attachment.name}"`);
//       res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');

//       // Stream the file
//       const fileStream = fs.createReadStream(filePath);
//       fileStream.pipe(res);

//       fileStream.on('error', (error) => {
//         console.error('Error streaming file:', error);
//         if (!res.headersSent) {
//           res.status(500).json({
//             success: false,
//             message: 'Error previewing file'
//           });
//         }
//       });

//     } catch (error) {
//       console.error('Preview attachment error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to preview attachment',
//         error: error.message
//       });
//     }
//   }
// );

// router.get('/employee', 
//   authMiddleware, 
//   purchaseRequisitionController.getEmployeeRequisitions
// );

// // Preview approval chain endpoint
// router.post('/preview-approval-chain',
//   authMiddleware,
//   purchaseRequisitionController.getApprovalChainPreview
// );

// // Finance routes
// router.get('/finance', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.getFinanceRequisitions
// );

// router.get('/finance/dashboard-data', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.getFinanceDashboardData
// );

// router.put('/:requisitionId/finance-verification', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.processFinanceVerification
// );

// router.get('/finance/budget-codes', 
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.getBudgetCodesForVerification
// );

// // Supervisor routes
// router.get('/supervisor', 
//   authMiddleware, 
//   requireRoles('supervisor', 'admin', 'hr', 'hse', 'it', 'finance'), 
//   purchaseRequisitionController.getSupervisorRequisitions
// );

// router.get('/supervisor/:requisitionId', 
//   authMiddleware, 
//   requireRoles('supervisor', 'admin', 'hr', 'hse', 'it', 'finance'),
//   purchaseRequisitionController.getEmployeeRequisition
// );

// router.put('/:requisitionId/supervisor', 
//   authMiddleware, 
//   requireRoles('supervisor', 'admin', 'hr', 'hse', 'it', 'finance'), 
//   purchaseRequisitionController.processSupervisorDecision
// );

// // Supply Chain routes
// router.get('/supply-chain', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getSupplyChainRequisitions
// );

// router.get('/supply-chain/:requisitionId', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getEmployeeRequisition
// );

// router.put('/:requisitionId/supply-chain', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processSupplyChainDecision
// );

// // FIXED: Buyer assignment routes
// router.get('/buyers/available',
//   authMiddleware,
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getAvailableBuyers
// );

// router.put('/:requisitionId/assign-buyer', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.assignBuyer
// );

// // Head of Supply Chain approval routes
// router.get('/head-approval', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getHeadApprovalRequisitions
// );

// router.put('/:requisitionId/head-approval', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processHeadApproval
// );

// // FIXED: Buyer routes for managing assigned requisitions
// router.get('/buyer', 
//   authMiddleware, 
//   requireRoles('buyer', 'supply_chain', 'admin'),
//   purchaseRequisitionController.getBuyerRequisitions
// );

// // UPDATED: Buyer specific routes
// router.get('/buyer/assigned',
//   authMiddleware,
//   requireRoles('buyer', 'supply_chain', 'admin'),
//   purchaseRequisitionController.getBuyerRequisitions
// );

// router.post('/buyer/:requisitionId/start-procurement',
//   authMiddleware,
//   requireRoles('buyer', 'supply_chain', 'admin'),
//   async (req, res) => {
//     try {
//       const { requisitionId } = req.params;
//       const { procurementMethod, expectedDeliveryDate, notes } = req.body;

//       const requisition = await PurchaseRequisition.findById(requisitionId)
//         .populate('employee', 'fullName email');

//       if (!requisition) {
//         return res.status(404).json({
//           success: false,
//           message: 'Requisition not found'
//         });
//       }

//       // Verify buyer is assigned
//       const user = await User.findById(req.user.userId);
//       const isAssignedBuyer = requisition.supplyChainReview?.assignedBuyer?.toString() === req.user.userId;
//       const isAuthorized = user.role === 'admin' || user.role === 'supply_chain' || isAssignedBuyer;

//       if (!isAuthorized) {
//         return res.status(403).json({
//           success: false,
//           message: 'Not authorized to start procurement for this requisition'
//         });
//       }

//       // Update requisition status
//       requisition.status = 'in_procurement';
      
//       if (!requisition.procurementDetails) {
//         requisition.procurementDetails = {};
//       }

//       requisition.procurementDetails = {
//         ...requisition.procurementDetails,
//         assignedOfficer: req.user.userId,
//         procurementMethod: procurementMethod || 'direct_purchase',
//         procurementStartDate: new Date(),
//         expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
//         notes: notes
//       };

//       await requisition.save();

//       res.json({
//         success: true,
//         message: 'Procurement started successfully',
//         data: requisition
//       });

//     } catch (error) {
//       console.error('Start procurement error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to start procurement',
//         error: error.message
//       });
//     }
//   }
// );

// router.put('/buyer/:requisitionId/update-status',
//   authMiddleware,
//   requireRoles('buyer', 'supply_chain', 'admin'),
//   async (req, res) => {
//     try {
//       const { requisitionId } = req.params;
//       const { 
//         status, 
//         notes, 
//         vendorSelected, 
//         actualCost, 
//         deliveryDate 
//       } = req.body;

//       const requisition = await PurchaseRequisition.findById(requisitionId)
//         .populate('employee', 'fullName email');

//       if (!requisition) {
//         return res.status(404).json({
//           success: false,
//           message: 'Requisition not found'
//         });
//       }

//       // Verify authorization
//       const user = await User.findById(req.user.userId);
//       const isAssignedBuyer = requisition.supplyChainReview?.assignedBuyer?.toString() === req.user.userId;
//       const isAuthorized = user.role === 'admin' || user.role === 'supply_chain' || isAssignedBuyer;

//       if (!isAuthorized) {
//         return res.status(403).json({
//           success: false,
//           message: 'Not authorized to update this requisition'
//         });
//       }

//       // Update requisition
//       if (status) {
//         requisition.status = status;
//       }

//       if (!requisition.procurementDetails) {
//         requisition.procurementDetails = {};
//       }

//       requisition.procurementDetails = {
//         ...requisition.procurementDetails,
//         lastUpdated: new Date(),
//         lastUpdatedBy: req.user.userId,
//         notes: notes,
//         selectedVendor: vendorSelected || requisition.procurementDetails.selectedVendor,
//         finalCost: actualCost ? parseFloat(actualCost) : requisition.procurementDetails.finalCost,
//         deliveryDate: deliveryDate ? new Date(deliveryDate) : requisition.procurementDetails.deliveryDate
//       };

//       if (status === 'procurement_complete') {
//         requisition.procurementDetails.completionDate = new Date();
//       } else if (status === 'delivered') {
//         requisition.procurementDetails.deliveryDate = new Date();
        
//         // Decrease buyer workload
//         await User.findByIdAndUpdate(req.user.userId, {
//           $inc: { 'buyerDetails.workload.currentAssignments': -1 }
//         });
//       }

//       await requisition.save();

//       // Send notification to employee
//       if (status === 'delivered') {
//         try {
//           await sendEmail({
//             to: requisition.employee.email,
//             subject: `Items Delivered - ${requisition.title}`,
//             html: `
//               <h3>Your Purchase Requisition Items Have Been Delivered</h3>
//               <p>Dear ${requisition.employee.fullName},</p>
//               <p>Your requested items have been successfully delivered.</p>
//               <ul>
//                 <li><strong>Requisition:</strong> ${requisition.title}</li>
//                 <li><strong>Delivery Date:</strong> ${new Date().toLocaleDateString('en-GB')}</li>
//                 ${vendorSelected ? `<li><strong>Supplier:</strong> ${vendorSelected}</li>` : ''}
//                 ${actualCost ? `<li><strong>Final Cost:</strong> XAF ${parseFloat(actualCost).toLocaleString()}</li>` : ''}
//               </ul>
//               <p>Thank you for using our procurement system!</p>
//             `
//           });
//         } catch (emailError) {
//           console.error('Failed to send delivery notification:', emailError);
//         }
//       }

//       res.json({
//         success: true,
//         message: 'Requisition updated successfully',
//         data: requisition
//       });

//     } catch (error) {
//       console.error('Update buyer status error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to update requisition status',
//         error: error.message
//       });
//     }
//   }
// );

// // Admin routes
// router.get('/admin', 
//   authMiddleware, 
//   requireRoles('admin'), 
//   purchaseRequisitionController.getAllRequisitions
// );

// router.get('/admin/:requisitionId', 
//   authMiddleware, 
//   requireRoles('admin'),
//   purchaseRequisitionController.getEmployeeRequisition
// );

// // Generic parameterized routes
// router.get('/:requisitionId', 
//   authMiddleware, 
//   purchaseRequisitionController.getEmployeeRequisition
// );

// // Draft management routes
// router.post('/draft',
//   authMiddleware,
//   purchaseRequisitionController.saveDraft
// );

// // Role-based requisitions endpoint
// router.get('/role',
//   authMiddleware,
//   purchaseRequisitionController.getRequisitionsByRole
// );

// // Dashboard and analytics routes
// router.get('/dashboard/stats',
//   authMiddleware,
//   purchaseRequisitionController.getDashboardStats
// );

// router.get('/analytics/categories',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain', 'finance'),
//   purchaseRequisitionController.getCategoryAnalytics
// );

// router.get('/analytics/vendors',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain'),
//   purchaseRequisitionController.getVendorPerformance
// );

// // Procurement planning
// router.get('/procurement/planning',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain'),
//   purchaseRequisitionController.getProcurementPlanningData
// );

// // Statistics and reporting
// router.get('/statistics',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain', 'finance'),
//   purchaseRequisitionController.getRequisitionStats
// );

// // Update requisition (for drafts)
// router.put('/:requisitionId',
//   authMiddleware,
//   purchaseRequisitionController.updateRequisition
// );

// // Delete requisition (for drafts)
// router.delete('/:requisitionId',
//   authMiddleware,
//   purchaseRequisitionController.deleteRequisition
// );

// // Procurement status updates
// router.put('/:requisitionId/procurement',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain', 'buyer'),
//   purchaseRequisitionController.updateProcurementStatus
// );

// module.exports = router;




