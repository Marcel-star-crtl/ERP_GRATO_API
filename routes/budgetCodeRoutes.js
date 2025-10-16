const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const {
  createBudgetCode,
  processBudgetCodeApproval,
  getBudgetCodes,
  getPendingApprovalsForUser,
  getBudgetCode,
  updateBudgetCode,
  deleteBudgetCode,
  getBudgetCodeUtilization,
  allocateBudgetToRequisition
} = require('../controllers/budgetCodeController');

/**
 * @route   POST /api/budget-codes
 * @desc    Create new budget code (with approval workflow)
 * @access  Private (Finance, Admin)
 */
router.post(
  '/',
  authMiddleware,
  requireRoles('finance', 'admin'),
  createBudgetCode
);

/**
 * @route   GET /api/budget-codes
 * @desc    Get all budget codes (with filtering)
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  authMiddleware,
  getBudgetCodes
);

/**
 * @route   GET /api/budget-codes/available
 * @desc    Get available (active) budget codes for requisitions
 * @access  Private
 */
router.get(
  '/available',
  authMiddleware,
  async (req, res, next) => {
    req.query.active = 'true';
    req.query.status = 'active';
    next();
  },
  getBudgetCodes
);

/**
 * @route   GET /api/budget-codes/pending-approvals
 * @desc    Get budget codes pending approval for current user
 * @access  Private (Admin, Finance, Department Heads)
 */
router.get(
  '/pending-approvals',
  authMiddleware,
  requireRoles('admin', 'finance', 'supervisor'),
  getPendingApprovalsForUser
);

/**
 * @route   GET /api/budget-codes/:codeId
 * @desc    Get single budget code by ID or code
 * @access  Private
 */
router.get(
  '/:codeId',
  authMiddleware,
  getBudgetCode
);

/**
 * @route   PUT /api/budget-codes/:codeId
 * @desc    Update budget code
 * @access  Private (Finance, Admin)
 */
router.put(
  '/:codeId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  updateBudgetCode
);

/**
 * @route   DELETE /api/budget-codes/:codeId
 * @desc    Delete budget code
 * @access  Private (Finance, Admin)
 */
router.delete(
  '/:codeId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  deleteBudgetCode
);

/**
 * @route   POST /api/budget-codes/:codeId/approve
 * @desc    Approve or reject budget code at current approval level
 * @access  Private (Admin, Finance, Department Heads)
 */
router.post(
  '/:codeId/approve',
  authMiddleware,
  requireRoles('admin', 'finance', 'supervisor'),
  processBudgetCodeApproval
);

/**
 * @route   GET /api/budget-codes/:codeId/utilization
 * @desc    Get budget code utilization report
 * @access  Private (Finance, Admin, Budget Owner)
 */
router.get(
  '/:codeId/utilization',
  authMiddleware,
  requireRoles('finance', 'admin', 'supervisor'),
  getBudgetCodeUtilization
);

/**
 * @route   POST /api/budget-codes/:codeId/allocate
 * @desc    Allocate budget to a purchase requisition
 * @access  Private (Finance)
 */
router.post(
  '/:codeId/allocate',
  authMiddleware,
  requireRoles('finance'),
  allocateBudgetToRequisition
);

module.exports = router;









// const express = require('express');
// const router = express.Router();
// const { 
//   createBudgetCode,
//   processBudgetCodeApprovalAction,
//   getPendingApprovals,
//   getBudgetCodes,
//   getBudgetCode,
//   updateBudgetCode
// } = require('../controllers/budgetCodeController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// /**
//  * @route   POST /api/budget-codes
//  * @desc    Create new budget code (initiates approval workflow)
//  * @access  Private - Admin, Finance
//  */
// router.post(
//   '/',
//   authMiddleware,
//   requireRoles('admin', 'finance'),
//   createBudgetCode
// );

// /**
//  * @route   GET /api/budget-codes
//  * @desc    Get all budget codes with filters
//  * @access  Private - All authenticated users
//  */
// router.get(
//   '/',
//   authMiddleware,
//   getBudgetCodes
// );

// /**
//  * @route   GET /api/budget-codes/pending-approvals
//  * @desc    Get budget codes pending approval for current user
//  * @access  Private - Admin, Finance
//  */
// router.get(
//   '/pending-approvals',
//   authMiddleware,
//   requireRoles('admin', 'finance'),
//   getPendingApprovals
// );

// /**
//  * @route   GET /api/budget-codes/:codeId
//  * @desc    Get single budget code details
//  * @access  Private - All authenticated users
//  */
// router.get(
//   '/:codeId',
//   authMiddleware,
//   getBudgetCode
// );

// /**
//  * @route   PUT /api/budget-codes/:codeId
//  * @desc    Update budget code (only active codes)
//  * @access  Private - Admin, Finance
//  */
// router.put(
//   '/:codeId',
//   authMiddleware,
//   requireRoles('admin', 'finance'),
//   updateBudgetCode
// );

// /**
//  * @route   POST /api/budget-codes/:codeId/approve
//  * @desc    Approve or reject budget code at current approval level
//  * @access  Private - Admin, Finance (based on approval chain)
//  */
// router.post(
//   '/:codeId/approve',
//   authMiddleware,
//   requireRoles('admin', 'finance'),
//   processBudgetCodeApprovalAction
// );

// module.exports = router;








// const express = require('express');
// const router = express.Router();
// const budgetCodeController = require('../controllers/budgetCodeController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// // Apply authentication middleware to all routes
// router.use(authMiddleware);

// // Budget Code CRUD Operations
// router.post('/', 
//   requireRoles('finance', 'admin'),
//   budgetCodeController.createBudgetCode
// );

// router.get('/', 
//   // requireRoles('finance', 'admin', 'supply_chain'),
//   budgetCodeController.getBudgetCodes
// );

// router.get('/available', 
//   // requireRoles('finance', 'admin', 'supply_chain', 'manager', 'supervisor'),
//   budgetCodeController.getAvailableBudgetCodes
// );

// router.get('/requiring-attention', 
//   // requireRoles('finance', 'admin'),
//   budgetCodeController.getBudgetCodesRequiringAttention
// );

// router.get('/allocation-report', 
//   // requireRoles('finance', 'admin'),
//   budgetCodeController.getBudgetAllocationReport
// );

// router.get('/:codeId', 
//   // requireRoles('finance', 'admin', 'supply_chain'),
//   budgetCodeController.getBudgetCode
// );

// router.put('/:codeId', 
//   // requireRoles('finance', 'admin'),
//   budgetCodeController.updateBudgetCode
// );

// router.delete('/:codeId', 
//   // requireRoles('finance', 'admin'),
//   budgetCodeController.deleteBudgetCode
// );

// router.get('/:codeId/utilization', 
//   // requireRoles('finance', 'admin'),
//   budgetCodeController.getBudgetCodeUtilization
// );

// router.post('/:codeId/allocate', 
//   requireRoles('finance', 'admin'),
//   budgetCodeController.allocateBudgetToRequisition
// );

// module.exports = router;