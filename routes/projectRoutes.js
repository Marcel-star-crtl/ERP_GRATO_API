const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const subMilestoneController = require('../controllers/subMilestoneController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Project CRUD Operations
router.post('/', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.createProject
);

// Get my projects (including drafts)
router.get(
  '/my-projects',
  authMiddleware,
  projectController.getMyProjects
);

// Get pending approvals (for authorized roles only)
router.get(
  '/pending-approvals',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'project', 'manager'),
  projectController.getPendingApprovals
);

// Create or save project (can be draft)
router.post(
  '/',
  authMiddleware,
  projectController.createOrSaveProject
);

// Submit project for approval
router.post(
  '/:projectId/submit',
  authMiddleware,
  projectController.submitProjectForApproval
);

// Approve/Reject project
router.post(
  '/:projectId/approve',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'project', 'manager'),
  projectController.processProjectApproval
);

// Update project (only draft or rejected)
router.put(
  '/:projectId',
  authMiddleware,
  projectController.updateProject
);


// Get active projects only
router.get(
  '/active',
  authMiddleware,
  projectController.getActiveProjects
);

// Get all projects (with filters)
router.get(
  '/',
  authMiddleware,
  projectController.getProjects
);

router.get('/stats', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getProjectStats
);

// ========== MILESTONE MANAGEMENT (SUPERVISORS) ==========

// Get supervisor's assigned milestones
router.get(
  '/my-milestones',
  authMiddleware,
  projectController.getSupervisorMilestones
);

// Get milestone details with tasks
router.get(
  '/:projectId/milestones/:milestoneId',
  authMiddleware,
  projectController.getMilestoneDetails
);

// ========== SUB-MILESTONE MANAGEMENT ==========

// Get milestone hierarchy (with all sub-milestones)
router.get(
  '/:projectId/milestones/:milestoneId/hierarchy',
  authMiddleware,
  subMilestoneController.getMilestoneHierarchy
);

// Create sub-milestone under milestone or another sub-milestone
router.post(
  '/:projectId/milestones/:milestoneId/sub-milestones',
  authMiddleware,
  subMilestoneController.createSubMilestone
);

// Update sub-milestone
router.put(
  '/:projectId/milestones/:milestoneId/sub-milestones/:subMilestoneId',
  authMiddleware,
  subMilestoneController.updateSubMilestone
);

// Delete sub-milestone
router.delete(
  '/:projectId/milestones/:milestoneId/sub-milestones/:subMilestoneId',
  authMiddleware,
  subMilestoneController.deleteSubMilestone
);

// Update sub-milestone progress (recalculate from tasks)
router.patch(
  '/:projectId/milestones/:milestoneId/sub-milestones/:subMilestoneId/progress',
  authMiddleware,
  subMilestoneController.updateSubMilestoneProgress
);

// Complete sub-milestone
router.post(
  '/:projectId/milestones/:milestoneId/sub-milestones/:subMilestoneId/complete',
  authMiddleware,
  subMilestoneController.completeSubMilestone
);

// Complete milestone
router.post(
  '/:projectId/milestones/:milestoneId/complete',
  authMiddleware,
  projectController.completeMilestone
);

router.get(
  '/search',
  authMiddleware,
  projectController.searchProjects
);

router.get('/my-projects', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getUserProjects
);

router.get(
  '/department/:department',
  authMiddleware,
  projectController.getProjectsByDepartment
);

// Get project by ID
router.get(
  '/:projectId',
  authMiddleware,
  projectController.getProjectById
);

// router.put('/:projectId', 
//     requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//     projectController.updateProject
// );

router.patch('/:projectId/status', 
    authMiddleware,
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.updateProjectStatus
);

router.patch(
  '/:projectId/progress',
  authMiddleware,
  projectController.updateProjectProgress
);

router.delete(
  '/:projectId',
  authMiddleware,
  projectController.deleteProject
);

// router.delete('/:projectId', 
//     requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//     projectController.deleteProject
// );

// Get project analytics
router.get(
  '/:projectId/analytics',
  authMiddleware,
  projectController.getProjectAnalytics
);

// Add risk to project
router.post(
  '/:projectId/risks',
  authMiddleware,
  projectController.addProjectRisk
);

// Update risk status
router.patch(
  '/:projectId/risks/:riskId/status',
  authMiddleware,
  projectController.updateRiskStatus
);

// Add issue to project
router.post(
  '/:projectId/issues',
  authMiddleware,
  projectController.addProjectIssue
);

router.patch(
  '/:projectId/issues/:issueId/resolve',
  authMiddleware,
  projectController.resolveIssue
);

router.post(
  '/:projectId/change-requests',
  authMiddleware,
  projectController.addChangeRequest
);

// Process change request
router.post(
  '/:projectId/change-requests/:changeRequestId/process',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'project', 'manager'),
  projectController.processChangeRequest
);

// Log meeting
router.post(
  '/:projectId/meetings',
  authMiddleware,
  projectController.logProjectMeeting
);

router.get(
  '/stats',
  authMiddleware,
  projectController.getProjectStats
);

router.get('/dashboard-stats', 
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  projectController.getDashboardStats
);

router.get(
  '/milestones/:milestoneId/details',
  authMiddleware,
  async (req, res) => {
    try {
      const { milestoneId } = req.params;
      
      const project = await Project.findOne({ 'milestones._id': milestoneId })
        .select('name code milestones');
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Milestone not found'
        });
      }

      const milestone = project.milestones.id(milestoneId);
      
      // Get tasks for this milestone
      const ActionItem = require('../models/ActionItem');
      const tasks = await ActionItem.find({ milestoneId: milestoneId })
        .select('taskWeight status');

      const stats = {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'Completed').length,
        totalWeightAssigned: tasks.reduce((sum, t) => sum + t.taskWeight, 0),
        weightRemaining: 100 - tasks.reduce((sum, t) => sum + t.taskWeight, 0)
      };

      res.json({
        success: true,
        data: {
          project: {
            _id: project._id,
            name: project.name,
            code: project.code
          },
          milestone: {
            _id: milestone._id,
            title: milestone.title,
            description: milestone.description,
            weight: milestone.weight,
            progress: milestone.progress,
            status: milestone.status
          },
          stats
        }
      });

    } catch (error) {
      console.error('Error fetching milestone details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch milestone details',
        error: error.message
      });
    }
  }
);

module.exports = router;



