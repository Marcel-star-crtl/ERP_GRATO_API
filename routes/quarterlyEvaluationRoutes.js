const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const quarterlyEvaluationController = require('../controllers/quarterlyEvaluationController');

// Get statistics
router.get(
  '/statistics',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain'),
  quarterlyEvaluationController.getEvaluationStatistics
);

// Get employee's evaluations
router.get(
  '/my-evaluations',
  authMiddleware,
  quarterlyEvaluationController.getEmployeeEvaluations
);

// Get evaluations (supervisors/admins)
router.get(
  '/',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain'),
  quarterlyEvaluationController.getEvaluations
);

// Get single evaluation
router.get(
  '/:id',
  authMiddleware,
  quarterlyEvaluationController.getEvaluationById
);

// Generate quarterly evaluation
router.post(
  '/generate',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain'),
  quarterlyEvaluationController.generateQuarterlyEvaluation
);

// Submit evaluation
router.post(
  '/:id/submit',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain'),
  quarterlyEvaluationController.submitEvaluation
);

// Approve evaluation (admin only)
router.post(
  '/:id/approve',
  authMiddleware,
  requireRoles('admin', 'supply_chain'),
  quarterlyEvaluationController.approveEvaluation
);

// Employee acknowledges evaluation
router.post(
  '/:id/acknowledge',
  authMiddleware,
  quarterlyEvaluationController.acknowledgeEvaluation
);

module.exports = router;