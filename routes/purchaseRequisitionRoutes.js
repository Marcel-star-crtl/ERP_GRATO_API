const express = require('express');
const router = express.Router();
const purchaseRequisitionController = require('../controllers/purchaseRequisitionController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// ============================================
// STATIC ROUTES FIRST
// ============================================

// Dashboard stats
router.get('/dashboard-stats', 
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
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical'), 
  purchaseRequisitionController.getSupervisorRequisitions
);

// ✅ NEW: Supply Chain Coordinator routes
router.get('/supply-chain', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.getSupplyChainRequisitions
);

router.get('/supply-chain/pending-decisions',
  authMiddleware,
  requireRoles('supply_chain', 'admin'),
  async (req, res) => {
    try {
      const PurchaseRequisition = require('../models/PurchaseRequisition');
      
      // Get requisitions pending supply chain business decisions
      const requisitions = await PurchaseRequisition.find({
        status: 'pending_supply_chain_review'
      })
      .populate('employee', 'fullName email department')
      .populate('financeVerification.verifiedBy', 'fullName email')
      .sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: requisitions,
        count: requisitions.length
      });
    } catch (error) {
      console.error('Get pending supply chain decisions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending decisions',
        error: error.message
      });
    }
  }
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

// ✅ NEW: Head approval routes
router.get('/head-approval', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.getHeadApprovalRequisitions
);

router.get('/head-approval/stats',
  authMiddleware,
  requireRoles('supply_chain', 'admin'),
  async (req, res) => {
    try {
      const PurchaseRequisition = require('../models/PurchaseRequisition');
      
      const pending = await PurchaseRequisition.countDocuments({
        status: 'pending_head_approval'
      });
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const approvedToday = await PurchaseRequisition.countDocuments({
        'headApproval.decision': 'approved',
        'headApproval.decisionDate': { $gte: startOfDay }
      });
      
      res.json({
        success: true,
        data: {
          pending,
          approvedToday,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Get head approval stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stats',
        error: error.message
      });
    }
  }
);

// Admin routes
router.get('/admin', 
  authMiddleware, 
  requireRoles('admin'), 
  purchaseRequisitionController.getAllRequisitions
);

// ============================================
// ACTION ROUTES - NEW APPROVAL FLOW
// ============================================

// ✅ STEP 1: Finance Verification (Budget Check)
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

// ✅ STEP 2: Supply Chain Coordinator Business Decisions
// (Sourcing type, Purchase type, Payment method, Buyer assignment)
router.put('/:requisitionId/supply-chain-decisions', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  async (req, res) => {
    try {
      const { requisitionId } = req.params;
      const { 
        sourcingType, 
        purchaseType,
        paymentMethod, 
        assignedBuyer, 
        estimatedCost,
        comments 
      } = req.body;
      
      console.log('\n=== SUPPLY CHAIN BUSINESS DECISIONS ===');
      console.log('Requisition ID:', requisitionId);
      console.log('Payment Method:', paymentMethod);
      
      const User = require('../models/User');
      const PurchaseRequisition = require('../models/PurchaseRequisition');
      const { sendEmail } = require('../services/emailService');
      
      const user = await User.findById(req.user.userId);
      
      // Verify authorization
      const canProcess = 
        user.role === 'admin' ||
        user.role === 'supply_chain' ||
        user.email === 'lukong.lambert@gratoglobal.com';
      
      if (!canProcess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const requisition = await PurchaseRequisition.findById(requisitionId)
        .populate('employee', 'fullName email department')
        .populate('financeVerification.verifiedBy', 'fullName email');
      
      if (!requisition) {
        return res.status(404).json({
          success: false,
          message: 'Requisition not found'
        });
      }
      
      // Must be after finance verification
      if (requisition.status !== 'pending_supply_chain_review') {
        return res.status(400).json({
          success: false,
          message: `Cannot process at this stage. Current status: ${requisition.status}`
        });
      }
      
      // Validate required fields
      if (!sourcingType || !purchaseType || !paymentMethod || !assignedBuyer) {
        return res.status(400).json({
          success: false,
          message: 'All business decisions are required (sourcing type, purchase type, payment method, buyer)'
        });
      }
      
      // Validate buyer
      const buyer = await User.findOne({
        _id: assignedBuyer,
        $or: [
          { role: 'buyer' },
          { departmentRole: 'buyer' },
          { email: 'lukong.lambert@gratoglobal.com' }
        ],
        isActive: true
      });
      
      if (!buyer) {
        return res.status(400).json({
          success: false,
          message: 'Invalid buyer selected'
        });
      }
      
      // Update supply chain review
      requisition.supplyChainReview = {
        ...requisition.supplyChainReview,
        sourcingType,
        purchaseTypeAssigned: purchaseType,
        paymentMethod,
        assignedBuyer,
        buyerAssignmentDate: new Date(),
        buyerAssignedBy: req.user.userId,
        estimatedCost: estimatedCost || requisition.budgetXAF,
        comments,
        decision: 'approve',
        decisionDate: new Date(),
        decidedBy: req.user.userId
      };
      
      requisition.purchaseType = purchaseType;
      requisition.paymentMethod = paymentMethod;
      requisition.status = 'pending_head_approval';
      
      await requisition.save();
      
      console.log('✅ Business decisions recorded');
      
      // Notify buyer
      await sendEmail({
        to: buyer.email,
        subject: `Purchase Assignment - Pending Head Approval - ${requisition.employee.fullName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1890ff;">📋 New Purchase Assignment (Pending Approval)</h2>
            <p>Dear ${buyer.fullName},</p>
            <p>You have been assigned a purchase requisition. It is pending final approval from the Head of Business.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Requisition:</strong> ${requisition.title}</li>
                <li><strong>Budget:</strong> XAF ${(estimatedCost || requisition.budgetXAF || 0).toLocaleString()}</li>
                <li><strong>Sourcing:</strong> ${sourcingType}</li>
                <li><strong>Purchase Type:</strong> ${purchaseType}</li>
                <li><strong>Payment:</strong> ${paymentMethod === 'cash' ? 'PETTY CASH' : 'BANK TRANSFER'}</li>
              </ul>
            </div>
            <p>You'll be notified when approved.</p>
          </div>
        `
      }).catch(err => console.error('Notification error:', err));
      
      // Notify head
      const head = await User.findOne({ email: 'kelvin.eyong@gratoglobal.com' });
      if (head) {
        await sendEmail({
          to: head.email,
          subject: `Purchase Requisition Ready for Final Approval - ${requisition.employee.fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #faad14;">⚡ Final Approval Required</h2>
              <p>A purchase requisition has completed all business decisions.</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h4>Business Decisions by ${user.fullName}:</h4>
                <ul>
                  <li><strong>Sourcing:</strong> ${sourcingType}</li>
                  <li><strong>Purchase Type:</strong> ${purchaseType}</li>
                  <li><strong>Payment:</strong> ${paymentMethod}</li>
                  <li><strong>Assigned Buyer:</strong> ${buyer.fullName}</li>
                </ul>
              </div>
            </div>
          `
        }).catch(err => console.error('Notification error:', err));
      }
      
      res.json({
        success: true,
        message: 'Business decisions recorded. Moving to head approval.',
        data: {
          requisitionId: requisition._id,
          status: requisition.status,
          businessDecisions: {
            sourcingType,
            purchaseType,
            paymentMethod,
            assignedBuyer: {
              id: buyer._id,
              name: buyer.fullName
            }
          }
        }
      });
      
    } catch (error) {
      console.error('Supply chain decisions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process business decisions',
        error: error.message
      });
    }
  }
);

router.post('/:requisitionId/supply-chain-decisions', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  async (req, res) => {
    // Same handler as PUT - delegate to PUT handler
    req.method = 'PUT';
    router.handle(req, res);
  }
);

// // ✅ STEP 3: Head of Business Final Approval
// router.put('/:requisitionId/head-approval', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processHeadApproval
// );

// router.post('/:requisitionId/head-approval', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processHeadApproval
// );

// ============================================
// LEGACY ROUTES (for backward compatibility)
// ============================================

// Supervisor decision
router.put('/:requisitionId/supervisor', 
  authMiddleware, 
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical'), 
  purchaseRequisitionController.processSupervisorDecision
);

router.post('/:requisitionId/supervisor', 
  authMiddleware, 
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical'), 
  purchaseRequisitionController.processSupervisorDecision
);

// ============================================
// GENERIC ROUTES (last)
// ============================================

router.get('/:requisitionId', 
  authMiddleware, 
  purchaseRequisitionController.getEmployeeRequisition
);

router.put('/:requisitionId',
  authMiddleware,
  purchaseRequisitionController.updateRequisition
);

router.delete('/:requisitionId',
  authMiddleware,
  purchaseRequisitionController.deleteRequisition
);

module.exports = router;










// const express = require('express');
// const router = express.Router();
// const purchaseRequisitionController = require('../controllers/purchaseRequisitionController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const upload = require('../middlewares/uploadMiddleware');
// const path = require('path');
// const fs = require('fs');
// const PurchaseRequisition = require('../models/PurchaseRequisition');
// const User = require('../models/User');
// const { sendEmail } = require('../services/emailService');

// // ============================================
// // DIAGNOSTIC MIDDLEWARE - Remove after debugging
// // ============================================
// router.use((req, res, next) => {
//   console.log(`\n=== ROUTE DEBUG ===`);
//   console.log(`Method: ${req.method}`);
//   console.log(`Path: ${req.path}`);
//   console.log(`Full URL: ${req.originalUrl}`);
//   console.log(`==================\n`);
//   next();
// });

// // ============================================
// // STATIC ROUTES FIRST (must come before /:requisitionId)
// // ============================================

// // Dashboard stats - multiple path variants for safety
// router.get('/dashboard-stats', 
//   authMiddleware,
//   purchaseRequisitionController.getDashboardStats
// );

// router.get('/dashboard/stats', 
//   authMiddleware,
//   purchaseRequisitionController.getDashboardStats
// );

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

// // Preview approval chain
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

// router.get('/finance/budget-codes', 
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.getBudgetCodesForVerification
// );

// // Supervisor routes
// router.get('/supervisor', 
//   authMiddleware, 
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'), 
//   purchaseRequisitionController.getSupervisorRequisitions
// );

// // Supply Chain routes
// router.get('/supply-chain', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getSupplyChainRequisitions
// );

// // Buyer routes
// router.get('/buyers/available',
//   authMiddleware,
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getAvailableBuyers
// );

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

// // Head approval routes
// router.get('/head-approval', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getHeadApprovalRequisitions
// );

// // Admin routes
// router.get('/admin', 
//   authMiddleware, 
//   requireRoles('admin'), 
//   purchaseRequisitionController.getAllRequisitions
// );

// // Draft management
// router.post('/draft',
//   authMiddleware,
//   purchaseRequisitionController.saveDraft
// );

// // Role-based requisitions
// router.get('/role',
//   authMiddleware,
//   purchaseRequisitionController.getRequisitionsByRole
// );

// // Analytics routes
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

// // Statistics
// router.get('/statistics',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain', 'finance'),
//   purchaseRequisitionController.getRequisitionStats
// );

// // ============================================
// // PARAMETERIZED ROUTES (after specific paths)
// // ============================================

// // Supervisor specific requisition
// router.get('/supervisor/:requisitionId', 
//   authMiddleware, 
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   purchaseRequisitionController.getEmployeeRequisition
// );

// // Supply chain specific requisition
// router.get('/supply-chain/:requisitionId', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.getEmployeeRequisition
// );

// // Admin specific requisition
// router.get('/admin/:requisitionId', 
//   authMiddleware, 
//   requireRoles('admin'),
//   purchaseRequisitionController.getEmployeeRequisition
// );

// // ============================================
// // ACTION ROUTES (PUT/POST for updates)
// // Support both PUT and POST for compatibility
// // ============================================

// // Finance verification - BOTH PUT AND POST
// router.put('/:requisitionId/finance-verification', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.processFinanceVerification
// );

// router.post('/:requisitionId/finance-verification', 
//   authMiddleware, 
//   requireRoles('finance', 'admin'),
//   purchaseRequisitionController.processFinanceVerification
// );

// // Supervisor decision - BOTH PUT AND POST
// router.put('/:requisitionId/supervisor', 
//   authMiddleware, 
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'), 
//   purchaseRequisitionController.processSupervisorDecision
// );

// router.post('/:requisitionId/supervisor', 
//   authMiddleware, 
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'), 
//   purchaseRequisitionController.processSupervisorDecision
// );

// // Supply chain decision - BOTH PUT AND POST
// router.put('/:requisitionId/supply-chain', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processSupplyChainDecision
// );

// router.post('/:requisitionId/supply-chain', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processSupplyChainDecision
// );

// // Buyer assignment - BOTH PUT AND POST
// router.put('/:requisitionId/assign-buyer', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.assignBuyer
// );

// router.post('/:requisitionId/assign-buyer', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.assignBuyer
// );

// // Head approval - BOTH PUT AND POST
// router.put('/:requisitionId/head-approval', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processHeadApproval
// );

// router.post('/:requisitionId/head-approval', 
//   authMiddleware, 
//   requireRoles('supply_chain', 'admin'),
//   purchaseRequisitionController.processHeadApproval
// );

// // Procurement updates - BOTH PUT AND POST
// router.put('/:requisitionId/procurement',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain', 'buyer'),
//   purchaseRequisitionController.updateProcurementStatus
// );

// router.post('/:requisitionId/procurement',
//   authMiddleware,
//   requireRoles('admin', 'supply_chain', 'buyer'),
//   purchaseRequisitionController.updateProcurementStatus
// );

// // Buyer specific actions
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

//       const user = await User.findById(req.user.userId);
//       const isAssignedBuyer = requisition.supplyChainReview?.assignedBuyer?.toString() === req.user.userId;
//       const isAuthorized = user.role === 'admin' || user.role === 'supply_chain' || isAssignedBuyer;

//       if (!isAuthorized) {
//         return res.status(403).json({
//           success: false,
//           message: 'Not authorized to start procurement for this requisition'
//         });
//       }

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
//       const { status, notes, vendorSelected, actualCost, deliveryDate } = req.body;

//       const requisition = await PurchaseRequisition.findById(requisitionId)
//         .populate('employee', 'fullName email');

//       if (!requisition) {
//         return res.status(404).json({
//           success: false,
//           message: 'Requisition not found'
//         });
//       }

//       const user = await User.findById(req.user.userId);
//       const isAssignedBuyer = requisition.supplyChainReview?.assignedBuyer?.toString() === req.user.userId;
//       const isAuthorized = user.role === 'admin' || user.role === 'supply_chain' || isAssignedBuyer;

//       if (!isAuthorized) {
//         return res.status(403).json({
//           success: false,
//           message: 'Not authorized to update this requisition'
//         });
//       }

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
        
//         await User.findByIdAndUpdate(req.user.userId, {
//           $inc: { 'buyerDetails.workload.currentAssignments': -1 }
//         });
//       }

//       await requisition.save();

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

// // Attachment routes
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

// // Generic update/delete routes
// router.put('/:requisitionId',
//   authMiddleware,
//   purchaseRequisitionController.updateRequisition
// );

// router.delete('/:requisitionId',
//   authMiddleware,
//   purchaseRequisitionController.deleteRequisition
// );

// // ============================================
// // LAST: Generic GET route for single requisition
// // ============================================
// router.get('/:requisitionId', 
//   authMiddleware, 
//   purchaseRequisitionController.getEmployeeRequisition
// );

// module.exports = router;




