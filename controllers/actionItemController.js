const ActionItem = require('../models/ActionItem');
const User = require('../models/User');
const Project = require('../models/Project');
const { sendActionItemEmail } = require('../services/emailService');

// Get action items based on user role and filters
const getActionItems = async (req, res) => {
  try {
    const { status, priority, projectId, assignedTo, view, page = 1, limit = 50 } = req.query;
    const user = await User.findById(req.user.userId);

    console.log('=== GET ACTION ITEMS ===');
    console.log(`User: ${user.fullName} (${user.role})`);
    console.log(`View: ${view || 'default'}`);

    let filter = {};

    // Apply view-based filters
    if (view === 'my-tasks') {
      filter.assignedTo = req.user.userId;
    } else if (view === 'team-tasks') {
      if (['supply_chain', 'admin'].includes(user.role)) {
        // Supply chain and admin see all tasks
      } else if (user.role === 'supervisor') {
        // Supervisors see their department's tasks
        const departmentUsers = await User.find({ department: user.department }).select('_id');
        filter.assignedTo = { $in: departmentUsers.map(u => u._id) };
      } else {
        // Regular employees see only their own tasks
        filter.assignedTo = req.user.userId;
      }
    } else if (view === 'project-tasks') {
      if (projectId) {
        filter.projectId = projectId;
      } else {
        filter.projectId = { $ne: null };
      }
    } else if (view === 'standalone-tasks') {
      filter.projectId = null;
    } else {
      // Default: show user's own tasks
      filter.assignedTo = req.user.userId;
    }

    // Apply additional filters
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (projectId && view !== 'project-tasks') filter.projectId = projectId;
    if (assignedTo) filter.assignedTo = assignedTo;

    console.log('Filter:', JSON.stringify(filter, null, 2));

    const tasks = await ActionItem.find(filter)
      .populate('assignedTo', 'fullName email department position')
      .populate('assignedBy', 'fullName email')
      .populate('projectId', 'name code department')
      .populate('completedBy', 'fullName email')
      .sort({ dueDate: 1, priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ActionItem.countDocuments(filter);

    console.log(`Found ${tasks.length} action items`);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: tasks.length,
        totalRecords: total
      }
    });

  } catch (error) {
    console.error('Get action items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch action items',
      error: error.message
    });
  }
};

// Get action item statistics
const getActionItemStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    let filter = {};

    // Filter based on user role
    if (['supply_chain', 'admin'].includes(user.role)) {
      // See all tasks
    } else if (user.role === 'supervisor') {
      const departmentUsers = await User.find({ department: user.department }).select('_id');
      filter.assignedTo = { $in: departmentUsers.map(u => u._id) };
    } else {
      filter.assignedTo = req.user.userId;
    }

    const [total, notStarted, inProgress, completed, onHold, overdue] = await Promise.all([
      ActionItem.countDocuments(filter),
      ActionItem.countDocuments({ ...filter, status: 'Not Started' }),
      ActionItem.countDocuments({ ...filter, status: 'In Progress' }),
      ActionItem.countDocuments({ ...filter, status: 'Completed' }),
      ActionItem.countDocuments({ ...filter, status: 'On Hold' }),
      ActionItem.countDocuments({
        ...filter,
        status: { $ne: 'Completed' },
        dueDate: { $lt: new Date() }
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        notStarted,
        inProgress,
        completed,
        onHold,
        overdue,
        pending: notStarted + inProgress
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

// // Create new action item
// const createActionItem = async (req, res) => {
//   try {
//     const { title, description, priority, dueDate, projectId, assignedTo, notes, tags } = req.body;

//     console.log('=== CREATE ACTION ITEM ===');
//     console.log('Title:', title);
//     console.log('Assigned To:', assignedTo);

//     // Validate inputs
//     if (!title || !description || !priority || !dueDate) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: title, description, priority, or dueDate'
//       });
//     }

//     // Validate project if provided
//     let project = null;
//     if (projectId) {
//       project = await Project.findById(projectId);
//       if (!project) {
//         return res.status(404).json({
//           success: false,
//           message: 'Project not found'
//         });
//       }
//     }

//     // Determine assignee
//     const targetUserId = assignedTo || req.user.userId;
//     const targetUser = await User.findById(targetUserId);

//     if (!targetUser) {
//       return res.status(404).json({
//         success: false,
//         message: 'Assigned user not found'
//       });
//     }

//     // Create action item
//     const actionItem = new ActionItem({
//       title,
//       description,
//       priority,
//       dueDate: new Date(dueDate),
//       projectId: project ? project._id : null,
//       assignedTo: targetUser._id,
//       assignedBy: req.user.userId,
//       notes: notes || '',
//       tags: tags || [],
//       status: 'Not Started',
//       progress: 0
//     });

//     // Log creation activity
//     actionItem.logActivity('created', req.user.userId, `Task created and assigned to ${targetUser.fullName}`);

//     await actionItem.save();

//     // Populate references
//     await actionItem.populate([
//       { path: 'assignedTo', select: 'fullName email department' },
//       { path: 'assignedBy', select: 'fullName email' },
//       { path: 'projectId', select: 'name code' }
//     ]);

//     console.log(`✅ Action item created: ${actionItem.displayId}`);

//     // Send notification email
//     if (targetUser._id.toString() !== req.user.userId.toString()) {
//       const creator = await User.findById(req.user.userId);
      
//       await sendActionItemEmail.taskAssigned(
//         targetUser.email,
//         targetUser.fullName,
//         creator.fullName,
//         title,
//         description,
//         priority,
//         dueDate,
//         actionItem._id,
//         project ? project.name : null
//       ).catch(err => console.error('Failed to send assignment email:', err));
//     }

//     res.status(201).json({
//       success: true,
//       message: 'Action item created successfully',
//       data: actionItem
//     });

//   } catch (error) {
//     console.error('Create action item error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to create action item',
//       error: error.message
//     });
//   }
// };


// Create new action item (COMPLETE REPLACEMENT)
const createActionItem = async (req, res) => {
  try {
    const { title, description, priority, dueDate, projectId, notes, tags } = req.body;

    console.log('=== CREATE ACTION ITEM ===');
    console.log('Title:', title);
    console.log('Created By:', req.user.userId);

    // Validate inputs
    if (!title || !description || !priority || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, priority, or dueDate'
      });
    }

    const creator = await User.findById(req.user.userId);
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get immediate supervisor for this employee
    const supervisor = getTaskSupervisor(creator.fullName, creator.department);
    
    if (!supervisor) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine your immediate supervisor. Please contact HR for assistance.'
      });
    }

    console.log(`Immediate Supervisor: ${supervisor.name} (${supervisor.email})`);

    // Validate project if provided
    let project = null;
    if (projectId) {
      project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
    }

    // Create action item (assigned to self, pending supervisor approval)
    const actionItem = new ActionItem({
      title,
      description,
      priority,
      dueDate: new Date(dueDate),
      projectId: project ? project._id : null,
      assignedTo: req.user.userId,
      createdBy: req.user.userId,
      notes: notes || '',
      tags: tags || [],
      status: 'Pending Approval', // Must be approved before starting
      progress: 0,
      supervisor: {
        name: supervisor.name,
        email: supervisor.email,
        department: supervisor.department
      },
      creationApproval: {
        status: 'pending'
      },
      completionApproval: {
        status: 'not_submitted'
      }
    });

    // Log creation activity
    actionItem.logActivity('created', req.user.userId, `Task created by ${creator.fullName} - pending supervisor approval`);

    await actionItem.save();

    // Populate references
    await actionItem.populate([
      { path: 'assignedTo', select: 'fullName email department' },
      { path: 'createdBy', select: 'fullName email' },
      { path: 'projectId', select: 'name code' }
    ]);

    console.log(`✅ Action item created: ${actionItem.displayId}`);

    // Send notification to supervisor for approval
    try {
      await sendActionItemEmail.taskCreationApproval(
        supervisor.email,
        supervisor.name,
        creator.fullName,
        title,
        description,
        priority,
        dueDate,
        actionItem._id,
        project ? project.name : null
      );
      console.log(`✅ Approval notification sent to supervisor: ${supervisor.email}`);
    } catch (emailError) {
      console.error('Failed to send supervisor notification:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Task created and sent to your supervisor for approval',
      data: actionItem
    });

  } catch (error) {
    console.error('Create action item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create action item',
      error: error.message
    });
  }
};


// Approve/Reject task CREATION (NEW FUNCTION - ADD THIS)
const processCreationApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;

    console.log('=== TASK CREATION APPROVAL DECISION ===');
    console.log('Task ID:', id);
    console.log('Decision:', decision);

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be "approve" or "reject"'
      });
    }

    const user = await User.findById(req.user.userId);
    const actionItem = await ActionItem.findById(id)
      .populate('assignedTo', 'fullName email department')
      .populate('createdBy', 'fullName email');

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: 'Action item not found'
      });
    }

    // Check if this user is the supervisor
    if (actionItem.supervisor.email !== user.email && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the immediate supervisor can approve this task'
      });
    }

    // Check if task is pending approval
    if (actionItem.status !== 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: 'Task is not pending approval'
      });
    }

    if (decision === 'approve') {
      actionItem.approveCreation(req.user.userId, comments);
      
      // Send notification to employee
      try {
        await sendActionItemEmail.taskCreationApproved(
          actionItem.assignedTo.email,
          actionItem.assignedTo.fullName,
          user.fullName,
          actionItem.title,
          actionItem._id,
          comments
        );
      } catch (emailError) {
        console.error('Failed to send approval notification:', emailError);
      }

      console.log('✅ Task CREATION APPROVED - Employee can now start work');
    } else {
      actionItem.rejectCreation(req.user.userId, comments);
      
      // Send notification to employee
      try {
        await sendActionItemEmail.taskCreationRejected(
          actionItem.assignedTo.email,
          actionItem.assignedTo.fullName,
          user.fullName,
          actionItem.title,
          actionItem._id,
          comments
        );
      } catch (emailError) {
        console.error('Failed to send rejection notification:', emailError);
      }

      console.log('❌ Task CREATION REJECTED');
    }

    await actionItem.save();

    console.log('=== CREATION APPROVAL DECISION PROCESSED ===');

    res.json({
      success: true,
      message: `Task creation ${decision}d`,
      data: actionItem
    });

  } catch (error) {
    console.error('Creation approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process creation approval',
      error: error.message
    });
  }
};


// Submit task for COMPLETION approval (COMPLETE REPLACEMENT)
const submitForCompletion = async (req, res) => {
  try {
    const { id } = req.params;
    const { completionNotes } = req.body;

    console.log('=== SUBMIT TASK FOR COMPLETION APPROVAL ===');
    console.log('Task ID:', id);
    console.log('Files:', req.files?.length || 0);

    const actionItem = await ActionItem.findById(id)
      .populate('assignedTo', 'fullName email department')
      .populate('createdBy', 'fullName email');

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: 'Action item not found'
      });
    }

    // Check permissions
    if (!actionItem.assignedTo._id.equals(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned person can submit this task for completion approval'
      });
    }

    // Check if task can be submitted
    if (actionItem.status === 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: 'Task must be approved by supervisor before you can work on it'
      });
    }

    if (actionItem.status === 'Pending Completion Approval') {
      return res.status(400).json({
        success: false,
        message: 'Task is already pending completion approval'
      });
    }

    if (actionItem.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Task is already completed and approved'
      });
    }

    if (actionItem.status === 'Rejected') {
      return res.status(400).json({
        success: false,
        message: 'Task creation was rejected. Please create a new task.'
      });
    }

    // Process completion documents
    let documents = [];
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} completion documents`);

      const uploadDir = path.join(__dirname, '../uploads/action-items');

      try {
        await fs.promises.mkdir(uploadDir, { recursive: true });
        console.log(`✓ Upload directory ready: ${uploadDir}`);
      } catch (dirError) {
        console.error('Failed to create upload directory:', dirError);
        throw new Error('Failed to prepare upload directory');
      }

      for (const file of req.files) {
        try {
          console.log(`Processing file: ${file.originalname}`);

          const timestamp = Date.now();
          const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileName = `${timestamp}-${sanitizedName}`;
          const filePath = path.join(uploadDir, fileName);

          if (!file.path || !fs.existsSync(file.path)) {
            console.error(`Temp file not found: ${file.path}`);
            continue;
          }

          await fs.promises.rename(file.path, filePath);

          console.log(`✓ File saved: ${fileName}`);

          documents.push({
            name: file.originalname,
            url: `/uploads/action-items/${fileName}`,
            publicId: fileName,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date()
          });
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          
          if (file.path && fs.existsSync(file.path)) {
            try {
              await fs.promises.unlink(file.path);
            } catch (cleanupError) {
              console.error('Failed to clean up temp file:', cleanupError);
            }
          }
          continue;
        }
      }

      console.log(`Successfully processed ${documents.length} documents`);
    }

    // Submit for completion approval
    actionItem.submitForCompletion(req.user.userId, documents, completionNotes);
    await actionItem.save();

    // Send notification to supervisor
    try {
      await sendActionItemEmail.taskCompletionApproval(
        actionItem.supervisor.email,
        actionItem.supervisor.name,
        actionItem.assignedTo.fullName,
        actionItem.title,
        actionItem.description,
        actionItem._id,
        documents.length,
        completionNotes
      );
      console.log(`✅ Completion approval notification sent to supervisor: ${actionItem.supervisor.email}`);
    } catch (emailError) {
      console.error('Failed to send supervisor notification:', emailError);
    }

    console.log('=== TASK SUBMITTED FOR COMPLETION APPROVAL ===');

    res.json({
      success: true,
      message: 'Task submitted for supervisor completion approval',
      data: actionItem,
      documentsUploaded: {
        count: documents.length,
        files: documents.map(d => ({ name: d.name, size: d.size }))
      }
    });

  } catch (error) {
    console.error('Submit for completion error:', error);

    // Clean up uploaded files if submission failed
    if (req.files && req.files.length > 0) {
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path && fs.existsSync(file.path)) {
            return fs.promises.unlink(file.path).catch(e => console.error('File cleanup failed:', e));
          }
        })
      );
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit task for completion approval',
      error: error.message
    });
  }
};



// Approve/Reject task COMPLETION (COMPLETE REPLACEMENT)
const processCompletionApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;

    console.log('=== TASK COMPLETION APPROVAL DECISION ===');
    console.log('Task ID:', id);
    console.log('Decision:', decision);

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be "approve" or "reject"'
      });
    }

    const user = await User.findById(req.user.userId);
    const actionItem = await ActionItem.findById(id)
      .populate('assignedTo', 'fullName email department')
      .populate('createdBy', 'fullName email');

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: 'Action item not found'
      });
    }

    // Check if this user is the supervisor
    if (actionItem.supervisor.email !== user.email && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the immediate supervisor can approve task completion'
      });
    }

    // Check if task is pending completion approval
    if (actionItem.status !== 'Pending Completion Approval') {
      return res.status(400).json({
        success: false,
        message: 'Task is not pending completion approval'
      });
    }

    if (decision === 'approve') {
      actionItem.approveCompletion(req.user.userId, comments);
      
      // Send notification to employee
      try {
        await sendActionItemEmail.taskCompletionApproved(
          actionItem.assignedTo.email,
          actionItem.assignedTo.fullName,
          user.fullName,
          actionItem.title,
          actionItem._id,
          comments
        );
      } catch (emailError) {
        console.error('Failed to send approval notification:', emailError);
      }

      console.log('✅ Task COMPLETION APPROVED - Task is now COMPLETED');
    } else {
      actionItem.rejectCompletion(req.user.userId, comments);
      
      // Send notification to employee
      try {
        await sendActionItemEmail.taskCompletionRejected(
          actionItem.assignedTo.email,
          actionItem.assignedTo.fullName,
          user.fullName,
          actionItem.title,
          actionItem._id,
          comments
        );
      } catch (emailError) {
        console.error('Failed to send rejection notification:', emailError);
      }

      console.log('❌ Task COMPLETION REJECTED - Sent back for revision');
    }

    await actionItem.save();

    console.log('=== COMPLETION APPROVAL DECISION PROCESSED ===');

    res.json({
      success: true,
      message: `Task completion ${decision}d`,
      data: actionItem
    });

  } catch (error) {
    console.error('Completion approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process completion approval',
      error: error.message
    });
  }
};


// Update action item
const updateActionItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, projectId, notes, tags } = req.body;

    const actionItem = await ActionItem.findById(id);

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: 'Action item not found'
      });
    }

    // Check permissions
    const user = await User.findById(req.user.userId);
    const canEdit = 
      actionItem.assignedTo.equals(req.user.userId) ||
      actionItem.assignedBy.equals(req.user.userId) ||
      ['supply_chain', 'admin'].includes(user.role);

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this task'
      });
    }

    // Track changes
    const changes = [];
    if (title && title !== actionItem.title) {
      changes.push(`Title changed from "${actionItem.title}" to "${title}"`);
      actionItem.title = title;
    }
    if (description && description !== actionItem.description) {
      actionItem.description = description;
      changes.push('Description updated');
    }
    if (priority && priority !== actionItem.priority) {
      changes.push(`Priority changed from ${actionItem.priority} to ${priority}`);
      actionItem.priority = priority;
    }
    if (dueDate && new Date(dueDate).getTime() !== actionItem.dueDate.getTime()) {
      changes.push(`Due date changed`);
      actionItem.dueDate = new Date(dueDate);
    }
    if (notes !== undefined) actionItem.notes = notes;
    if (tags) actionItem.tags = tags;

    // Handle project change
    if (projectId !== undefined) {
      if (projectId && projectId !== actionItem.projectId?.toString()) {
        const project = await Project.findById(projectId);
        if (!project) {
          return res.status(404).json({
            success: false,
            message: 'Project not found'
          });
        }
        actionItem.projectId = project._id;
        changes.push(`Assigned to project: ${project.name}`);
      } else if (projectId === null && actionItem.projectId) {
        changes.push('Removed from project');
        actionItem.projectId = null;
      }
    }

    if (changes.length > 0) {
      actionItem.logActivity('updated', req.user.userId, changes.join('; '));
    }

    await actionItem.save();
    await actionItem.populate([
      { path: 'assignedTo', select: 'fullName email department' },
      { path: 'assignedBy', select: 'fullName email' },
      { path: 'projectId', select: 'name code' }
    ]);

    res.json({
      success: true,
      message: 'Action item updated successfully',
      data: actionItem
    });

  } catch (error) {
    console.error('Update action item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update action item',
      error: error.message
    });
  }
};

// Update progress
const updateProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, notes } = req.body;

    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({
        success: false,
        message: 'Progress must be between 0 and 100'
      });
    }

    const actionItem = await ActionItem.findById(id);

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: 'Action item not found'
      });
    }

    // Check permissions
    const user = await User.findById(req.user.userId);
    const canUpdate = 
      actionItem.assignedTo.equals(req.user.userId) ||
      ['supply_chain', 'admin', 'supervisor'].includes(user.role);

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this task'
      });
    }

    const oldProgress = actionItem.progress;
    actionItem.updateProgress(progress, req.user.userId);

    if (notes) {
      actionItem.notes = actionItem.notes ? `${actionItem.notes}\n${notes}` : notes;
    }

    await actionItem.save();
    await actionItem.populate([
      { path: 'assignedTo', select: 'fullName email' },
      { path: 'completedBy', select: 'fullName email' }
    ]);

    // Send notification if task is completed
    if (progress === 100 && oldProgress < 100) {
      await sendActionItemEmail.taskCompleted(
        actionItem.assignedTo.email,
        actionItem.assignedTo.fullName,
        actionItem.title,
        actionItem._id
      ).catch(err => console.error('Failed to send completion email:', err));
    }

    res.json({
      success: true,
      message: 'Progress updated successfully',
      data: actionItem
    });

  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update progress',
      error: error.message
    });
  }
};

// Update status
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const actionItem = await ActionItem.findById(id);

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: 'Action item not found'
      });
    }

    // Check permissions
    const user = await User.findById(req.user.userId);
    const canUpdate = 
      actionItem.assignedTo.equals(req.user.userId) ||
      ['supply_chain', 'admin', 'supervisor'].includes(user.role);

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this task'
      });
    }

    const oldStatus = actionItem.status;
    actionItem.updateStatus(status, req.user.userId, notes || '');

    if (notes) {
      actionItem.notes = actionItem.notes ? `${actionItem.notes}\n${notes}` : notes;
    }

    await actionItem.save();
    await actionItem.populate([
      { path: 'assignedTo', select: 'fullName email' },
      { path: 'completedBy', select: 'fullName email' }
    ]);

    // Send notification if status changed to completed
    if (status === 'Completed' && oldStatus !== 'Completed') {
      await sendActionItemEmail.taskCompleted(
        actionItem.assignedTo.email,
        actionItem.assignedTo.fullName,
        actionItem.title,
        actionItem._id
      ).catch(err => console.error('Failed to send completion email:', err));
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: actionItem
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message
    });
  }
};

// Delete action item
const deleteActionItem = async (req, res) => {
  try {
    const { id } = req.params;

    const actionItem = await ActionItem.findById(id);

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: 'Action item not found'
      });
    }

    // Check permissions
    const user = await User.findById(req.user.userId);
    const canDelete = 
      actionItem.assignedBy.equals(req.user.userId) ||
      ['supply_chain', 'admin'].includes(user.role);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this task'
      });
    }

    await actionItem.deleteOne();

    res.json({
      success: true,
      message: 'Action item deleted successfully'
    });

  } catch (error) {
    console.error('Delete action item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete action item',
      error: error.message
    });
  }
};

// Get single action item
const getActionItem = async (req, res) => {
  try {
    const { id } = req.params;

    const actionItem = await ActionItem.findById(id)
      .populate('assignedTo', 'fullName email department position')
      .populate('assignedBy', 'fullName email department')
      .populate('projectId', 'name code department')
      .populate('completedBy', 'fullName email')
      .populate('activityLog.performedBy', 'fullName email');

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: 'Action item not found'
      });
    }

    // Check permissions
    const user = await User.findById(req.user.userId);
    const canView = 
      actionItem.assignedTo._id.equals(req.user.userId) ||
      actionItem.assignedBy._id.equals(req.user.userId) ||
      ['supply_chain', 'admin'].includes(user.role);

    if (!canView && user.role === 'supervisor') {
      // Supervisors can view tasks in their department
      if (actionItem.assignedTo.department === user.department) {
        // Allow view
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: actionItem
    });

  } catch (error) {
    console.error('Get action item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch action item',
      error: error.message
    });
  }
};

// Get action items by project
const getProjectActionItems = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const tasks = await ActionItem.find({ projectId })
      .populate('assignedTo', 'fullName email department')
      .populate('assignedBy', 'fullName email')
      .sort({ priority: -1, dueDate: 1 });

    res.json({
      success: true,
      data: tasks,
      project: {
        _id: project._id,
        name: project.name,
        code: project.code
      }
    });

  } catch (error) {
    console.error('Get project action items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project action items',
      error: error.message
    });
  }
};

module.exports = {
  getActionItems,
  getActionItemStats,
  createActionItem,
  updateActionItem,
  updateProgress,
  updateStatus,
  deleteActionItem,
  getActionItem,
  getProjectActionItems,
  processCreationApproval,      
  submitForCompletion,           
  processCompletionApproval,
};
