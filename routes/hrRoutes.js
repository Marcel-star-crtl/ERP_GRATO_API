const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');



// Protect all routes - only HR and Admin
router.use(authMiddleware);
router.use(requireRoles('hr', 'admin'));

// Employee Management
router.get('/employees/statistics', hrController.getStatistics);
router.get('/employees/export', hrController.exportEmployees);
router.get('/employees/:id/leave-balance', hrController.getEmployeeLeaveBalance);
router.get('/employees/:id/performance', hrController.getEmployeePerformance);
router.get('/employees', hrController.getEmployees);
router.get('/employees/:id', hrController.getEmployee);
router.post('/employees', hrController.createEmployee);
router.put('/employees/:id', hrController.updateEmployee);
router.patch('/employees/:id/status', hrController.updateEmployeeStatus);
router.delete('/employees/:id', hrController.deactivateEmployee);

// Document Management
router.post(
  '/employees/:id/documents/:type',
  upload.single('document'),
  hrController.uploadDocument
);
router.get('/employees/:id/documents/:type', hrController.downloadDocument);
router.delete('/employees/:id/documents/:docId', hrController.deleteDocument);

// Contract Management
router.get('/contracts/expiring', hrController.getExpiringContracts);
router.post('/contracts/:id/renew', hrController.requestContractRenewal);
router.put('/contracts/:id/approve', requireRoles('admin'), hrController.approveContractRenewal);

module.exports = router;