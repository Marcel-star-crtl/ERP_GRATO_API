const express = require('express');
const router = express.Router();
const projectPlanController = require('../controllers/projectPlanController');
const { requireRoles, authMiddleware } = require('../middlewares/authMiddleware');

// ========================================
// Employee Routes
// ========================================
router.get('/my-plans', authMiddleware, projectPlanController.getMyProjectPlans);
router.get('/stats', authMiddleware, projectPlanController.getStatistics);
router.post('/', authMiddleware, projectPlanController.createProjectPlan);
router.put('/:id', authMiddleware, projectPlanController.updateProjectPlan);
router.delete('/:id', authMiddleware, projectPlanController.deleteProjectPlan);
router.get('/:id', authMiddleware, projectPlanController.getProjectPlanById);

// Submit for approval
router.post('/:id/submit', authMiddleware, projectPlanController.submitProjectPlan);

// ========================================
// Approver Routes (Project Coordinator & Head of Business)
// ========================================
router.get(
  '/pending-approvals', 
  authMiddleware,
  requireRoles('admin', 'project', 'supply_chain'), // Christabel (buyer role) and Kelvin
  projectPlanController.getMyPendingApprovals
);

router.get(
  '/all', 
  authMiddleware, 
  requireRoles('admin', 'project', 'supply_chain'), // Christabel and Kelvin can view all
  projectPlanController.getAllProjectPlans
);

router.post(
  '/:id/approve', 
  authMiddleware, 
  requireRoles('admin', 'project', 'supply_chain'), // Christabel and Kelvin can approve
  projectPlanController.approveProjectPlan
);

router.post(
  '/:id/reject', 
  authMiddleware, 
  requireRoles('admin', 'project', 'supply_chain'), // Christabel and Kelvin can reject
  projectPlanController.rejectProjectPlan
);

module.exports = router;









// const express = require('express');
// const router = express.Router();
// const projectPlanController = require('../controllers/projectPlanController');
// const { requireRoles, authMiddleware } = require('../middlewares/authMiddleware');

// // Employee routes
// router.get('/my-plans', requireRoles, projectPlanController.getMyProjectPlans);
// router.get('/stats', requireRoles, projectPlanController.getStatistics);
// router.post('/', requireRoles, projectPlanController.createProjectPlan);
// router.put('/:id', requireRoles, projectPlanController.updateProjectPlan);
// router.delete('/:id', requireRoles, projectPlanController.deleteProjectPlan);

// // Supervisor/Admin routes
// router.get(
//   '/all', 
//   authMiddleware, 
//   requireRoles('supervisor', 'admin', 'hr', 'finance', 'supply_chain'), 
//   projectPlanController.getAllProjectPlans
// );
// router.post(
//   '/:id/approve', 
//   authMiddleware, 
//   requireRoles('supervisor', 'admin'), 
//   projectPlanController.approveProjectPlan
// );
// router.post(
//   '/:id/reject', 
//   authMiddleware, 
//   requireRoles('supervisor', 'admin'), 
//   projectPlanController.rejectProjectPlan
// );

// module.exports = router;