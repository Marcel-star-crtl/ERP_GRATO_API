const Project = require('../models/Project');
const User = require('../models/User');
const BudgetCode = require('../models/BudgetCode');
const ActionItem = require('../models/ActionItem');
const mongoose = require('mongoose');


// Create new project with milestone assignments
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

        console.log('=== CREATE PROJECT ===');
        console.log('Project:', name);
        console.log('Milestones:', milestones.length);

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

        // Validate milestones
        if (!milestones || milestones.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one milestone is required'
            });
        }

        // Validate milestone weights sum to 100%
        const totalWeight = milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
        if (totalWeight !== 100) {
            return res.status(400).json({
                success: false,
                message: `Milestone weights must sum to 100%. Current total: ${totalWeight}%`
            });
        }

        // Validate each milestone has assigned supervisor
        for (const milestone of milestones) {
            if (!milestone.assignedSupervisor) {
                return res.status(400).json({
                    success: false,
                    message: `Milestone "${milestone.title}" must have an assigned supervisor`
                });
            }

            // Verify supervisor exists
            const supervisor = await User.findById(milestone.assignedSupervisor);
            if (!supervisor) {
                return res.status(400).json({
                    success: false,
                    message: `Supervisor not found for milestone "${milestone.title}"`
                });
            }
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
                        message: `Project manager "${email}" is not registered in the system.`
                    });
                }
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

        // Process milestones
        const processedMilestones = milestones.map(milestone => ({
            title: milestone.title,
            description: milestone.description || '',
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
            assignedSupervisor: milestone.assignedSupervisor,
            weight: milestone.weight || 0,
            status: 'Not Started',
            progress: 0,
            totalTaskWeightAssigned: 0,
            manuallyCompleted: false
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

        // Populate the created project
        const populatedProject = await Project.findById(project._id)
            .populate('projectManager', 'fullName email role department')
            .populate('budgetCodeId', 'code name totalBudget available')
            .populate('createdBy', 'fullName email')
            .populate('milestones.assignedSupervisor', 'fullName email department');

        console.log('✅ Project created with milestones assigned to supervisors');
        console.log('Project Code:', populatedProject.code);

        res.status(201).json({
            success: true,
            message: 'Project created successfully with milestone assignments',
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

// Get supervisor's assigned milestones
const getSupervisorMilestones = async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('=== GET SUPERVISOR MILESTONES ===');
        console.log('Supervisor:', userId);

        const milestones = await Project.getSupervisorMilestones(userId);

        // Get task counts for each milestone
        for (const item of milestones) {
            const tasks = await ActionItem.find({ 
                milestoneId: item.milestone._id 
            }).select('status taskWeight assignedTo');

            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.status === 'Completed').length;
            const totalAssignedWeight = tasks.reduce((sum, t) => sum + t.taskWeight, 0);
            const totalAssignees = tasks.reduce((sum, t) => sum + t.assignedTo.length, 0);

            item.milestone.taskStats = {
                total: totalTasks,
                completed: completedTasks,
                totalWeightAssigned: totalAssignedWeight,
                totalAssignees: totalAssignees,
                weightRemaining: 100 - totalAssignedWeight
            };
        }

        console.log(`Found ${milestones.length} assigned milestones`);

        res.status(200).json({
            success: true,
            data: milestones,
            count: milestones.length
        });

    } catch (error) {
        console.error('Error fetching supervisor milestones:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch supervisor milestones',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


// Get milestone details with tasks
const getMilestoneDetails = async (req, res) => {
    try {
        const { projectId, milestoneId } = req.params;

        console.log('=== GET MILESTONE DETAILS ===');
        console.log('Project:', projectId);
        console.log('Milestone:', milestoneId);

        if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(milestoneId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project or milestone ID'
            });
        }

        const project = await Project.findById(projectId)
            .populate('projectManager', 'fullName email')
            .populate('milestones.assignedSupervisor', 'fullName email department');

        if (!project || !project.isActive) {
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

        // Get all tasks for this milestone
        const tasks = await ActionItem.find({ milestoneId: milestoneId })
            .populate('assignedTo.user', 'fullName email department')
            .populate('createdBy', 'fullName email')
            .populate('linkedKPIs.kpiDocId')
            .sort({ createdAt: -1 });

        // Calculate statistics
        const stats = {
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'Completed').length,
            inProgressTasks: tasks.filter(t => t.status === 'In Progress').length,
            pendingTasks: tasks.filter(t => ['Not Started', 'Pending Approval'].includes(t.status)).length,
            totalWeightAssigned: tasks.reduce((sum, t) => sum + t.taskWeight, 0),
            weightRemaining: 100 - tasks.reduce((sum, t) => sum + t.taskWeight, 0),
            totalAssignees: tasks.reduce((sum, t) => sum + t.assignedTo.length, 0)
        };

        res.status(200).json({
            success: true,
            data: {
                project: {
                    _id: project._id,
                    name: project.name,
                    code: project.code,
                    status: project.status
                },
                milestone: {
                    _id: milestone._id,
                    title: milestone.title,
                    description: milestone.description,
                    weight: milestone.weight,
                    progress: milestone.progress,
                    status: milestone.status,
                    dueDate: milestone.dueDate,
                    assignedSupervisor: milestone.assignedSupervisor,
                    totalTaskWeightAssigned: milestone.totalTaskWeightAssigned,
                    manuallyCompleted: milestone.manuallyCompleted
                },
                tasks,
                stats
            }
        });

    } catch (error) {
        console.error('Error fetching milestone details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch milestone details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


// Manually complete milestone
const completeMilestone = async (req, res) => {
    try {
        const { projectId, milestoneId } = req.params;
        const userId = req.user.userId;

        console.log('=== COMPLETE MILESTONE ===');
        console.log('Project:', projectId);
        console.log('Milestone:', milestoneId);

        if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(milestoneId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project or milestone ID'
            });
        }

        const project = await Project.findById(projectId);
        if (!project || !project.isActive) {
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

        // Verify user is the assigned supervisor
        if (!milestone.assignedSupervisor.equals(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Only the assigned supervisor can complete this milestone'
            });
        }

        // Check if progress is 100%
        if (milestone.progress < 100) {
            return res.status(400).json({
                success: false,
                message: `Milestone progress must be 100% to complete. Current progress: ${milestone.progress}%`
            });
        }

        // Check if all tasks are completed
        const tasks = await ActionItem.find({ milestoneId: milestoneId });
        const incompleteTasks = tasks.filter(t => t.status !== 'Completed');
        
        if (incompleteTasks.length > 0) {
            return res.status(400).json({
                success: false,
                message: `${incompleteTasks.length} task(s) are still incomplete`,
                incompleteTasks: incompleteTasks.map(t => ({ id: t._id, title: t.title, status: t.status }))
            });
        }

        // Mark milestone as completed
        milestone.status = 'Completed';
        milestone.manuallyCompleted = true;
        milestone.completedDate = new Date();
        milestone.completedBy = userId;

        // Recalculate project progress
        project.progress = project.calculateProjectProgress();

        await project.save();

        console.log('✅ Milestone marked as completed');

        res.status(200).json({
            success: true,
            message: 'Milestone completed successfully',
            data: {
                milestone: {
                    _id: milestone._id,
                    title: milestone.title,
                    status: milestone.status,
                    progress: milestone.progress,
                    completedDate: milestone.completedDate
                },
                projectProgress: project.progress
            }
        });

    } catch (error) {
        console.error('Error completing milestone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete milestone',
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
            .populate('milestones.assignedSupervisor', 'fullName email department')
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
        console.log('=== FETCHING ACTIVE PROJECTS ===');
        console.log('User:', req.user?.userId);
        
        const projects = await Project.find({
            status: { $in: ['Planning', 'Approved', 'In Progress'] },
            isActive: true
        })
        .populate('projectManager', 'fullName email role department')
        .populate('budgetCodeId', 'code name budget used remaining totalBudget')
        .populate('milestones.assignedSupervisor', 'fullName email department')
        .sort({ createdAt: -1 });

        console.log(`Found ${projects.length} active projects`);
        
        // Log budget details for debugging
        projects.forEach(project => {
            console.log(`Project: ${project.name} (${project.code})`);
            if (project.budgetCodeId) {
                console.log(`Budget Code: ${project.budgetCodeId.code} - ${project.budgetCodeId.name}`);
                console.log(`Budget: ${project.budgetCodeId.budget || project.budgetCodeId.totalBudget || 'N/A'}`);
            } else {
                console.log(`No budget code assigned`);
            }
        });

        res.status(200).json({
            success: true,
            data: projects,
            count: projects.length
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
            .populate('milestones.assignedSupervisor', 'fullName email department');

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

        // Validate milestone weights if updating milestones
        if (updateData.milestones && updateData.milestones.length > 0) {
            const totalWeight = updateData.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
            if (totalWeight !== 100) {
                return res.status(400).json({
                    success: false,
                    message: `Milestone weights must sum to 100%. Current total: ${totalWeight}%`
                });
            }

            // Verify supervisors exist
            for (const milestone of updateData.milestones) {
                if (milestone.assignedSupervisor) {
                    const supervisor = await User.findById(milestone.assignedSupervisor);
                    if (!supervisor) {
                        return res.status(400).json({
                            success: false,
                            message: `Supervisor not found for milestone "${milestone.title}"`
                        });
                    }
                }
            }
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
                dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null
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
        .populate('milestones.assignedSupervisor', 'fullName email department');

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
        project.progress = project.calculateProjectProgress();
        project.updatedBy = req.user.userId;
        await project.save();

        const updatedProject = await Project.findById(projectId)
            .populate('projectManager', 'fullName email role department')
            .populate('milestones.assignedSupervisor', 'fullName email department');

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
        .populate('milestones.assignedSupervisor', 'fullName email department')
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
    getSupervisorMilestones,
    getMilestoneDetails,
    completeMilestone
};










// const Project = require('../models/Project');
// const User = require('../models/User');
// const BudgetCode = require('../models/BudgetCode');
// const ActionItem = require('../models/ActionItem');
// const mongoose = require('mongoose');


// // Create new project with milestone assignments
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

//         console.log('=== CREATE PROJECT ===');
//         console.log('Project:', name);
//         console.log('Milestones:', milestones.length);

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

//         // Validate milestones
//         if (!milestones || milestones.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'At least one milestone is required'
//             });
//         }

//         // Validate milestone weights sum to 100%
//         const totalWeight = milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//         if (totalWeight !== 100) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Milestone weights must sum to 100%. Current total: ${totalWeight}%`
//             });
//         }

//         // Validate each milestone has assigned supervisor
//         for (const milestone of milestones) {
//             if (!milestone.assignedSupervisor) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Milestone "${milestone.title}" must have an assigned supervisor`
//                 });
//             }

//             // Verify supervisor exists
//             const supervisor = await User.findById(milestone.assignedSupervisor);
//             if (!supervisor) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Supervisor not found for milestone "${milestone.title}"`
//                 });
//             }
//         }

//         // Validate project manager exists
//         let manager;
//         let actualManagerId;

//         if (typeof projectManager === 'string' && projectManager.startsWith('emp_')) {
//             const emailMatch = projectManager.match(/emp_\d+_(.+)/);
//             if (emailMatch && emailMatch[1]) {
//                 const email = emailMatch[1];
//                 manager = await User.findOne({ email: email.toLowerCase(), isActive: true });
//                 if (manager) {
//                     actualManagerId = manager._id;
//                 } else {
//                     return res.status(400).json({
//                         success: false,
//                         message: `Project manager "${email}" is not registered in the system.`
//                     });
//                 }
//             }
//         } else {
//             try {
//                 manager = await User.findById(projectManager);
//                 actualManagerId = projectManager;
//             } catch (error) {
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

//         // Process milestones
//         const processedMilestones = milestones.map(milestone => ({
//             title: milestone.title,
//             description: milestone.description || '',
//             dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
//             assignedSupervisor: milestone.assignedSupervisor,
//             weight: milestone.weight || 0,
//             status: 'Not Started',
//             progress: 0,
//             totalTaskWeightAssigned: 0,
//             manuallyCompleted: false
//         }));

//         // Create the project
//         const project = new Project({
//             name,
//             description,
//             projectType,
//             priority,
//             department,
//             projectManager: actualManagerId,
//             timeline: {
//                 startDate: new Date(timeline.startDate),
//                 endDate: new Date(timeline.endDate)
//             },
//             budgetCodeId: budgetCodeId || null,
//             milestones: processedMilestones,
//             createdBy: req.user.userId
//         });

//         await project.save();

//         // Populate the created project
//         const populatedProject = await Project.findById(project._id)
//             .populate('projectManager', 'fullName email role department')
//             .populate('budgetCodeId', 'code name totalBudget available')
//             .populate('createdBy', 'fullName email')
//             .populate('milestones.assignedSupervisor', 'fullName email department');

//         console.log('✅ Project created with milestones assigned to supervisors');

//         res.status(201).json({
//             success: true,
//             message: 'Project created successfully with milestone assignments',
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

// // Get supervisor's assigned milestones
// const getSupervisorMilestones = async (req, res) => {
//     try {
//         const userId = req.user.userId;

//         console.log('=== GET SUPERVISOR MILESTONES ===');
//         console.log('Supervisor:', userId);

//         const milestones = await Project.getSupervisorMilestones(userId);

//         // Get task counts for each milestone
//         for (const item of milestones) {
//             const tasks = await ActionItem.find({ 
//                 milestoneId: item.milestone._id 
//             }).select('status taskWeight assignedTo');

//             const totalTasks = tasks.length;
//             const completedTasks = tasks.filter(t => t.status === 'Completed').length;
//             const totalAssignedWeight = tasks.reduce((sum, t) => sum + t.taskWeight, 0);
//             const totalAssignees = tasks.reduce((sum, t) => sum + t.assignedTo.length, 0);

//             item.milestone.taskStats = {
//                 total: totalTasks,
//                 completed: completedTasks,
//                 totalWeightAssigned: totalAssignedWeight,
//                 totalAssignees: totalAssignees,
//                 weightRemaining: 100 - totalAssignedWeight
//             };
//         }

//         console.log(`Found ${milestones.length} assigned milestones`);

//         res.status(200).json({
//             success: true,
//             data: milestones,
//             count: milestones.length
//         });

//     } catch (error) {
//         console.error('Error fetching supervisor milestones:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch supervisor milestones',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };


// // Get milestone details with tasks
// const getMilestoneDetails = async (req, res) => {
//     try {
//         const { projectId, milestoneId } = req.params;

//         console.log('=== GET MILESTONE DETAILS ===');
//         console.log('Project:', projectId);
//         console.log('Milestone:', milestoneId);

//         if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(milestoneId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project or milestone ID'
//             });
//         }

//         const project = await Project.findById(projectId)
//             .populate('projectManager', 'fullName email')
//             .populate('milestones.assignedSupervisor', 'fullName email department');

//         if (!project || !project.isActive) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         const milestone = project.milestones.id(milestoneId);
//         if (!milestone) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Milestone not found'
//             });
//         }

//         // Get all tasks for this milestone
//         const tasks = await ActionItem.find({ milestoneId: milestoneId })
//             .populate('assignedTo.user', 'fullName email department')
//             .populate('createdBy', 'fullName email')
//             .populate('linkedKPIs.kpiDocId')
//             .sort({ createdAt: -1 });

//         // Calculate statistics
//         const stats = {
//             totalTasks: tasks.length,
//             completedTasks: tasks.filter(t => t.status === 'Completed').length,
//             inProgressTasks: tasks.filter(t => t.status === 'In Progress').length,
//             pendingTasks: tasks.filter(t => ['Not Started', 'Pending Approval'].includes(t.status)).length,
//             totalWeightAssigned: tasks.reduce((sum, t) => sum + t.taskWeight, 0),
//             weightRemaining: 100 - tasks.reduce((sum, t) => sum + t.taskWeight, 0),
//             totalAssignees: tasks.reduce((sum, t) => sum + t.assignedTo.length, 0)
//         };

//         res.status(200).json({
//             success: true,
//             data: {
//                 project: {
//                     _id: project._id,
//                     name: project.name,
//                     code: project.code,
//                     status: project.status
//                 },
//                 milestone: {
//                     _id: milestone._id,
//                     title: milestone.title,
//                     description: milestone.description,
//                     weight: milestone.weight,
//                     progress: milestone.progress,
//                     status: milestone.status,
//                     dueDate: milestone.dueDate,
//                     assignedSupervisor: milestone.assignedSupervisor,
//                     totalTaskWeightAssigned: milestone.totalTaskWeightAssigned,
//                     manuallyCompleted: milestone.manuallyCompleted
//                 },
//                 tasks,
//                 stats
//             }
//         });

//     } catch (error) {
//         console.error('Error fetching milestone details:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch milestone details',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };


// // Manually complete milestone
// const completeMilestone = async (req, res) => {
//     try {
//         const { projectId, milestoneId } = req.params;
//         const userId = req.user.userId;

//         console.log('=== COMPLETE MILESTONE ===');
//         console.log('Project:', projectId);
//         console.log('Milestone:', milestoneId);

//         if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(milestoneId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project or milestone ID'
//             });
//         }

//         const project = await Project.findById(projectId);
//         if (!project || !project.isActive) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         const milestone = project.milestones.id(milestoneId);
//         if (!milestone) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Milestone not found'
//             });
//         }

//         // Verify user is the assigned supervisor
//         if (!milestone.assignedSupervisor.equals(userId)) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'Only the assigned supervisor can complete this milestone'
//             });
//         }

//         // Check if progress is 100%
//         if (milestone.progress < 100) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Milestone progress must be 100% to complete. Current progress: ${milestone.progress}%`
//             });
//         }

//         // Check if all tasks are completed
//         const tasks = await ActionItem.find({ milestoneId: milestoneId });
//         const incompleteTasks = tasks.filter(t => t.status !== 'Completed');
        
//         if (incompleteTasks.length > 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: `${incompleteTasks.length} task(s) are still incomplete`,
//                 incompleteTasks: incompleteTasks.map(t => ({ id: t._id, title: t.title, status: t.status }))
//             });
//         }

//         // Mark milestone as completed
//         milestone.status = 'Completed';
//         milestone.manuallyCompleted = true;
//         milestone.completedDate = new Date();
//         milestone.completedBy = userId;

//         // Recalculate project progress
//         project.progress = project.calculateProjectProgress();

//         await project.save();

//         console.log('✅ Milestone marked as completed');

//         res.status(200).json({
//             success: true,
//             message: 'Milestone completed successfully',
//             data: {
//                 milestone: {
//                     _id: milestone._id,
//                     title: milestone.title,
//                     status: milestone.status,
//                     progress: milestone.progress,
//                     completedDate: milestone.completedDate
//                 },
//                 projectProgress: project.progress
//             }
//         });

//     } catch (error) {
//         console.error('Error completing milestone:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to complete milestone',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };


// // Update sub-milestone progress
// const updateSubMilestoneProgress = async (req, res) => {
//     try {
//         const { projectId, milestoneId, subMilestoneId } = req.params;
//         const { progress, notes } = req.body;

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

//         const project = await Project.findById(projectId);
//         if (!project) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         const milestone = project.milestones.id(milestoneId);
//         if (!milestone) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Milestone not found'
//             });
//         }

//         const subMilestone = milestone.subMilestones.id(subMilestoneId);
//         if (!subMilestone) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Sub-milestone not found'
//             });
//         }

//         subMilestone.progress = progress;
//         if (notes) subMilestone.notes = notes;
        
//         if (progress === 100 && !subMilestone.completedDate) {
//             subMilestone.completedDate = new Date();
//         }

//         project.updatedBy = req.user.userId;
//         await project.save();

//         const updatedProject = await Project.findById(projectId)
//             .populate('projectManager', 'fullName email role department')
//             .populate('milestones.subMilestones.assignedTo', 'fullName email');

//         res.status(200).json({
//             success: true,
//             message: 'Sub-milestone progress updated successfully',
//             data: updatedProject
//         });

//     } catch (error) {
//         console.error('Error updating sub-milestone progress:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to update sub-milestone progress',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Add sub-milestone to existing milestone
// const addSubMilestone = async (req, res) => {
//     try {
//         const { projectId, milestoneId } = req.params;
//         const { title, description, dueDate, weight, assignedTo, notes } = req.body;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project ID'
//             });
//         }

//         if (!title) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Sub-milestone title is required'
//             });
//         }

//         const project = await Project.findById(projectId);
//         if (!project) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         const milestone = project.milestones.id(milestoneId);
//         if (!milestone) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Milestone not found'
//             });
//         }

//         milestone.subMilestones.push({
//             title,
//             description: description || '',
//             dueDate: dueDate ? new Date(dueDate) : null,
//             status: 'Pending',
//             progress: 0,
//             weight: weight || 10,
//             assignedTo: assignedTo || null,
//             notes: notes || ''
//         });

//         project.updatedBy = req.user.userId;
//         await project.save();

//         const updatedProject = await Project.findById(projectId)
//             .populate('projectManager', 'fullName email role department')
//             .populate('milestones.subMilestones.assignedTo', 'fullName email');

//         res.status(200).json({
//             success: true,
//             message: 'Sub-milestone added successfully',
//             data: updatedProject
//         });

//     } catch (error) {
//         console.error('Error adding sub-milestone:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to add sub-milestone',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Update sub-milestone
// const updateSubMilestone = async (req, res) => {
//     try {
//         const { projectId, milestoneId, subMilestoneId } = req.params;
//         const updateData = req.body;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project ID'
//             });
//         }

//         const project = await Project.findById(projectId);
//         if (!project) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         const milestone = project.milestones.id(milestoneId);
//         if (!milestone) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Milestone not found'
//             });
//         }

//         const subMilestone = milestone.subMilestones.id(subMilestoneId);
//         if (!subMilestone) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Sub-milestone not found'
//             });
//         }

//         // Update fields
//         if (updateData.title) subMilestone.title = updateData.title;
//         if (updateData.description !== undefined) subMilestone.description = updateData.description;
//         if (updateData.dueDate) subMilestone.dueDate = new Date(updateData.dueDate);
//         if (updateData.weight !== undefined) subMilestone.weight = updateData.weight;
//         if (updateData.assignedTo !== undefined) subMilestone.assignedTo = updateData.assignedTo;
//         if (updateData.notes !== undefined) subMilestone.notes = updateData.notes;
//         if (updateData.progress !== undefined) {
//             subMilestone.progress = updateData.progress;
//             if (updateData.progress === 100 && !subMilestone.completedDate) {
//                 subMilestone.completedDate = new Date();
//             }
//         }

//         project.updatedBy = req.user.userId;
//         await project.save();

//         const updatedProject = await Project.findById(projectId)
//             .populate('projectManager', 'fullName email role department')
//             .populate('milestones.subMilestones.assignedTo', 'fullName email');

//         res.status(200).json({
//             success: true,
//             message: 'Sub-milestone updated successfully',
//             data: updatedProject
//         });

//     } catch (error) {
//         console.error('Error updating sub-milestone:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to update sub-milestone',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Delete sub-milestone
// const deleteSubMilestone = async (req, res) => {
//     try {
//         const { projectId, milestoneId, subMilestoneId } = req.params;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project ID'
//             });
//         }

//         const project = await Project.findById(projectId);
//         if (!project) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         const milestone = project.milestones.id(milestoneId);
//         if (!milestone) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Milestone not found'
//             });
//         }

//         const subMilestone = milestone.subMilestones.id(subMilestoneId);
//         if (!subMilestone) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Sub-milestone not found'
//             });
//         }

//         subMilestone.remove();
//         project.updatedBy = req.user.userId;
//         await project.save();

//         const updatedProject = await Project.findById(projectId)
//             .populate('projectManager', 'fullName email role department')
//             .populate('milestones.subMilestones.assignedTo', 'fullName email');

//         res.status(200).json({
//             success: true,
//             message: 'Sub-milestone deleted successfully',
//             data: updatedProject
//         });

//     } catch (error) {
//         console.error('Error deleting sub-milestone:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to delete sub-milestone',
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

//         const filter = { isActive: true };

//         if (status) filter.status = status;
//         if (department) filter.department = department;
//         if (priority) filter.priority = priority;
//         if (projectType) filter.projectType = projectType;
//         if (projectManager) filter.projectManager = projectManager;

//         const skip = (parseInt(page) - 1) * parseInt(limit);
//         const sortObj = {};
//         sortObj[sort] = order === 'desc' ? -1 : 1;

//         const projects = await Project.find(filter)
//             .populate('projectManager', 'fullName email role department')
//             .populate('budgetCodeId', 'code name totalBudget used available')
//             .populate('createdBy', 'fullName email')
//             .populate('milestones.subMilestones.assignedTo', 'fullName email')
//             .sort(sortObj)
//             .skip(skip)
//             .limit(parseInt(limit));

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
//         console.log('=== FETCHING ACTIVE PROJECTS ===');
//         console.log('User:', req.user?.userId);
        
//         const projects = await Project.find({
//             status: { $in: ['Planning', 'Approved', 'In Progress'] },
//             isActive: true
//         })
//         .populate('projectManager', 'fullName email role department')
//         .populate('budgetCodeId', 'code name budget used remaining totalBudget')
//         .populate('milestones.subMilestones.assignedTo', 'fullName email')
//         .sort({ createdAt: -1 });

//         console.log(`Found ${projects.length} active projects`);
        
//         // Log budget details for debugging
//         projects.forEach(project => {
//             if (project.budgetCodeId) {
//                 console.log(`Project: ${project.name}`);
//                 console.log(`Budget Code: ${project.budgetCodeId.code} - ${project.budgetCodeId.name}`);
//                 console.log(`Budget: ${project.budgetCodeId.budget || project.budgetCodeId.totalBudget || 'N/A'}`);
//                 console.log(`Used: ${project.budgetCodeId.used || 'N/A'}`);
//                 console.log(`Remaining: ${project.budgetCodeId.remaining || 'N/A'}`);
//             } else {
//                 console.log(`Project: ${project.name} - No budget code assigned`);
//             }
//         });

//         res.status(200).json({
//             success: true,
//             data: projects,
//             count: projects.length
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
//             .populate('updatedBy', 'fullName email')
//             .populate('milestones.subMilestones.assignedTo', 'fullName email');

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

// // // Update project
// // const updateProject = async (req, res) => {
// //     try {
// //         const { projectId } = req.params;
// //         const updateData = req.body;

// //         if (!mongoose.Types.ObjectId.isValid(projectId)) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: 'Invalid project ID'
// //             });
// //         }

// //         if (updateData.projectManager) {
// //             const manager = await User.findById(updateData.projectManager);
// //             if (!manager) {
// //                 return res.status(400).json({
// //                     success: false,
// //                     message: 'Selected project manager does not exist'
// //                 });
// //             }
// //         }

// //         if (updateData.budgetCodeId) {
// //             const budgetCode = await BudgetCode.findById(updateData.budgetCodeId);
// //             if (!budgetCode) {
// //                 return res.status(400).json({
// //                     success: false,
// //                     message: 'Selected budget code does not exist'
// //                 });
// //             }
// //         }

// //         if (updateData.timeline) {
// //             if (updateData.timeline.startDate) {
// //                 updateData.timeline.startDate = new Date(updateData.timeline.startDate);
// //             }
// //             if (updateData.timeline.endDate) {
// //                 updateData.timeline.endDate = new Date(updateData.timeline.endDate);
// //             }
// //         }

// //         if (updateData.milestones) {
// //             updateData.milestones = updateData.milestones.map(milestone => ({
// //                 ...milestone,
// //                 dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
// //                 subMilestones: (milestone.subMilestones || []).map(sub => ({
// //                     ...sub,
// //                     dueDate: sub.dueDate ? new Date(sub.dueDate) : null
// //                 }))
// //             }));
// //         }

// //         updateData.updatedBy = req.user.userId;

// //         const project = await Project.findByIdAndUpdate(
// //             projectId,
// //             { $set: updateData },
// //             { new: true, runValidators: true }
// //         )
// //         .populate('projectManager', 'fullName email role department')
// //         .populate('budgetCodeId', 'code name totalBudget used available')
// //         .populate('updatedBy', 'fullName email')
// //         .populate('milestones.subMilestones.assignedTo', 'fullName email');

// //         if (!project) {
// //             return res.status(404).json({
// //                 success: false,
// //                 message: 'Project not found'
// //             });
// //         }

// //         res.status(200).json({
// //             success: true,
// //             message: 'Project updated successfully',
// //             data: project
// //         });

// //     } catch (error) {
// //         console.error('Error updating project:', error);
// //         res.status(500).json({
// //             success: false,
// //             message: 'Failed to update project',
// //             error: process.env.NODE_ENV === 'development' ? error.message : undefined
// //         });
// //     }
// // };

// // Update project (existing function - keep most of it, just update milestone handling)
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

//         // Validate milestone weights if updating milestones
//         if (updateData.milestones && updateData.milestones.length > 0) {
//             const totalWeight = updateData.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//             if (totalWeight !== 100) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Milestone weights must sum to 100%. Current total: ${totalWeight}%`
//                 });
//             }

//             // Verify supervisors exist
//             for (const milestone of updateData.milestones) {
//                 if (milestone.assignedSupervisor) {
//                     const supervisor = await User.findById(milestone.assignedSupervisor);
//                     if (!supervisor) {
//                         return res.status(400).json({
//                             success: false,
//                             message: `Supervisor not found for milestone "${milestone.title}"`
//                         });
//                     }
//                 }
//             }
//         }

//         if (updateData.projectManager) {
//             const manager = await User.findById(updateData.projectManager);
//             if (!manager) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Selected project manager does not exist'
//                 });
//             }
//         }

//         if (updateData.budgetCodeId) {
//             const budgetCode = await BudgetCode.findById(updateData.budgetCodeId);
//             if (!budgetCode) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Selected budget code does not exist'
//                 });
//             }
//         }

//         if (updateData.timeline) {
//             if (updateData.timeline.startDate) {
//                 updateData.timeline.startDate = new Date(updateData.timeline.startDate);
//             }
//             if (updateData.timeline.endDate) {
//                 updateData.timeline.endDate = new Date(updateData.timeline.endDate);
//             }
//         }

//         if (updateData.milestones) {
//             updateData.milestones = updateData.milestones.map(milestone => ({
//                 ...milestone,
//                 dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null
//             }));
//         }

//         updateData.updatedBy = req.user.userId;

//         const project = await Project.findByIdAndUpdate(
//             projectId,
//             { $set: updateData },
//             { new: true, runValidators: true }
//         )
//         .populate('projectManager', 'fullName email role department')
//         .populate('budgetCodeId', 'code name totalBudget used available')
//         .populate('updatedBy', 'fullName email')
//         .populate('milestones.assignedSupervisor', 'fullName email department');

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
//         const { status } = req.body;

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

// // Update project progress (will be auto-calculated from milestones)
// const updateProjectProgress = async (req, res) => {
//     try {
//         const { projectId } = req.params;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid project ID'
//             });
//         }

//         const project = await Project.findById(projectId);
//         if (!project) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Project not found'
//             });
//         }

//         // Recalculate progress from milestones
//         project.updateMilestoneStatuses();
//         project.updatedBy = req.user.userId;
//         await project.save();

//         const updatedProject = await Project.findById(projectId)
//             .populate('projectManager', 'fullName email role department')
//             .populate('milestones.subMilestones.assignedTo', 'fullName email');

//         res.status(200).json({
//             success: true,
//             message: 'Project progress recalculated successfully',
//             data: updatedProject
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

// // Get user's projects
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
//         .populate('milestones.subMilestones.assignedTo', 'fullName email')
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
//     deleteProject,
//     updateSubMilestoneProgress,
//     addSubMilestone,
//     updateSubMilestone,
//     deleteSubMilestone,
//     getSupervisorMilestones,
//     getMilestoneDetails,
//     completeMilestone,
// };




