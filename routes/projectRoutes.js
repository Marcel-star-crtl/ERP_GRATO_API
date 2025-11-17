const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Project CRUD Operations
router.post('/', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.createProject
);

router.get('/', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getProjects
);

router.get('/active', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getActiveProjects
);

router.get('/stats', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getProjectStats
);

// Supervisor milestone routes
router.get('/my-milestones',
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getSupervisorMilestones
);

router.get('/:projectId/milestones/:milestoneId',
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getMilestoneDetails
);

router.post('/:projectId/milestones/:milestoneId/complete',
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.completeMilestone
);

router.get('/search', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.searchProjects
);

router.get('/my-projects', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getUserProjects
);

router.get('/department/:department', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getProjectsByDepartment
);

router.get('/:projectId', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.getProjectById
);

router.put('/:projectId', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.updateProject
);

router.patch('/:projectId/status', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.updateProjectStatus
);

router.patch('/:projectId/progress', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.updateProjectProgress
);

router.delete('/:projectId', 
    requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
    projectController.deleteProject
);

// Analytics
router.get('/:projectId/analytics', 
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  projectController.getProjectAnalytics
);

// Risk Management
router.post('/:projectId/risks',
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  projectController.addProjectRisk
);

router.patch('/:projectId/risks/:riskId/status',
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  projectController.updateRiskStatus
);

// Issue Management
router.post('/:projectId/issues',
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  projectController.addProjectIssue
);

router.patch('/:projectId/issues/:issueId/resolve',
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  projectController.resolveIssue
);

// Change Management
router.post('/:projectId/change-requests',
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  projectController.addChangeRequest
);

router.post('/:projectId/change-requests/:changeRequestId/process',
  requireRoles('admin', 'supply_chain', 'project'),
  projectController.processChangeRequest
);

// Meeting Management
router.post('/:projectId/meetings',
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  projectController.logProjectMeeting
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



