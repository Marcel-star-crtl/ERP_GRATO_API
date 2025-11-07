const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const {
  // Core functions
  createIncidentReport,
  getIncidentReportDetails,
  
  // Employee functions
  getEmployeeIncidentReports,
  
  // HSE Management functions
  getHSEIncidentReports,
  updateIncidentStatus,
  startInvestigation,
  completeInvestigation,
  addCorrectiveAction,
  addPreventiveAction,
  updateActionStatus,
  resolveIncident,
  addHSEUpdate,
  getHSEDashboardStats,
  
  // Role-based view
  getIncidentReportsByRole
} = require('../controllers/incidentReportController');

// ==========================================
// IMPORTANT: Specific routes MUST come BEFORE parameterized routes (:reportId)
// ==========================================

/**
 * @route   POST /api/incident-reports
 * @desc    Create new incident report
 * @access  Private (All authenticated users)
 */
router.post(
  '/',
  authMiddleware,
  upload.array('attachments', 10),
  createIncidentReport
);

// ==========================================
// ROLE-BASED VIEW ROUTES (Must come BEFORE /:reportId)
// ==========================================

/**
 * @route   GET /api/incident-reports/role/view
 * @desc    Get incidents based on user role
 * @access  Private
 */
router.get(
  '/role/view',
  authMiddleware,
  getIncidentReportsByRole
);

// ==========================================
// EMPLOYEE ROUTES (Must come BEFORE /:reportId)
// ==========================================

/**
 * @route   GET /api/incident-reports/employee/my-reports
 * @desc    Get employee's own incident reports
 * @access  Private (Employee)
 */
router.get(
  '/employee/my-reports',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'hr', 'hse'),
  getEmployeeIncidentReports
);

/**
 * @route   GET /api/incident-reports/employee
 * @desc    Alias for employee's own reports
 * @access  Private (Employee)
 */
router.get(
  '/employee',
  authMiddleware,
  requireRoles('employee', 'supervisor', 'admin', 'hr', 'hse'),
  getEmployeeIncidentReports
);

// ==========================================
// HSE COORDINATOR ROUTES (Must come BEFORE /:reportId)
// ==========================================

/**
 * @route   GET /api/incident-reports/hse/dashboard
 * @desc    Get HSE dashboard statistics
 * @access  Private (HSE, Admin)
 */
router.get(
  '/hse/dashboard',
  authMiddleware,
  requireRoles('hse', 'admin'),
  getHSEDashboardStats
);

/**
 * @route   GET /api/incident-reports/hse/all
 * @desc    Get all incident reports for HSE management
 * @access  Private (HSE, Admin)
 */
router.get(
  '/hse/all',
  authMiddleware,
  requireRoles('hse', 'admin'),
  getHSEIncidentReports
);

/**
 * @route   GET /api/incident-reports/hse
 * @desc    Alias for HSE reports
 * @access  Private (HSE, Admin)
 */
router.get(
  '/hse',
  authMiddleware,
  requireRoles('hse', 'admin'),
  getHSEIncidentReports
);

// ==========================================
// SUPERVISOR/HR/ADMIN ROUTES (Must come BEFORE /:reportId)
// ==========================================

/**
 * @route   GET /api/incident-reports/supervisor/view
 * @desc    View department incidents (supervisor awareness)
 * @access  Private (Supervisor, Admin)
 */
router.get(
  '/supervisor/view',
  authMiddleware,
  requireRoles('supervisor', 'admin'),
  getIncidentReportsByRole
);

/**
 * @route   GET /api/incident-reports/supervisor
 * @desc    Alias for supervisor view
 * @access  Private (Supervisor, Admin)
 */
router.get(
  '/supervisor',
  authMiddleware,
  requireRoles('supervisor', 'admin'),
  getIncidentReportsByRole
);

/**
 * @route   GET /api/incident-reports/hr/view
 * @desc    View all incidents (HR awareness)
 * @access  Private (HR, Admin)
 */
router.get(
  '/hr/view',
  authMiddleware,
  requireRoles('hr', 'admin'),
  getIncidentReportsByRole
);

/**
 * @route   GET /api/incident-reports/hr
 * @desc    Alias for HR view
 * @access  Private (HR, Admin)
 */
router.get(
  '/hr',
  authMiddleware,
  requireRoles('hr', 'admin'),
  getIncidentReportsByRole
);

/**
 * @route   GET /api/incident-reports/admin/all
 * @desc    View all incidents (Admin)
 * @access  Private (Admin only)
 */
router.get(
  '/admin/all',
  authMiddleware,
  requireRoles('admin'),
  getIncidentReportsByRole
);

/**
 * @route   GET /api/incident-reports/admin
 * @desc    Alias for admin view
 * @access  Private (Admin only)
 */
router.get(
  '/admin',
  authMiddleware,
  requireRoles('admin'),
  getIncidentReportsByRole
);

// ==========================================
// PARAMETERIZED ROUTES (Must come AFTER all specific routes)
// ==========================================

/**
 * @route   PATCH /api/incident-reports/:reportId/status
 * @desc    Update incident status
 * @access  Private (HSE, Admin)
 */
router.patch(
  '/:reportId/status',
  authMiddleware,
  requireRoles('hse', 'admin'),
  updateIncidentStatus
);

/**
 * @route   POST /api/incident-reports/:reportId/investigation/start
 * @desc    Start investigation
 * @access  Private (HSE, Admin)
 */
router.post(
  '/:reportId/investigation/start',
  authMiddleware,
  requireRoles('hse', 'admin'),
  startInvestigation
);

/**
 * @route   POST /api/incident-reports/:reportId/investigation/complete
 * @desc    Complete investigation
 * @access  Private (HSE, Admin)
 */
router.post(
  '/:reportId/investigation/complete',
  authMiddleware,
  requireRoles('hse', 'admin'),
  completeInvestigation
);

/**
 * @route   POST /api/incident-reports/:reportId/corrective-action
 * @desc    Add corrective action
 * @access  Private (HSE, Admin)
 */
router.post(
  '/:reportId/corrective-action',
  authMiddleware,
  requireRoles('hse', 'admin'),
  addCorrectiveAction
);

/**
 * @route   POST /api/incident-reports/:reportId/preventive-action
 * @desc    Add preventive action
 * @access  Private (HSE, Admin)
 */
router.post(
  '/:reportId/preventive-action',
  authMiddleware,
  requireRoles('hse', 'admin'),
  addPreventiveAction
);

/**
 * @route   PATCH /api/incident-reports/:reportId/action/:actionId
 * @desc    Update action status (corrective or preventive)
 * @access  Private (HSE, Admin, or assigned person)
 */
router.patch(
  '/:reportId/action/:actionId',
  authMiddleware,
  updateActionStatus
);

/**
 * @route   POST /api/incident-reports/:reportId/resolve
 * @desc    Resolve incident
 * @access  Private (HSE, Admin)
 */
router.post(
  '/:reportId/resolve',
  authMiddleware,
  requireRoles('hse', 'admin'),
  resolveIncident
);

/**
 * @route   POST /api/incident-reports/:reportId/update
 * @desc    Add HSE update/comment
 * @access  Private (HSE, Admin)
 */
router.post(
  '/:reportId/update',
  authMiddleware,
  requireRoles('hse', 'admin'),
  addHSEUpdate
);

/**
 * @route   GET /api/incident-reports/:reportId
 * @desc    Get single incident report details (MUST BE LAST)
 * @access  Private (Report owner, HSE, HR, Admin, Supervisor)
 */
router.get(
  '/:reportId',
  authMiddleware,
  getIncidentReportDetails
);

module.exports = router;











// const express = require('express');
// const router = express.Router();
// const incidentReportController = require('../controllers/incidentReportController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const upload = require('../middlewares/uploadMiddleware');

// // Employee routes
// router.post('/', 
//   authMiddleware, 
//   upload.array('attachments', 5),
//   incidentReportController.createIncidentReport
// );

// router.get('/employee', 
//   authMiddleware, 
//   incidentReportController.getEmployeeIncidentReports
// );

// // Preview approval chain endpoint
// router.post('/preview-approval-chain',
//   authMiddleware,
//   incidentReportController.getApprovalChainPreview
// );

// // Supervisor routes - MOVED UP before /:reportId
// router.get('/supervisor', 
//   authMiddleware, 
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'), 
//   incidentReportController.getSupervisorIncidentReports
// );

// router.get('/supervisor/:reportId', 
//   authMiddleware, 
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'),
//   incidentReportController.getIncidentReportDetails
// );

// // HR routes - MOVED UP before /:reportId
// router.get('/hr', 
//   authMiddleware, 
//   requireRoles('hr', 'admin'),
//   incidentReportController.getHRIncidentReports
// );

// router.get('/hr/:reportId', 
//   authMiddleware, 
//   requireRoles('hr', 'admin'),
//   incidentReportController.getIncidentReportDetails
// );

// // Admin routes - MOVED UP before /:reportId
// router.get('/admin', 
//   authMiddleware, 
//   requireRoles('admin'), 
//   incidentReportController.getAllIncidentReports
// );

// router.get('/admin/:reportId', 
//   authMiddleware, 
//   requireRoles('admin'),
//   incidentReportController.getIncidentReportDetails
// );

// // PUT routes for decision processing
// router.put('/:reportId/supervisor', 
//   authMiddleware, 
//   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr'), 
//   incidentReportController.processSupervisorDecision
// );

// router.put('/:reportId/hr', 
//   authMiddleware, 
//   requireRoles('hr', 'admin'),
//   incidentReportController.processHRDecision
// );

// router.put('/:reportId/investigation', 
//   authMiddleware, 
//   requireRoles('hr', 'admin'),
//   incidentReportController.updateInvestigationStatus
// );

// // Generic parameterized routes 
// router.get('/:reportId', 
//   authMiddleware, 
//   incidentReportController.getIncidentReportDetails
// );

// // Dashboard and analytics routes
// router.get('/dashboard/stats',
//   authMiddleware,
//   incidentReportController.getDashboardStats
// );

// // Statistics and reporting
// router.get('/analytics/statistics',
//   authMiddleware,
//   requireRoles('admin', 'hr'),
//   incidentReportController.getIncidentReportStats
// );

// // Role-based incident reports endpoint
// router.get('/role/reports',
//   authMiddleware,
//   incidentReportController.getIncidentReportsByRole
// );

// // Delete incident report (employee or admin)
// router.delete('/:reportId', 
//   authMiddleware, 
//   incidentReportController.deleteIncidentReport
// );

// module.exports = router;