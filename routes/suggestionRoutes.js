const express = require('express');
const router = express.Router();
const suggestionController = require('../controllers/suggestionController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.post('/', 
  authMiddleware, 
  upload.array('attachments', 5),
  suggestionController.createSuggestion
);

router.get('/role', 
  authMiddleware,
  suggestionController.getSuggestionsByRole
);

// Community voting routes
router.post('/:suggestionId/vote', 
  authMiddleware,
  suggestionController.voteSuggestion
);

router.delete('/:suggestionId/vote', 
  authMiddleware,
  suggestionController.removeVote
);

// Comment routes
router.post('/:suggestionId/comments', 
  authMiddleware,
  suggestionController.addComment
);

router.get('/:suggestionId/comments', 
  authMiddleware,
  suggestionController.getComments
);

// HR routes - HR specific management
router.put('/hr/:suggestionId/review', 
  authMiddleware, 
  requireRoles('hr', 'admin'), 
  suggestionController.processHRReview
);

router.put('/hr/:suggestionId/status', 
  authMiddleware, 
  requireRoles('hr', 'admin'), 
  suggestionController.updateSuggestionStatus
);

router.put('/management/:suggestionId/implementation', 
  authMiddleware, 
  requireRoles('admin'), 
  suggestionController.updateImplementationStatus
);

// Admin routes - Full system access
router.get('/admin', 
  authMiddleware, 
  requireRoles('admin'), 
  suggestionController.getAllSuggestions
);

// Analytics and reporting routes
router.get('/analytics/dashboard', 
  authMiddleware,
  suggestionController.getDashboardStats
);

module.exports = router;


