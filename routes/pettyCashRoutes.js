const express = require('express');
const router = express.Router();
const pettyCashController = require('../controllers/pettyCashController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(authMiddleware);

router.get('/company', requireRoles('admin'), pettyCashController.getCompanySettings);
router.put('/company/:companyId',
  requireRoles('admin'),
  upload.array('documents', 5), 
  pettyCashController.updateCompanySettings
);

router.post('/transactions', requireRoles('admin', 'finance'), pettyCashController.createTransaction);
router.get('/transactions', requireRoles('admin', 'finance', 'user'), pettyCashController.getTransactions); // Adjust roles as needed
router.get('/transactions/:id', requireRoles('admin', 'finance', 'user'), pettyCashController.getTransaction);
router.put('/transactions/:id', requireRoles('admin', 'finance'), pettyCashController.updateTransaction);
router.delete('/transactions/:id', requireRoles('admin', 'finance'), pettyCashController.deleteTransaction);

router.get('/position', requireRoles('admin', 'finance'), pettyCashController.getCurrentPosition);
router.get('/dashboard', requireRoles('admin', 'finance'), pettyCashController.getDashboardStats);

module.exports = router;