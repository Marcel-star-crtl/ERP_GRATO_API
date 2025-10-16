const express = require('express');
const router = express.Router();
const incidentReportController = require('../controllers/incidentReportController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Employee routes
router.post('/', 
  authMiddleware, 
  upload.array('attachments', 5),
  incidentReportController.createIncidentReport
);

router.get('/employee', 
  authMiddleware, 
  incidentReportController.getEmployeeIncidentReports
);

// Preview approval chain endpoint
router.post('/preview-approval-chain',
  authMiddleware,
  incidentReportController.getApprovalChainPreview
);

// Supervisor routes - MOVED UP before /:reportId
router.get('/supervisor', 
  authMiddleware, 
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'), 
  incidentReportController.getSupervisorIncidentReports
);

router.get('/supervisor/:reportId', 
  authMiddleware, 
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
  incidentReportController.getIncidentReportDetails
);

// HR routes - MOVED UP before /:reportId
router.get('/hr', 
  authMiddleware, 
  requireRoles('hr', 'admin'),
  incidentReportController.getHRIncidentReports
);

router.get('/hr/:reportId', 
  authMiddleware, 
  requireRoles('hr', 'admin'),
  incidentReportController.getIncidentReportDetails
);

// Admin routes - MOVED UP before /:reportId
router.get('/admin', 
  authMiddleware, 
  requireRoles('admin'), 
  incidentReportController.getAllIncidentReports
);

router.get('/admin/:reportId', 
  authMiddleware, 
  requireRoles('admin'),
  incidentReportController.getIncidentReportDetails
);

// PUT routes for decision processing
router.put('/:reportId/supervisor', 
  authMiddleware, 
  requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'), 
  incidentReportController.processSupervisorDecision
);

router.put('/:reportId/hr', 
  authMiddleware, 
  requireRoles('hr', 'admin'),
  incidentReportController.processHRDecision
);

router.put('/:reportId/investigation', 
  authMiddleware, 
  requireRoles('hr', 'admin'),
  incidentReportController.updateInvestigationStatus
);

// Generic parameterized routes 
router.get('/:reportId', 
  authMiddleware, 
  incidentReportController.getIncidentReportDetails
);

// Dashboard and analytics routes
router.get('/dashboard/stats',
  authMiddleware,
  incidentReportController.getDashboardStats
);

// Statistics and reporting
router.get('/analytics/statistics',
  authMiddleware,
  requireRoles('admin', 'hr'),
  incidentReportController.getIncidentReportStats
);

// Role-based incident reports endpoint
router.get('/role/reports',
  authMiddleware,
  incidentReportController.getIncidentReportsByRole
);

// Delete incident report (employee or admin)
router.delete('/:reportId', 
  authMiddleware, 
  incidentReportController.deleteIncidentReport
);

module.exports = router;