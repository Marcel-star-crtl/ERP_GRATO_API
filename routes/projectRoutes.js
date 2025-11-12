const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Project CRUD Operations
router.post('/', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor'),
    projectController.createProject
);

router.get('/', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.getProjects
);

router.get('/active', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.getActiveProjects
);

router.get('/stats', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor'),
    projectController.getProjectStats
);

// Supervisor milestone routes
router.get('/my-milestones',
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.getSupervisorMilestones
);

router.get('/:projectId/milestones/:milestoneId',
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.getMilestoneDetails
);

router.post('/:projectId/milestones/:milestoneId/complete',
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.completeMilestone
);

router.get('/search', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.searchProjects
);

router.get('/my-projects', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.getUserProjects
);

router.get('/department/:department', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.getProjectsByDepartment
);

router.get('/:projectId', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.getProjectById
);

router.put('/:projectId', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.updateProject
);

router.patch('/:projectId/status', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.updateProjectStatus
);

router.patch('/:projectId/progress', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical', 'finance'),
    projectController.updateProjectProgress
);

router.delete('/:projectId', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee', 'it', 'hr', 'buyer', 'hse', 'technical'),
    projectController.deleteProject
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



