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
  allocateBudgetToRequisition,
  getBudgetDashboard,
  getBudgetUtilizationReport,
  getBudgetForecast,
  requestBudgetRevision,
  getBudgetRevisions,
  approveBudgetRevision,
  rejectBudgetRevision,
  getPendingRevisions
} = require('../controllers/budgetCodeController');

// ============================================
// SPECIFIC ROUTES MUST COME FIRST
// ============================================

/**
 * @route   GET /api/budget-codes/dashboard
 * @desc    Get comprehensive budget dashboard
 * @access  Private (Finance, Admin)
 */
router.get(
  '/dashboard',
  authMiddleware,
  requireRoles('finance', 'admin'),
  getBudgetDashboard
);

/**
 * @route   GET /api/budget-codes/reports/utilization
 * @desc    Get budget utilization report
 * @access  Private (Finance, Admin)
 */
router.get(
  '/reports/utilization',
  authMiddleware,
  requireRoles('finance', 'admin'),
  getBudgetUtilizationReport
);

/**
 * @route   GET /api/budget-codes/revisions/pending
 * @desc    Get pending budget revisions for current user
 * @access  Private (Admin, Finance, Supervisors)
 */
router.get(
  '/revisions/pending',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  getPendingRevisions
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
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  getPendingApprovalsForUser
);

// ============================================
// GENERAL ROUTES
// ============================================

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

// ============================================
// PARAMETERIZED ROUTES (MUST COME LAST)
// ============================================

/**
 * @route   GET /api/budget-codes/:codeId/forecast
 * @desc    Get budget forecast and projections
 * @access  Private (Finance, Admin, Budget Owner)
 */
router.get(
  '/:codeId/forecast',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  getBudgetForecast
);

/**
 * @route   GET /api/budget-codes/:codeId/revisions
 * @desc    Get all revisions for a budget code
 * @access  Private (Finance, Admin)
 */
router.get(
  '/:codeId/revisions',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  getBudgetRevisions
);

/**
 * @route   POST /api/budget-codes/:codeId/revisions
 * @desc    Request budget revision (increase/decrease)
 * @access  Private (Finance, Admin)
 */
router.post(
  '/:codeId/revisions',
  authMiddleware,
  requireRoles('finance', 'admin'),
  requestBudgetRevision
);

/**
 * @route   POST /api/budget-codes/:codeId/revisions/:revisionId/approve
 * @desc    Approve budget revision
 * @access  Private (Admin, Finance, Department Heads)
 */
router.post(
  '/:codeId/revisions/:revisionId/approve',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  approveBudgetRevision
);

/**
 * @route   POST /api/budget-codes/:codeId/revisions/:revisionId/reject
 * @desc    Reject budget revision
 * @access  Private (Admin, Finance, Department Heads)
 */
router.post(
  '/:codeId/revisions/:revisionId/reject',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  rejectBudgetRevision
);

/**
 * @route   GET /api/budget-codes/:codeId/utilization
 * @desc    Get budget code utilization report
 * @access  Private (Finance, Admin, Budget Owner)
 */
router.get(
  '/:codeId/utilization',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
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

/**
 * @route   POST /api/budget-codes/:codeId/approve
 * @desc    Approve or reject budget code at current approval level
 * @access  Private (Admin, Finance, Department Heads)
 */
router.post(
  '/:codeId/approve',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  processBudgetCodeApproval
);

/**
 * @route   POST /api/budget-codes/:codeId/release-stale
 * @desc    Release stale budget reservations (approved but not disbursed)
 * @access  Private (Finance, Admin)
 */
router.post(
  '/:codeId/release-stale',
  authMiddleware,
  requireRoles('finance', 'admin'),
  async (req, res) => {
    try {
      const { codeId } = req.params;
      const { daysThreshold = 30 } = req.body;

      const BudgetCode = require('../models/BudgetCode');
      const budgetCode = await BudgetCode.findById(codeId);
      
      if (!budgetCode) {
        return res.status(404).json({
          success: false,
          message: 'Budget code not found'
        });
      }

      const result = await budgetCode.releaseStaleReservations(daysThreshold);

      res.json({
        success: true,
        message: `Released ${result.releasedCount} stale reservation(s)`,
        data: {
          budgetCode: budgetCode.code,
          releasedCount: result.releasedCount,
          releasedAmount: result.releasedAmount,
          newRemaining: budgetCode.remaining
        }
      });
    } catch (error) {
      console.error('Release stale reservations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to release stale reservations',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/budget-codes/:codeId/release/:requestId
 * @desc    Manually release a specific budget reservation
 * @access  Private (Finance, Admin)
 */
router.post(
  '/:codeId/release/:requestId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  async (req, res) => {
    try {
      const { codeId, requestId } = req.params;
      const { reason = 'Manually released by finance' } = req.body;

      const BudgetCode = require('../models/BudgetCode');
      const budgetCode = await BudgetCode.findById(codeId);
      
      if (!budgetCode) {
        return res.status(404).json({
          success: false,
          message: 'Budget code not found'
        });
      }

      await budgetCode.releaseReservation(requestId, reason);

      res.json({
        success: true,
        message: 'Budget reservation released successfully',
        data: {
          budgetCode: budgetCode.code,
          newRemaining: budgetCode.remaining
        }
      });
    } catch (error) {
      console.error('Release reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to release reservation',
        error: error.message
      });
    }
  }
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

module.exports = router;




