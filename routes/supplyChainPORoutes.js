// routes/supplyChainPORoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const supplyChainPOController = require('../controllers/supplyChainPOController');

// All routes require supply_chain role
router.use(authMiddleware);
router.use(requireRoles('supply_chain', 'admin'));

// Get pending POs
router.get('/pending', supplyChainPOController.getSupplyChainPendingPOs);

// Get dashboard stats
router.get('/stats', supplyChainPOController.getSupplyChainPOStats);

// Download PO for signing
router.get('/:poId/download-for-signing', supplyChainPOController.downloadPOForSigning);

// Assign PO with signed document
router.post(
  '/:poId/assign-department',
  upload.fields([{ name: 'signedDocument', maxCount: 1 }]),
  supplyChainPOController.assignPOToDepartment
);

// Reject PO
router.post('/:poId/reject', supplyChainPOController.rejectPO);

module.exports = router;