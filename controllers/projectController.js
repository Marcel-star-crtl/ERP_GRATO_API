const Project = require('../models/Project');
const User = require('../models/User');
const BudgetCode = require('../models/BudgetCode');
const mongoose = require('mongoose');

// Create new project
const createProject = async (req, res) => {
    try {
        const {
            name,
            description,
            projectType,
            priority,
            department,
            projectManager,
            timeline,
            budgetCodeId,
            milestones = []
        } = req.body;

        // Validate required fields
        if (!name || !description || !projectType || !priority || !department || !projectManager || !timeline) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }

        // Validate timeline
        if (!timeline.startDate || !timeline.endDate) {
            return res.status(400).json({
                success: false,
                message: 'Both start date and end date are required'
            });
        }

        // Validate project manager exists
        let manager;
        let actualManagerId;

        if (typeof projectManager === 'string' && projectManager.startsWith('emp_')) {
            const emailMatch = projectManager.match(/emp_\d+_(.+)/);
            if (emailMatch && emailMatch[1]) {
                const email = emailMatch[1];
                manager = await User.findOne({ email: email.toLowerCase(), isActive: true });
                if (manager) {
                    actualManagerId = manager._id;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: `Project manager "${email}" is not registered in the system.`,
                        suggestions: [
                            'Contact your system administrator to add this user',
                            'Choose a different project manager from registered users'
                        ]
                    });
                }
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid project manager ID format'
                });
            }
        } else {
            try {
                manager = await User.findById(projectManager);
                actualManagerId = projectManager;
            } catch (error) {
                manager = await User.findOne({ email: projectManager.toLowerCase(), isActive: true });
                if (manager) {
                    actualManagerId = manager._id;
                }
            }
        }

        if (!manager) {
            return res.status(400).json({
                success: false,
                message: 'Selected project manager does not exist'
            });
        }

        // Validate budget code if provided
        if (budgetCodeId) {
            const budgetCode = await BudgetCode.findById(budgetCodeId);
            if (!budgetCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected budget code does not exist'
                });
            }
        }

        // Check for duplicate project name
        const existingProject = await Project.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            isActive: true 
        });

        if (existingProject) {
            return res.status(400).json({
                success: false,
                message: 'A project with this name already exists'
            });
        }

        // Process milestones and sub-milestones
        const processedMilestones = milestones.map(milestone => ({
            title: milestone.title,
            description: milestone.description || '',
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
            status: 'Pending',
            progress: 0,
            weight: milestone.weight || 20,
            subMilestones: (milestone.subMilestones || []).map(sub => ({
                title: sub.title,
                description: sub.description || '',
                dueDate: sub.dueDate ? new Date(sub.dueDate) : null,
                status: 'Pending',
                progress: 0,
                weight: sub.weight || 10,
                assignedTo: sub.assignedTo || null,
                notes: sub.notes || ''
            }))
        }));

        // Create the project
        const project = new Project({
            name,
            description,
            projectType,
            priority,
            department,
            projectManager: actualManagerId,
            timeline: {
                startDate: new Date(timeline.startDate),
                endDate: new Date(timeline.endDate)
            },
            budgetCodeId: budgetCodeId || null,
            milestones: processedMilestones,
            createdBy: req.user.userId
        });

        await project.save();

        // Populate the created project for response
        const populatedProject = await Project.findById(project._id)
            .populate('projectManager', 'fullName email role department')
            .populate('budgetCodeId', 'code name totalBudget available')
            .populate('createdBy', 'fullName email')
            .populate('milestones.subMilestones.assignedTo', 'fullName email');

        res.status(201).json({
            success: true,
            message: 'Project created successfully',
            data: populatedProject
        });

    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create project',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update sub-milestone progress
const updateSubMilestoneProgress = async (req, res) => {
    try {
        const { projectId, milestoneId, subMilestoneId } = req.params;
        const { progress, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        if (progress < 0 || progress > 100) {
            return res.status(400).json({
                success: false,
                message: 'Progress must be between 0 and 100'
            });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const milestone = project.milestones.id(milestoneId);
        if (!milestone) {
            return res.status(404).json({
                success: false,
                message: 'Milestone not found'
            });
        }

        const subMilestone = milestone.subMilestones.id(subMilestoneId);
        if (!subMilestone) {
            return res.status(404).json({
                success: false,
                message: 'Sub-milestone not found'
            });
        }

        subMilestone.progress = progress;
        if (notes) subMilestone.notes = notes;
        
        if (progress === 100 && !subMilestone.completedDate) {
            subMilestone.completedDate = new Date();
        }

        project.updatedBy = req.user.userId;
        await project.save();

        const updatedProject = await Project.findById(projectId)
            .populate('projectManager', 'fullName email role department')
            .populate('milestones.subMilestones.assignedTo', 'fullName email');

        res.status(200).json({
            success: true,
            message: 'Sub-milestone progress updated successfully',
            data: updatedProject
        });

    } catch (error) {
        console.error('Error updating sub-milestone progress:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update sub-milestone progress',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Add sub-milestone to existing milestone
const addSubMilestone = async (req, res) => {
    try {
        const { projectId, milestoneId } = req.params;
        const { title, description, dueDate, weight, assignedTo, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Sub-milestone title is required'
            });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const milestone = project.milestones.id(milestoneId);
        if (!milestone) {
            return res.status(404).json({
                success: false,
                message: 'Milestone not found'
            });
        }

        milestone.subMilestones.push({
            title,
            description: description || '',
            dueDate: dueDate ? new Date(dueDate) : null,
            status: 'Pending',
            progress: 0,
            weight: weight || 10,
            assignedTo: assignedTo || null,
            notes: notes || ''
        });

        project.updatedBy = req.user.userId;
        await project.save();

        const updatedProject = await Project.findById(projectId)
            .populate('projectManager', 'fullName email role department')
            .populate('milestones.subMilestones.assignedTo', 'fullName email');

        res.status(200).json({
            success: true,
            message: 'Sub-milestone added successfully',
            data: updatedProject
        });

    } catch (error) {
        console.error('Error adding sub-milestone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add sub-milestone',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update sub-milestone
const updateSubMilestone = async (req, res) => {
    try {
        const { projectId, milestoneId, subMilestoneId } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const milestone = project.milestones.id(milestoneId);
        if (!milestone) {
            return res.status(404).json({
                success: false,
                message: 'Milestone not found'
            });
        }

        const subMilestone = milestone.subMilestones.id(subMilestoneId);
        if (!subMilestone) {
            return res.status(404).json({
                success: false,
                message: 'Sub-milestone not found'
            });
        }

        // Update fields
        if (updateData.title) subMilestone.title = updateData.title;
        if (updateData.description !== undefined) subMilestone.description = updateData.description;
        if (updateData.dueDate) subMilestone.dueDate = new Date(updateData.dueDate);
        if (updateData.weight !== undefined) subMilestone.weight = updateData.weight;
        if (updateData.assignedTo !== undefined) subMilestone.assignedTo = updateData.assignedTo;
        if (updateData.notes !== undefined) subMilestone.notes = updateData.notes;
        if (updateData.progress !== undefined) {
            subMilestone.progress = updateData.progress;
            if (updateData.progress === 100 && !subMilestone.completedDate) {
                subMilestone.completedDate = new Date();
            }
        }

        project.updatedBy = req.user.userId;
        await project.save();

        const updatedProject = await Project.findById(projectId)
            .populate('projectManager', 'fullName email role department')
            .populate('milestones.subMilestones.assignedTo', 'fullName email');

        res.status(200).json({
            success: true,
            message: 'Sub-milestone updated successfully',
            data: updatedProject
        });

    } catch (error) {
        console.error('Error updating sub-milestone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update sub-milestone',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Delete sub-milestone
const deleteSubMilestone = async (req, res) => {
    try {
        const { projectId, milestoneId, subMilestoneId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const milestone = project.milestones.id(milestoneId);
        if (!milestone) {
            return res.status(404).json({
                success: false,
                message: 'Milestone not found'
            });
        }

        const subMilestone = milestone.subMilestones.id(subMilestoneId);
        if (!subMilestone) {
            return res.status(404).json({
                success: false,
                message: 'Sub-milestone not found'
            });
        }

        subMilestone.remove();
        project.updatedBy = req.user.userId;
        await project.save();

        const updatedProject = await Project.findById(projectId)
            .populate('projectManager', 'fullName email role department')
            .populate('milestones.subMilestones.assignedTo', 'fullName email');

        res.status(200).json({
            success: true,
            message: 'Sub-milestone deleted successfully',
            data: updatedProject
        });

    } catch (error) {
        console.error('Error deleting sub-milestone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete sub-milestone',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get all projects with filtering
const getProjects = async (req, res) => {
    try {
        const {
            status,
            department,
            priority,
            projectType,
            projectManager,
            page = 1,
            limit = 10,
            sort = 'createdAt',
            order = 'desc'
        } = req.query;

        const filter = { isActive: true };

        if (status) filter.status = status;
        if (department) filter.department = department;
        if (priority) filter.priority = priority;
        if (projectType) filter.projectType = projectType;
        if (projectManager) filter.projectManager = projectManager;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortObj = {};
        sortObj[sort] = order === 'desc' ? -1 : 1;

        const projects = await Project.find(filter)
            .populate('projectManager', 'fullName email role department')
            .populate('budgetCodeId', 'code name totalBudget used available')
            .populate('createdBy', 'fullName email')
            .populate('milestones.subMilestones.assignedTo', 'fullName email')
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Project.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: {
                projects,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalProjects: total,
                    hasNextPage: skip + parseInt(limit) < total,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch projects',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get active projects only
const getActiveProjects = async (req, res) => {
    try {
        const projects = await Project.find({
            status: { $in: ['Planning', 'Approved', 'In Progress'] },
            isActive: true
        })
        .populate('projectManager', 'fullName email role department')
        .populate('budgetCodeId', 'code name')
        .populate('milestones.subMilestones.assignedTo', 'fullName email')
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: projects
        });

    } catch (error) {
        console.error('Error fetching active projects:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active projects',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get project by ID
const getProjectById = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        const project = await Project.findById(projectId)
            .populate('projectManager', 'fullName email role department')
            .populate('budgetCodeId', 'code name totalBudget used available')
            .populate('teamMembers.user', 'fullName email role department')
            .populate('createdBy', 'fullName email')
            .populate('updatedBy', 'fullName email')
            .populate('milestones.subMilestones.assignedTo', 'fullName email');

        if (!project || !project.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        res.status(200).json({
            success: true,
            data: project
        });

    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch project',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update project
const updateProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        if (updateData.projectManager) {
            const manager = await User.findById(updateData.projectManager);
            if (!manager) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected project manager does not exist'
                });
            }
        }

        if (updateData.budgetCodeId) {
            const budgetCode = await BudgetCode.findById(updateData.budgetCodeId);
            if (!budgetCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected budget code does not exist'
                });
            }
        }

        if (updateData.timeline) {
            if (updateData.timeline.startDate) {
                updateData.timeline.startDate = new Date(updateData.timeline.startDate);
            }
            if (updateData.timeline.endDate) {
                updateData.timeline.endDate = new Date(updateData.timeline.endDate);
            }
        }

        if (updateData.milestones) {
            updateData.milestones = updateData.milestones.map(milestone => ({
                ...milestone,
                dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
                subMilestones: (milestone.subMilestones || []).map(sub => ({
                    ...sub,
                    dueDate: sub.dueDate ? new Date(sub.dueDate) : null
                }))
            }));
        }

        updateData.updatedBy = req.user.userId;

        const project = await Project.findByIdAndUpdate(
            projectId,
            { $set: updateData },
            { new: true, runValidators: true }
        )
        .populate('projectManager', 'fullName email role department')
        .populate('budgetCodeId', 'code name totalBudget used available')
        .populate('updatedBy', 'fullName email')
        .populate('milestones.subMilestones.assignedTo', 'fullName email');

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Project updated successfully',
            data: project
        });

    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update project',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update project status
const updateProjectStatus = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        const validStatuses = ['Planning', 'Approved', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }

        const updateData = {
            status,
            updatedBy: req.user.userId
        };

        if (status === 'Completed') {
            updateData.progress = 100;
        }

        const project = await Project.findByIdAndUpdate(
            projectId,
            { $set: updateData },
            { new: true, runValidators: true }
        )
        .populate('projectManager', 'fullName email role department')
        .populate('updatedBy', 'fullName email');

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Project status updated to ${status}`,
            data: project
        });

    } catch (error) {
        console.error('Error updating project status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update project status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update project progress (will be auto-calculated from milestones)
const updateProjectProgress = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        // Recalculate progress from milestones
        project.updateMilestoneStatuses();
        project.updatedBy = req.user.userId;
        await project.save();

        const updatedProject = await Project.findById(projectId)
            .populate('projectManager', 'fullName email role department')
            .populate('milestones.subMilestones.assignedTo', 'fullName email');

        res.status(200).json({
            success: true,
            message: 'Project progress recalculated successfully',
            data: updatedProject
        });

    } catch (error) {
        console.error('Error updating project progress:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update project progress',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get project statistics
const getProjectStats = async (req, res) => {
    try {
        const stats = await Project.getStatistics();
        const activeProjects = stats.planning + stats.approved + stats.inProgress;

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    total: stats.total,
                    active: activeProjects,
                    completed: stats.completed,
                    overdue: stats.overdue
                },
                byStatus: {
                    planning: stats.planning,
                    approved: stats.approved,
                    inProgress: stats.inProgress,
                    completed: stats.completed,
                    onHold: stats.onHold,
                    cancelled: stats.cancelled
                },
                metrics: {
                    completionRate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0,
                    averageProgress: stats.averageProgress ? stats.averageProgress.toFixed(1) : 0,
                    overdueRate: stats.total > 0 ? ((stats.overdue / stats.total) * 100).toFixed(1) : 0
                }
            }
        });

    } catch (error) {
        console.error('Error fetching project statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch project statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Search projects
const searchProjects = async (req, res) => {
    try {
        const { q: searchQuery, ...filters } = req.query;

        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const projects = await Project.searchProjects(searchQuery, filters);

        res.status(200).json({
            success: true,
            data: projects,
            count: projects.length
        });

    } catch (error) {
        console.error('Error searching projects:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search projects',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get user's projects
const getUserProjects = async (req, res) => {
    try {
        const userId = req.user.userId;

        const projects = await Project.find({
            $or: [
                { projectManager: userId },
                { 'teamMembers.user': userId }
            ],
            isActive: true
        })
        .populate('projectManager', 'fullName email role department')
        .populate('budgetCodeId', 'code name')
        .populate('milestones.subMilestones.assignedTo', 'fullName email')
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: projects
        });

    } catch (error) {
        console.error('Error fetching user projects:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your projects',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get projects by department
const getProjectsByDepartment = async (req, res) => {
    try {
        const { department } = req.params;
        const { limit = 50 } = req.query;

        const projects = await Project.getByDepartment(department, { 
            limit: parseInt(limit) 
        });

        res.status(200).json({
            success: true,
            data: projects
        });

    } catch (error) {
        console.error('Error fetching department projects:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch department projects',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Delete project (soft delete)
const deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        const project = await Project.findByIdAndUpdate(
            projectId,
            { 
                $set: { 
                    isActive: false,
                    updatedBy: req.user.userId,
                    status: 'Cancelled'
                } 
            },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Project deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete project',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    createProject,
    getProjects,
    getActiveProjects,
    getProjectById,
    updateProject,
    updateProjectStatus,
    updateProjectProgress,
    getProjectStats,
    searchProjects,
    getUserProjects,
    getProjectsByDepartment,
    deleteProject,
    updateSubMilestoneProgress,
    addSubMilestone,
    updateSubMilestone,
    deleteSubMilestone
};








// const Project = require('../models/Project');
// const User = require('../models/User');
// const BudgetCode = require('../models/BudgetCode');
// const mongoose = require('mongoose');

// // Create new project
// const createProject = async (req, res) => {
//     try {
//         const {
//             name,
//             description,
//             projectType,
//             priority,
//             department,
//             projectManager,
//             timeline,
//             budgetCodeId,
//             milestones = []
//         } = req.body;

//         // Validate required fields
//         if (!name || !description || !projectType || !priority || !department || !projectManager || !timeline) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'All required fields must be provided'
//             });
//         }

//         // Validate timeline
//         if (!timeline.startDate || !timeline.endDate) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Both start date and end date are required'
//             });
//         }

//         // Validate project manager exists
//         let manager;
//         let actualManagerId;
        
//         // Check if projectManager is in the fake ID format from departmentStructure
//         if (typeof projectManager === 'string' && projectManager.startsWith('emp_')) {
//             // Extract email from fake ID format: "emp_13_christabel@gratoengineering.com"
//             const emailMatch = projectManager.match(/emp_\d+_(.+)/);
//             if (emailMatch && emailMatch[1]) {
//                 const email = emailMatch[1];
//                 console.log(`Looking for user by email: ${email}`);
                
//                 // Find user by email
//                 manager = await User.findOne({ email: email.toLowerCase(), isActive: true });
//                 if (manager) {
//                     actualManagerId = manager._id;
//                     console.log(`Found user: ${manager.fullName} (${manager.email})`);
//                 } else {
//                     console.log(`User with email ${email} not found in database`);
                    
//                     // Provide more helpful error with suggestions
//                     return res.status(400).json({
//                         success: false,
//                         message: `Project manager "${email}" is not registered in the system. Please contact your administrator to add this user to the database, or select a different project manager.`,
//                         suggestions: [
//                             'Contact your system administrator to add this user',
//                             'Choose a different project manager from registered users',
//                             'Check if the user account is active'
//                         ]
//                     });
//                 }
//             } else {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Invalid project manager ID format'
//                 });
//             }
//         } else {
//             // Try to find by MongoDB ObjectId (original logic)
//             try {
//                 manager = await User.findById(projectManager);
//                 actualManagerId = projectManager;
//             } catch (error) {
//                 console.log('Invalid ObjectId format, trying email lookup');
//                 // Try as email directly
//                 manager = await User.findOne({ email: projectManager.toLowerCase(), isActive: true });
//                 if (manager) {
//                     actualManagerId = manager._id;
//                 }
//             }
//         }
        
//         if (!manager) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Selected project manager does not exist'
//             });
//         }

//         // Validate budget code if provided
//         if (budgetCodeId) {
//             const budgetCode = await BudgetCode.findById(budgetCodeId);
//             if (!budgetCode) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Selected budget code does not exist'
//                 });
//             }
//         }

//         // Check for duplicate project name
//         const existingProject = await Project.findOne({ 
//             name: { $regex: new RegExp(`^${name}$`, 'i') },
//             isActive: true 
//         });
        
//         if (existingProject) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'A project with this name already exists'
//             });
//         }

//         // Create the project
//         const project = new Project({
//             name,
//             description,
//             projectType,
//             priority,
//             department,
//             projectManager: actualManagerId, // Use the actual MongoDB ObjectId
//             timeline: {
//                 startDate: new Date(timeline.startDate),
//                 endDate: new Date(timeline.endDate)
//             },
//             budgetCodeId: budgetCodeId || null,
//             milestones: milestones.map(milestone => ({
//                 title: milestone.title,
//                 dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
//                 status: 'Pending'
//             })),
//             createdBy: req.user.userId
//         });

//         await project.save();

//         // Populate the created project for response
//         const populatedProject = await Project.findById(project._id)
//             .populate('projectManager', 'fullName email role department')
//             .populate('budgetCodeId', 'code name totalBudget available')
//             .populate('createdBy', 'fullName email');

//         res.status(201).json({
//             success: true,
//             message: 'Project created successfully',
//             data: populatedProject
//         });

//     } catch (error) {
//         console.error('Error creating project:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to create project',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Get all projects with filtering
// const getProjects = async (req, res) => {
//     try {
//         const {
//             status,
//             department,
//             priority,
//             projectType,
//             projectManager,
//             page = 1,
//             limit = 10,
//             sort = 'createdAt',
//             order = 'desc'
//         } = req.query;

//         // Build filter query
//         const filter = { isActive: true };
        
//         if (status) filter.status = status;
//         if (department) filter.department = department;
//         if (priority) filter.priority = priority;
//         if (projectType) filter.projectType = projectType;
//         if (projectManager) filter.projectManager = projectManager;

//         // Calculate skip for pagination
//         const skip = (parseInt(page) - 1) * parseInt(limit);

//         // Build sort object
//         const sortObj = {};
//         sortObj[sort] = order === 'desc' ? -1 : 1;

//         // Get projects with pagination
//         const projects = await Project.find(filter)
//             .populate('projectManager', 'fullName email role department')
//             .populate('budgetCodeId', 'code name totalBudget used available')
//             .populate('createdBy', 'fullName email')
//             .sort(sortObj)
//             .skip(skip)
//             .limit(parseInt(limit));

//         // Get total count for pagination
//         const total = await Project.countDocuments(filter);

//         res.status(200).json({
//             success: true,
//             data: {
//                 projects,
//                 pagination: {
//                     currentPage: parseInt(page),
//                     totalPages: Math.ceil(total / parseInt(limit)),
//                     totalProjects: total,
//                     hasNextPage: skip + parseInt(limit) < total,
//                     hasPrevPage: parseInt(page) > 1
//                 }
//             }
//         });

//     } catch (error) {
//         console.error('Error fetching projects:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch projects',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Get active projects only
// const getActiveProjects = async (req, res) => {
//     try {
//         const projects = await Project.find({
//             status: { $in: ['Planning', 'Approved', 'In Progress'] },
//             isActive: true
//         })
//         .populate('projectManager', 'fullName email role department')
//         .populate('budgetCodeId', 'code name')
//         .sort({ createdAt: -1 });

//         res.status(200).json({
//             success: true,
//             data: projects
//         });

//     } catch (error) {
//         console.error('Error fetching active projects:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch active projects',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Get project by ID
// const getProjectById = async (req, res) => {
//     try {
//         const { projectId } = req.params;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project ID'
//             });
//         }

//         const project = await Project.findById(projectId)
//             .populate('projectManager', 'fullName email role department')
//             .populate('budgetCodeId', 'code name totalBudget used available')
//             .populate('teamMembers.user', 'fullName email role department')
//             .populate('createdBy', 'fullName email')
//             .populate('updatedBy', 'fullName email');

//         if (!project || !project.isActive) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         res.status(200).json({
//             success: true,
//             data: project
//         });

//     } catch (error) {
//         console.error('Error fetching project:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch project',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Update project
// const updateProject = async (req, res) => {
//     try {
//         const { projectId } = req.params;
//         const updateData = req.body;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project ID'
//             });
//         }

//         // Validate project manager if being updated
//         if (updateData.projectManager) {
//             const manager = await User.findById(updateData.projectManager);
//             if (!manager) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Selected project manager does not exist'
//                 });
//             }
//         }

//         // Validate budget code if being updated
//         if (updateData.budgetCodeId) {
//             const budgetCode = await BudgetCode.findById(updateData.budgetCodeId);
//             if (!budgetCode) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Selected budget code does not exist'
//                 });
//             }
//         }

//         // Process timeline if provided
//         if (updateData.timeline) {
//             if (updateData.timeline.startDate) {
//                 updateData.timeline.startDate = new Date(updateData.timeline.startDate);
//             }
//             if (updateData.timeline.endDate) {
//                 updateData.timeline.endDate = new Date(updateData.timeline.endDate);
//             }
//         }

//         // Process milestones if provided
//         if (updateData.milestones) {
//             updateData.milestones = updateData.milestones.map(milestone => ({
//                 ...milestone,
//                 dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null
//             }));
//         }

//         // Set update context for pre-save middleware
//         updateData.updatedBy = req.user.userId;

//         const project = await Project.findByIdAndUpdate(
//             projectId,
//             { $set: updateData },
//             { new: true, runValidators: true }
//         )
//         .populate('projectManager', 'fullName email role department')
//         .populate('budgetCodeId', 'code name totalBudget used available')
//         .populate('updatedBy', 'fullName email');

//         if (!project) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: 'Project updated successfully',
//             data: project
//         });

//     } catch (error) {
//         console.error('Error updating project:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to update project',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Update project status
// const updateProjectStatus = async (req, res) => {
//     try {
//         const { projectId } = req.params;
//         const { status, reason } = req.body;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project ID'
//             });
//         }

//         const validStatuses = ['Planning', 'Approved', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
//         if (!validStatuses.includes(status)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid status value'
//             });
//         }

//         const updateData = {
//             status,
//             updatedBy: req.user.userId
//         };

//         // If completing the project, set progress to 100
//         if (status === 'Completed') {
//             updateData.progress = 100;
//         }

//         const project = await Project.findByIdAndUpdate(
//             projectId,
//             { $set: updateData },
//             { new: true, runValidators: true }
//         )
//         .populate('projectManager', 'fullName email role department')
//         .populate('updatedBy', 'fullName email');

//         if (!project) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: `Project status updated to ${status}`,
//             data: project
//         });

//     } catch (error) {
//         console.error('Error updating project status:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to update project status',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Update project progress
// const updateProjectProgress = async (req, res) => {
//     try {
//         const { projectId } = req.params;
//         const { progress } = req.body;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project ID'
//             });
//         }

//         if (progress < 0 || progress > 100) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Progress must be between 0 and 100'
//             });
//         }

//         const updateData = {
//             progress,
//             updatedBy: req.user.userId
//         };

//         // Auto-update status based on progress
//         if (progress === 100) {
//             updateData.status = 'Completed';
//         } else if (progress > 0 && progress < 100) {
//             // Only update to 'In Progress' if current status is 'Planning' or 'Approved'
//             const currentProject = await Project.findById(projectId);
//             if (currentProject && ['Planning', 'Approved'].includes(currentProject.status)) {
//                 updateData.status = 'In Progress';
//             }
//         }

//         const project = await Project.findByIdAndUpdate(
//             projectId,
//             { $set: updateData },
//             { new: true, runValidators: true }
//         )
//         .populate('projectManager', 'fullName email role department');

//         if (!project) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: 'Project progress updated successfully',
//             data: project
//         });

//     } catch (error) {
//         console.error('Error updating project progress:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to update project progress',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Get project statistics
// const getProjectStats = async (req, res) => {
//     try {
//         const stats = await Project.getStatistics();
        
//         // Calculate additional metrics
//         const activeProjects = stats.planning + stats.approved + stats.inProgress;
        
//         res.status(200).json({
//             success: true,
//             data: {
//                 summary: {
//                     total: stats.total,
//                     active: activeProjects,
//                     completed: stats.completed,
//                     overdue: stats.overdue
//                 },
//                 byStatus: {
//                     planning: stats.planning,
//                     approved: stats.approved,
//                     inProgress: stats.inProgress,
//                     completed: stats.completed,
//                     onHold: stats.onHold,
//                     cancelled: stats.cancelled
//                 },
//                 metrics: {
//                     completionRate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0,
//                     averageProgress: stats.averageProgress ? stats.averageProgress.toFixed(1) : 0,
//                     overdueRate: stats.total > 0 ? ((stats.overdue / stats.total) * 100).toFixed(1) : 0
//                 }
//             }
//         });

//     } catch (error) {
//         console.error('Error fetching project statistics:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch project statistics',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Search projects
// const searchProjects = async (req, res) => {
//     try {
//         const { q: searchQuery, ...filters } = req.query;

//         if (!searchQuery) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Search query is required'
//             });
//         }

//         const projects = await Project.searchProjects(searchQuery, filters);

//         res.status(200).json({
//             success: true,
//             data: projects,
//             count: projects.length
//         });

//     } catch (error) {
//         console.error('Error searching projects:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to search projects',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Get user's projects (where user is project manager or team member)
// const getUserProjects = async (req, res) => {
//     try {
//         const userId = req.user.userId;

//         const projects = await Project.find({
//             $or: [
//                 { projectManager: userId },
//                 { 'teamMembers.user': userId }
//             ],
//             isActive: true
//         })
//         .populate('projectManager', 'fullName email role department')
//         .populate('budgetCodeId', 'code name')
//         .sort({ createdAt: -1 });

//         res.status(200).json({
//             success: true,
//             data: projects
//         });

//     } catch (error) {
//         console.error('Error fetching user projects:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch your projects',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Get projects by department
// const getProjectsByDepartment = async (req, res) => {
//     try {
//         const { department } = req.params;
//         const { limit = 50 } = req.query;

//         const projects = await Project.getByDepartment(department, { 
//             limit: parseInt(limit) 
//         });

//         res.status(200).json({
//             success: true,
//             data: projects
//         });

//     } catch (error) {
//         console.error('Error fetching department projects:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch department projects',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Delete project (soft delete)
// const deleteProject = async (req, res) => {
//     try {
//         const { projectId } = req.params;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project ID'
//             });
//         }

//         const project = await Project.findByIdAndUpdate(
//             projectId,
//             { 
//                 $set: { 
//                     isActive: false,
//                     updatedBy: req.user.userId,
//                     status: 'Cancelled'
//                 } 
//             },
//             { new: true }
//         );

//         if (!project) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: 'Project deleted successfully'
//         });

//     } catch (error) {
//         console.error('Error deleting project:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to delete project',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// module.exports = {
//     createProject,
//     getProjects,
//     getActiveProjects,
//     getProjectById,
//     updateProject,
//     updateProjectStatus,
//     updateProjectProgress,
//     getProjectStats,
//     searchProjects,
//     getUserProjects,
//     getProjectsByDepartment,
//     deleteProject
// };