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
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee'),
    projectController.getProjects
);

router.get('/active', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee'),
    projectController.getActiveProjects
);

router.get('/stats', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor'),
    projectController.getProjectStats
);

router.get('/search', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee'),
    projectController.searchProjects
);

router.get('/my-projects', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee'),
    projectController.getUserProjects
);

router.get('/department/:department', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor'),
    projectController.getProjectsByDepartment
);

router.get('/:projectId', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'finance', 'employee'),
    projectController.getProjectById
);

router.put('/:projectId', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor'),
    projectController.updateProject
);

router.patch('/:projectId/status', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor'),
    projectController.updateProjectStatus
);

router.patch('/:projectId/progress', 
    requireRoles('admin', 'supply_chain', 'manager', 'supervisor', 'employee'),
    projectController.updateProjectProgress
);

router.delete('/:projectId', 
    requireRoles('admin', 'supply_chain', 'manager'),
    projectController.deleteProject
);

module.exports = router;