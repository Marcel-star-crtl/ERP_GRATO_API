const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const quarterlyKPIController = require('../controllers/quarterlyKPIController');

// Get default criteria
router.get(
  '/approved-for-linking',
  authMiddleware,
  quarterlyKPIController.getApprovedKPIsForTaskLinking
);

// Get pending approvals (supervisors)
router.get(
  '/pending-approvals',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain', 'hr', 'hse'),
  quarterlyKPIController.getPendingKPIApprovals
);

// Get employee KPIs
router.get(
  '/my-kpis',
  authMiddleware,
  quarterlyKPIController.getEmployeeKPIs
);

// Get single KPI
router.get(
  '/:id',
  authMiddleware,
  quarterlyKPIController.getKPIById
);

// Create or update KPIs
router.post(
  '/',
  authMiddleware,
  quarterlyKPIController.createOrUpdateKPIs
);

// Submit for approval
router.post(
  '/:id/submit',
  authMiddleware,
  quarterlyKPIController.submitKPIsForApproval
);

// Approve/reject KPIs
router.post(
  '/:id/approve',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain', 'hr', 'it', 'hse'),
  quarterlyKPIController.processKPIApproval
);

// Delete KPIs
router.delete(
  '/:id',
  authMiddleware,
  quarterlyKPIController.deleteKPIs
);

module.exports = router;