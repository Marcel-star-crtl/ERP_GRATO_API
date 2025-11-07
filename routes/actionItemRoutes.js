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

// NEW: Milestone-specific routes
router.get(
  '/milestone/:milestoneId',
  authMiddleware,
  actionItemController.getMilestoneTasks
);

router.post(
  '/milestone/task',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain', 'manager'),
  actionItemController.createTaskUnderMilestone
);

// NEW: Personal task creation
router.post(
  '/personal',
  authMiddleware,
  actionItemController.createPersonalTask
);

// Supervisor approves/rejects TASK COMPLETION
router.post(
  '/:id/approve-completion',
  authMiddleware,
  actionItemController.processCompletionApproval
);

// NEW: Submit completion for specific assignee
router.post(
  '/:id/assignee/submit-completion',
  authMiddleware,
  upload.array('documents', 10),
  handleMulterError,
  validateFiles,
  actionItemController.submitCompletionForAssignee,
  cleanupTempFiles
);

// NEW: Approve/reject completion for specific assignee
router.post(
  '/:id/assignee/:assigneeId/approve-completion',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain', 'manager'),
  actionItemController.approveCompletionForAssignee
);

router.post(
  '/:id/assignee/:assigneeId/reject-completion',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain', 'manager'),
  actionItemController.rejectCompletionForAssignee
);


// NEW: Reassign task
router.post(
  '/:id/reassign',
  authMiddleware,
  requireRoles('supervisor', 'admin', 'supply_chain', 'manager'),
  actionItemController.reassignTask
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
// const upload = require('../middlewares/uploadMiddleware');
// const { handleMulterError, cleanupTempFiles, validateFiles } = require('../middlewares/uploadMiddleware');
// const actionItemController = require('../controllers/actionItemController');

// // Statistics
// router.get(
//   '/stats',
//   authMiddleware,
//   actionItemController.getActionItemStats
// );

// // Project-specific routes
// router.get(
//   '/project/:projectId',
//   authMiddleware,
//   actionItemController.getProjectActionItems
// );

// // Supervisor approves/rejects TASK CREATION
// router.post(
//   '/:id/approve-creation',
//   authMiddleware,
//   requireRoles('supervisor', 'admin', 'supply_chain', 'finance', 'it', 'hr' ),
//   actionItemController.processCreationApproval
// );

// // Employee submits task for COMPLETION approval (with documents)
// router.post(
//   '/:id/submit-completion',
//   authMiddleware,
//   upload.array('documents', 10),
//   handleMulterError,
//   validateFiles,
//   actionItemController.submitForCompletion,
//   cleanupTempFiles
// );

// // Supervisor approves/rejects TASK COMPLETION
// router.post(
//   '/:id/approve-completion',
//   authMiddleware,
//   requireRoles('supervisor', 'admin', 'supply_chain'),
//   actionItemController.processCompletionApproval
// );

// // Progress and status updates
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

// // CRUD operations
// router.get(
//   '/',
//   authMiddleware,
//   actionItemController.getActionItems
// );

// router.get(
//   '/:id',
//   authMiddleware,
//   actionItemController.getActionItem
// );

// router.post(
//   '/',
//   authMiddleware,
//   actionItemController.createActionItem
// );

// router.put(
//   '/:id',
//   authMiddleware,
//   actionItemController.updateActionItem
// );

// router.delete(
//   '/:id',
//   authMiddleware,
//   actionItemController.deleteActionItem
// );

// module.exports = router;



