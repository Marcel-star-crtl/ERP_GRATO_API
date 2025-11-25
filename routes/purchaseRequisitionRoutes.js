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

// Dashboard stats
router.get('/dashboard-stats', 
  authMiddleware,
  purchaseRequisitionController.getDashboardStats
);

// Purchase requisition specific dashboard stats
router.get('/pr-dashboard-stats', 
  authMiddleware,
  purchaseRequisitionController.getPurchaseRequisitionDashboardStats
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
      console.log('Payment Method:', paymentMethod); // Should be 'cash' or 'bank'
      
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
      
      // ✅ CRITICAL FIX: Update supply chain review WITH payment method
      requisition.supplyChainReview = {
        ...requisition.supplyChainReview,
        sourcingType,
        purchaseTypeAssigned: purchaseType,
        assignedBuyer,
        buyerAssignmentDate: new Date(),
        buyerAssignedBy: req.user.userId,
        estimatedCost: estimatedCost || requisition.budgetXAF,
        comments,
        decision: 'approve',
        decisionDate: new Date(),
        decidedBy: req.user.userId
      };
      
      // ✅ CRITICAL FIX 1: Set payment method on the main requisition object
      requisition.paymentMethod = paymentMethod;
      requisition.purchaseType = purchaseType;
      
      console.log('✅ Payment method set to:', paymentMethod);
      console.log('✅ Purchase type set to:', purchaseType);
      
      // ✅ CRITICAL FIX 2: Update supply chain step in approval chain
      const supplyChainStepIndex = requisition.approvalChain.findIndex(
        step => step.approver.email.toLowerCase() === user.email.toLowerCase() && 
                step.status === 'pending'
      );

      if (supplyChainStepIndex !== -1) {
        requisition.approvalChain[supplyChainStepIndex].status = 'approved';
        requisition.approvalChain[supplyChainStepIndex].comments = comments;
        requisition.approvalChain[supplyChainStepIndex].actionDate = new Date();
        requisition.approvalChain[supplyChainStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
        requisition.approvalChain[supplyChainStepIndex].decidedBy = req.user.userId;
        
        console.log('✅ Supply chain approval chain step updated to approved');
      } else {
        console.log('⚠️ Warning: Supply chain step not found in approval chain');
      }
      
      // Move to head approval
      requisition.status = 'pending_head_approval';
      
      await requisition.save();
      
      console.log('✅ Business decisions recorded');
      console.log('Current payment method:', requisition.paymentMethod);
      
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
                <li><strong>Payment:</strong> ${paymentMethod === 'cash' ? '💵 PETTY CASH' : '🏦 BANK TRANSFER'}</li>
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
                  <li><strong>Payment:</strong> ${paymentMethod === 'cash' ? 'PETTY CASH' : 'BANK TRANSFER'}</li>
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
          paymentMethod: requisition.paymentMethod, // ✅ Include payment method in response
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

router.get('/head-approval/:requisitionId', 
  authMiddleware, 
  requireRoles('supply_chain', 'admin'),
  purchaseRequisitionController.getHeadApprovalRequisition
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






