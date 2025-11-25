const Project = require('../models/Project');
const User = require('../models/User');
const BudgetCode = require('../models/BudgetCode');
const ActionItem = require('../models/ActionItem');
const mongoose = require('mongoose');


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
//         console.log('Project Code:', populatedProject.code);

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

        // Helper function to resolve user ID from various formats
        const resolveUserId = async (identifier, fieldName) => {
            if (!identifier) {
                throw new Error(`${fieldName} is required`);
            }

            let user;
            let userId;

            // Check if it's an employee format: emp_NUMBER_email@domain.com
            if (typeof identifier === 'string' && identifier.startsWith('emp_')) {
                const emailMatch = identifier.match(/emp_\d+_(.+)/);
                if (emailMatch && emailMatch[1]) {
                    const email = emailMatch[1];
                    console.log(`Looking up user by email: ${email}`);
                    user = await User.findOne({ email: email.toLowerCase(), isActive: true });
                    if (user) {
                        userId = user._id;
                    } else {
                        throw new Error(`${fieldName} "${email}" is not registered in the system`);
                    }
                } else {
                    throw new Error(`Invalid ${fieldName} format: ${identifier}`);
                }
            } 
            // Check if it's a valid ObjectId
            else if (mongoose.Types.ObjectId.isValid(identifier)) {
                try {
                    user = await User.findById(identifier);
                    if (user && user.isActive) {
                        userId = identifier;
                    } else {
                        throw new Error(`${fieldName} not found or inactive`);
                    }
                } catch (error) {
                    throw new Error(`Invalid ${fieldName}: ${identifier}`);
                }
            }
            // Try as email
            else if (typeof identifier === 'string' && identifier.includes('@')) {
                console.log(`Looking up user by email: ${identifier}`);
                user = await User.findOne({ email: identifier.toLowerCase(), isActive: true });
                if (user) {
                    userId = user._id;
                } else {
                    throw new Error(`${fieldName} "${identifier}" is not registered in the system`);
                }
            }
            else {
                throw new Error(`Invalid ${fieldName} format: ${identifier}`);
            }

            return { user, userId };
        };

        // Validate and resolve project manager
        console.log('Resolving project manager:', projectManager);
        const { user: manager, userId: actualManagerId } = await resolveUserId(projectManager, 'Project manager');

        // Validate and resolve supervisors for each milestone
        const processedMilestones = [];
        for (const milestone of milestones) {
            if (!milestone.assignedSupervisor) {
                return res.status(400).json({
                    success: false,
                    message: `Milestone "${milestone.title}" must have an assigned supervisor`
                });
            }

            console.log(`Resolving supervisor for milestone "${milestone.title}":`, milestone.assignedSupervisor);
            try {
                const { userId: supervisorId } = await resolveUserId(
                    milestone.assignedSupervisor, 
                    `Supervisor for milestone "${milestone.title}"`
                );

                processedMilestones.push({
                    title: milestone.title,
                    description: milestone.description || '',
                    dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
                    assignedSupervisor: supervisorId,
                    weight: milestone.weight || 0,
                    status: 'Not Started',
                    progress: 0,
                    totalTaskWeightAssigned: 0,
                    manuallyCompleted: false
                });
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
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

// Get detailed project analytics
const getProjectAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('projectManager', 'fullName email')
      .populate('teamMembers.user', 'fullName email department')
      .populate('milestones.assignedSupervisor', 'fullName email')
      .populate('risks.owner', 'fullName email')
      .populate('issues.assignedTo', 'fullName email')
      .populate('issues.reportedBy', 'fullName email');

    if (!project || !project.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Calculate health score
    const healthScore = project.calculateHealthScore();
    
    // Get timeline analysis
    const timelineAnalysis = project.getTimelineAnalysis();
    
    // Milestone analytics
    const milestoneStats = {
      total: project.milestones.length,
      notStarted: project.milestones.filter(m => m.status === 'Not Started').length,
      inProgress: project.milestones.filter(m => m.status === 'In Progress').length,
      completed: project.milestones.filter(m => m.status === 'Completed').length,
      overdue: project.milestones.filter(m => 
        m.status !== 'Completed' && m.dueDate && new Date(m.dueDate) < new Date()
      ).length,
      completionRate: project.milestones.length > 0 
        ? Math.round((project.milestones.filter(m => m.status === 'Completed').length / project.milestones.length) * 100)
        : 0
    };

    // Task analytics
    const ActionItem = require('../models/ActionItem');
    const tasks = await ActionItem.find({ projectId: project._id });
    
    const taskStats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'Pending Approval').length,
      notStarted: tasks.filter(t => t.status === 'Not Started').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      completed: tasks.filter(t => t.status === 'Completed').length,
      overdue: tasks.filter(t => 
        t.status !== 'Completed' && new Date(t.dueDate) < new Date()
      ).length,
      byPriority: {
        critical: tasks.filter(t => t.priority === 'CRITICAL').length,
        high: tasks.filter(t => t.priority === 'HIGH').length,
        medium: tasks.filter(t => t.priority === 'MEDIUM').length,
        low: tasks.filter(t => t.priority === 'LOW').length
      },
      averageCompletionTime: tasks
        .filter(t => t.status === 'Completed' && t.completedDate)
        .reduce((sum, t) => sum + (t.completedDate - t.createdAt), 0) / tasks.filter(t => t.status === 'Completed').length || 0
    };

    // Risk analytics
    const riskStats = {
      total: project.risks.length,
      byStatus: {
        identified: project.risks.filter(r => r.status === 'Identified').length,
        analyzing: project.risks.filter(r => r.status === 'Analyzing').length,
        mitigating: project.risks.filter(r => r.status === 'Mitigating').length,
        monitoring: project.risks.filter(r => r.status === 'Monitoring').length,
        closed: project.risks.filter(r => r.status === 'Closed').length
      },
      byImpact: {
        veryHigh: project.risks.filter(r => r.impact === 'Very High').length,
        high: project.risks.filter(r => r.impact === 'High').length,
        medium: project.risks.filter(r => r.impact === 'Medium').length,
        low: project.risks.filter(r => r.impact === 'Low').length,
        veryLow: project.risks.filter(r => r.impact === 'Very Low').length
      }
    };

    // Issue analytics
    const issueStats = {
      total: project.issues.length,
      open: project.issues.filter(i => i.status === 'Open').length,
      inProgress: project.issues.filter(i => i.status === 'In Progress').length,
      resolved: project.issues.filter(i => i.status === 'Resolved').length,
      closed: project.issues.filter(i => i.status === 'Closed').length,
      bySeverity: {
        critical: project.issues.filter(i => i.severity === 'Critical').length,
        high: project.issues.filter(i => i.severity === 'High').length,
        medium: project.issues.filter(i => i.severity === 'Medium').length,
        low: project.issues.filter(i => i.severity === 'Low').length
      },
      averageResolutionTime: project.issues
        .filter(i => i.status === 'Resolved' && i.resolvedDate)
        .reduce((sum, i) => sum + (i.resolvedDate - i.reportedDate), 0) / project.issues.filter(i => i.status === 'Resolved').length || 0
    };

    // Budget analytics
    const budgetAnalytics = project.resources && project.resources.budget ? {
      allocated: project.resources.budget.allocated,
      spent: project.resources.budget.spent,
      remaining: project.resources.budget.remaining,
      utilizationRate: (project.resources.budget.spent / project.resources.budget.allocated) * 100,
      burnRate: project.resources.budget.spent / Math.ceil((new Date() - project.timeline.startDate) / (1000 * 60 * 60 * 24)),
      projectedTotal: project.resources.budget.spent + 
        (project.resources.budget.spent / Math.ceil((new Date() - project.timeline.startDate) / (1000 * 60 * 60 * 24))) * 
        Math.ceil((project.timeline.endDate - new Date()) / (1000 * 60 * 60 * 24)),
      isOverBudget: project.resources.budget.spent > project.resources.budget.allocated
    } : null;

    // Team analytics
    const teamStats = {
      totalMembers: project.teamMembers.length,
      byRole: project.teamMembers.reduce((acc, member) => {
        acc[member.role] = (acc[member.role] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: {
        project: {
          _id: project._id,
          name: project.name,
          code: project.code,
          status: project.status,
          priority: project.priority,
          progress: project.progress
        },
        healthScore,
        timelineAnalysis,
        milestones: milestoneStats,
        tasks: taskStats,
        risks: riskStats,
        issues: issueStats,
        budget: budgetAnalytics,
        team: teamStats,
        changeRequests: {
          total: project.changeRequests.length,
          pending: project.changeRequests.filter(cr => cr.status === 'Pending').length,
          approved: project.changeRequests.filter(cr => cr.status === 'Approved').length,
          rejected: project.changeRequests.filter(cr => cr.status === 'Rejected').length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching project analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project analytics',
      error: error.message
    });
  }
};

// Add risk to project
const addProjectRisk = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, category, probability, impact, mitigation, contingency } = req.body;

    const project = await Project.findById(projectId);
    if (!project || !project.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    project.risks.push({
      title,
      description,
      category,
      probability,
      impact,
      mitigation,
      contingency,
      owner: req.user.userId,
      identifiedDate: new Date(),
      status: 'Identified'
    });

    project.updatedBy = req.user.userId;
    await project.save();

    res.json({
      success: true,
      message: 'Risk added successfully',
      data: project.risks[project.risks.length - 1]
    });

  } catch (error) {
    console.error('Error adding risk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add risk',
      error: error.message
    });
  }
};


// Update risk status
const updateRiskStatus = async (req, res) => {
  try {
    const { projectId, riskId } = req.params;
    const { status, notes } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const risk = project.risks.id(riskId);
    if (!risk) {
      return res.status(404).json({
        success: false,
        message: 'Risk not found'
      });
    }

    risk.status = status;
    if (status === 'Closed') {
      risk.closedDate = new Date();
    }

    project.updatedBy = req.user.userId;
    await project.save();

    res.json({
      success: true,
      message: 'Risk status updated',
      data: risk
    });

  } catch (error) {
    console.error('Error updating risk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update risk',
      error: error.message
    });
  }
};

// Add issue to project
const addProjectIssue = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, severity, assignedTo } = req.body;

    const project = await Project.findById(projectId);
    if (!project || !project.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    project.issues.push({
      title,
      description,
      severity,
      assignedTo,
      reportedBy: req.user.userId,
      reportedDate: new Date(),
      status: 'Open'
    });

    project.updatedBy = req.user.userId;
    await project.save();

    res.json({
      success: true,
      message: 'Issue added successfully',
      data: project.issues[project.issues.length - 1]
    });

  } catch (error) {
    console.error('Error adding issue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add issue',
      error: error.message
    });
  }
};

// Resolve issue
const resolveIssue = async (req, res) => {
  try {
    const { projectId, issueId } = req.params;
    const { resolution } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const issue = project.issues.id(issueId);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    issue.status = 'Resolved';
    issue.resolution = resolution;
    issue.resolvedDate = new Date();

    project.updatedBy = req.user.userId;
    await project.save();

    res.json({
      success: true,
      message: 'Issue resolved',
      data: issue
    });

  } catch (error) {
    console.error('Error resolving issue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve issue',
      error: error.message
    });
  }
};

// Add change request
const addChangeRequest = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, type, impact, justification } = req.body;

    const project = await Project.findById(projectId);
    if (!project || !project.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    project.changeRequests.push({
      title,
      description,
      type,
      impact,
      justification,
      requestedBy: req.user.userId,
      requestDate: new Date(),
      status: 'Pending'
    });

    project.updatedBy = req.user.userId;
    await project.save();

    res.json({
      success: true,
      message: 'Change request submitted',
      data: project.changeRequests[project.changeRequests.length - 1]
    });

  } catch (error) {
    console.error('Error adding change request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add change request',
      error: error.message
    });
  }
};

// Approve/Reject change request
const processChangeRequest = async (req, res) => {
  try {
    const { projectId, changeRequestId } = req.params;
    const { decision, comments } = req.body;

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const changeRequest = project.changeRequests.id(changeRequestId);
    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        message: 'Change request not found'
      });
    }

    changeRequest.status = decision === 'approve' ? 'Approved' : 'Rejected';
    changeRequest.approvedBy = req.user.userId;
    changeRequest.approvalDate = new Date();

    project.updatedBy = req.user.userId;
    await project.save();

    res.json({
      success: true,
      message: `Change request ${decision}d`,
      data: changeRequest
    });

  } catch (error) {
    console.error('Error processing change request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process change request',
      error: error.message
    });
  }
};

// Log meeting
const logProjectMeeting = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, date, duration, attendees, agenda, minutes, actionItems } = req.body;

    const project = await Project.findById(projectId);
    if (!project || !project.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    project.meetings.push({
      title,
      date: new Date(date),
      duration,
      attendees,
      agenda,
      minutes,
      actionItems,
      organizer: req.user.userId
    });

    project.updatedBy = req.user.userId;
    await project.save();

    res.json({
      success: true,
      message: 'Meeting logged successfully',
      data: project.meetings[project.meetings.length - 1]
    });

  } catch (error) {
    console.error('Error logging meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log meeting',
      error: error.message
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

// Get dashboard statistics for projects
const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;

        console.log('=== GET PROJECT DASHBOARD STATS ===');
        console.log('User:', userId);
        console.log('Role:', userRole);

        // Get projects based on user role
        let projectQuery = { isActive: true };
        
        // For supervisors and below, only show their projects
        if (!['admin', 'supply_chain', 'project'].includes(userRole)) {
            projectQuery.$or = [
                { projectManager: userId },
                { 'milestones.assignedSupervisor': userId }
            ];
        }

        const projects = await Project.find(projectQuery);

        const stats = {
            pending: projects.filter(p => p.status === 'Planning').length,
            inProgress: projects.filter(p => p.status === 'In Progress').length,
            completed: projects.filter(p => p.status === 'Completed').length,
            total: projects.length
        };

        console.log('Project Stats:', stats);

        res.status(200).json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error fetching project dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch project dashboard stats',
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
    getDashboardStats,
    searchProjects,
    getUserProjects,
    getProjectsByDepartment,
    deleteProject,
    getSupervisorMilestones,
    getMilestoneDetails,
    completeMilestone,
    getProjectAnalytics,
    addProjectRisk,
    updateRiskStatus,
    addProjectIssue,
    resolveIssue,
    addChangeRequest,
    processChangeRequest,
    logProjectMeeting
};






