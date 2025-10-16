// ============================================
// routes/actionItemRoutes.js - COMPLETE REPLACEMENT
// ============================================

const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { handleMulterError, cleanupTempFiles, validateFiles } = require('../middlewares/uploadMiddleware');
const actionItemController = require('../controllers/actionItemController');

// Statistics
router.get(
  '/stats',
  authMiddleware,
  actionItemController.getActionItemStats
);

// Project-specific routes
router.get(
  '/project/:projectId',
  authMiddleware,
  actionItemController.getProjectActionItems
);

// Supervisor approves/rejects TASK CREATION
router.post(
  '/:id/approve-creation',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain'),
  actionItemController.processCreationApproval
);

// Employee submits task for COMPLETION approval (with documents)
router.post(
  '/:id/submit-completion',
  authMiddleware,
  upload.array('documents', 10),
  handleMulterError,
  validateFiles,
  actionItemController.submitForCompletion,
  cleanupTempFiles
);

// Supervisor approves/rejects TASK COMPLETION
router.post(
  '/:id/approve-completion',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain'),
  actionItemController.processCompletionApproval
);

// Progress and status updates
router.patch(
  '/:id/progress',
  authMiddleware,
  actionItemController.updateProgress
);

router.patch(
  '/:id/status',
  authMiddleware,
  actionItemController.updateStatus
);

// CRUD operations
router.get(
  '/',
  authMiddleware,
  actionItemController.getActionItems
);

router.get(
  '/:id',
  authMiddleware,
  actionItemController.getActionItem
);

router.post(
  '/',
  authMiddleware,
  actionItemController.createActionItem
);

router.put(
  '/:id',
  authMiddleware,
  actionItemController.updateActionItem
);

router.delete(
  '/:id',
  authMiddleware,
  actionItemController.deleteActionItem
);

module.exports = router;










// const express = require('express');
// const router = express.Router();
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const actionItemController = require('../controllers/actionItemController');

// // ============================================
// // STATISTICS
// // ============================================

// router.get(
//   '/stats',
//   authMiddleware,
//   actionItemController.getActionItemStats
// );

// // ============================================
// // PROJECT-SPECIFIC ROUTES (before generic routes)
// // ============================================

// router.get(
//   '/project/:projectId',
//   authMiddleware,
//   actionItemController.getProjectActionItems
// );

// // ============================================
// // PROGRESS AND STATUS UPDATES
// // ============================================

// router.patch(
//   '/:id/progress',
//   authMiddleware,
//   actionItemController.updateProgress
// );

// router.patch(
//   '/:id/status',
//   authMiddleware,
//   actionItemController.updateStatus
// );

// // ============================================
// // CRUD OPERATIONS
// // ============================================

// // Get all action items (with filters)
// router.get(
//   '/',
//   authMiddleware,
//   actionItemController.getActionItems
// );

// // Get single action item
// router.get(
//   '/:id',
//   authMiddleware,
//   actionItemController.getActionItem
// );

// // Create action item
// router.post(
//   '/',
//   authMiddleware,
//   actionItemController.createActionItem
// );

// // Update action item
// router.put(
//   '/:id',
//   authMiddleware,
//   actionItemController.updateActionItem
// );

// // Delete action item
// router.delete(
//   '/:id',
//   authMiddleware,
//   actionItemController.deleteActionItem
// );

// module.exports = router;