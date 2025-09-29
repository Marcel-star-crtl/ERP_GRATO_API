const express = require('express');
const router = express.Router();
const budgetCodeController = require('../controllers/budgetCodeController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Budget Code CRUD Operations
router.post('/', 
  requireRoles('finance', 'admin'),
  budgetCodeController.createBudgetCode
);

router.get('/', 
  requireRoles('finance', 'admin', 'supply_chain'),
  budgetCodeController.getBudgetCodes
);

router.get('/available', 
  requireRoles('finance', 'admin', 'supply_chain', 'manager', 'supervisor'),
  budgetCodeController.getAvailableBudgetCodes
);

router.get('/requiring-attention', 
  requireRoles('finance', 'admin'),
  budgetCodeController.getBudgetCodesRequiringAttention
);

router.get('/allocation-report', 
  requireRoles('finance', 'admin'),
  budgetCodeController.getBudgetAllocationReport
);

router.get('/:codeId', 
  requireRoles('finance', 'admin', 'supply_chain'),
  budgetCodeController.getBudgetCode
);

router.put('/:codeId', 
  requireRoles('finance', 'admin'),
  budgetCodeController.updateBudgetCode
);

router.delete('/:codeId', 
  requireRoles('finance', 'admin'),
  budgetCodeController.deleteBudgetCode
);

router.get('/:codeId/utilization', 
  requireRoles('finance', 'admin'),
  budgetCodeController.getBudgetCodeUtilization
);

router.post('/:codeId/allocate', 
  requireRoles('finance', 'admin'),
  budgetCodeController.allocateBudgetToRequisition
);

module.exports = router;