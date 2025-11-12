const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const pettyCashController = require('../controllers/pettyCashController');

/**
 * @route   GET /api/petty-cash/buyer/forms
 * @desc    Get all petty cash forms for logged-in buyer
 * @access  Private (Buyer only)
 */
router.get(
  '/buyer/forms',
  authMiddleware,
  requireRoles('buyer'),
  pettyCashController.getBuyerPettyCashForms
);

/**
 * @route   GET /api/petty-cash/buyer/stats
 * @desc    Get petty cash statistics for buyer
 * @access  Private (Buyer only)
 */
router.get(
  '/buyer/stats',
  authMiddleware,
  requireRoles('buyer'),
  pettyCashController.getBuyerPettyCashStats
);

/**
 * @route   GET /api/petty-cash/requisition/:requisitionId/details
 * @desc    Get petty cash form details for specific requisition
 * @access  Private (Buyer only)
 */
router.get(
  '/requisition/:requisitionId/details',
  authMiddleware,
  requireRoles('buyer'),
  pettyCashController.getPettyCashFormDetails
);

/**
 * @route   GET /api/petty-cash/requisition/:requisitionId/download
 * @desc    Download petty cash form PDF
 * @access  Private (Buyer only)
 */
router.get(
  '/requisition/:requisitionId/download',
  authMiddleware,
  requireRoles('buyer'),
  pettyCashController.downloadPettyCashFormPDF
);

/**
 * @route   PUT /api/petty-cash/requisition/:requisitionId/complete
 * @desc    Mark petty cash form as completed
 * @access  Private (Buyer only)
 */
router.put(
  '/requisition/:requisitionId/complete',
  authMiddleware,
  requireRoles('buyer'),
  pettyCashController.markPettyCashFormComplete
);

module.exports = router;









// const express = require('express');
// const router = express.Router();
// const pettyCashController = require('../controllers/pettyCashController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const upload = require('../middlewares/uploadMiddleware');

// router.use(authMiddleware);

// router.get('/company', requireRoles('admin'), pettyCashController.getCompanySettings);
// router.put('/company/:companyId',
//   requireRoles('admin'),
//   upload.array('documents', 5), 
//   pettyCashController.updateCompanySettings
// );

// router.post('/transactions', requireRoles('admin', 'finance'), pettyCashController.createTransaction);
// router.get('/transactions', requireRoles('admin', 'finance', 'user'), pettyCashController.getTransactions); // Adjust roles as needed
// router.get('/transactions/:id', requireRoles('admin', 'finance', 'user'), pettyCashController.getTransaction);
// router.put('/transactions/:id', requireRoles('admin', 'finance'), pettyCashController.updateTransaction);
// router.delete('/transactions/:id', requireRoles('admin', 'finance'), pettyCashController.deleteTransaction);

// router.get('/position', requireRoles('admin', 'finance'), pettyCashController.getCurrentPosition);
// router.get('/dashboard', requireRoles('admin', 'finance'), pettyCashController.getDashboardStats);

// module.exports = router;