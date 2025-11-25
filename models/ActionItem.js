const mongoose = require('mongoose');

const ActionItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters']
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    required: [true, 'Priority is required'],
    default: 'MEDIUM'
  },
  status: {
    type: String,
    enum: [
      'Pending Approval',
      'Not Started',
      'In Progress',
      'Pending L1 Grading',      
      'Pending L2 Review', 
      'Pending L3 Final Approval', 
      'Completed',
      'Rejected',
      'On Hold'
    ],
    default: 'Pending Approval'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  
  // Assignment - Support multiple assignees
  assignedTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Individual grading per assignee
    completionGrade: {
      score: {
        type: Number,
        min: 1.0,  // Changed from 1
        max: 5.0,  // Changed from 5
        default: null
      },
      effectiveScore: {
        type: Number,
        default: null
      },
      qualityNotes: String,
      gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      gradedAt: Date
    },
    // Individual completion tracking
    completionStatus: {
      type: String,
      enum: ['pending', 'submitted', 'approved', 'rejected'],
      default: 'pending'
    },
    completionDocuments: [{
      name: String,
      url: String,
      publicId: String,
      localPath: String,
      size: Number,
      mimetype: String,
      uploadedAt: Date
    }],
    completionNotes: String,
    submittedAt: Date,

    // Three-level approval chain
    completionApprovalChain: [{
      level: {
        type: Number,
        enum: [1, 2, 3],
        required: true
      },
      approver: {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        name: String,
        email: String,
        role: String // 'immediate_supervisor', 'supervisor_supervisor', 'project_creator'
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'skipped'],
        default: 'pending'
      },
      grade: {
        type: Number,
        min: 1.0,
        max: 5.0,
        default: null
      },
      comments: String,
      reviewedAt: Date
    }]
  }],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Immediate supervisor
  supervisor: {
    name: String,
    email: String,
    department: String
  },
  
  // Creation approval
  creationApproval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalDate: Date,
    comments: String
  },
  
  // Milestone relationship
  milestoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project.milestones',
    default: null
  },
  
  // Task weight (percentage of milestone)
  taskWeight: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    required: function() {
      return this.milestoneId != null;
    }
  },
  
  // Project Association
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  
  // Link to multiple KPIs
  linkedKPIs: [{
    kpiDocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuarterlyKPI',
      required: true
    },
    kpiIndex: {
      type: Number,
      required: true
    },
    kpiTitle: String,
    kpiWeight: Number,
    // Track contribution to this specific KPI
    contributionToKPI: {
      type: Number,
      default: 0
    }
  }],
  
  notes: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  completedDate: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Activity log
  activityLog: [{
    action: {
      type: String,
      enum: [
        'created',
        'creation_approved',
        'creation_rejected',
        'updated',
        'status_changed',
        'progress_updated',
        'assignee_added',
        'assignee_removed',
        'submitted_for_completion',
        'l1_graded',              // NEW
        'l2_reviewed',            // NEW
        'l3_approved',            // NEW
        'completion_approved',
        'completion_rejected',
        'reassigned'
      ]
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ActionItemSchema.index({ 'assignedTo.user': 1, status: 1 });
ActionItemSchema.index({ 'supervisor.email': 1, status: 1 });
ActionItemSchema.index({ projectId: 1, status: 1 });
ActionItemSchema.index({ milestoneId: 1, status: 1 });
ActionItemSchema.index({ dueDate: 1, status: 1 });
ActionItemSchema.index({ priority: 1, status: 1 });
ActionItemSchema.index({ status: 1, createdAt: -1 });
ActionItemSchema.index({ 'linkedKPIs.kpiDocId': 1 });
ActionItemSchema.index({ 'assignedTo.completionApprovalChain.approver.userId': 1 });

// Virtual for display ID
ActionItemSchema.virtual('displayId').get(function() {
  return `TASK-${this._id.toString().slice(-6).toUpperCase()}`;
});

// Virtual for overdue status
ActionItemSchema.virtual('isOverdue').get(function() {
  if (['Completed'].includes(this.status)) return false;
  return this.dueDate && new Date(this.dueDate) < new Date();
});

// Virtual for overall completion status
ActionItemSchema.virtual('overallCompletionStatus').get(function() {
  if (this.assignedTo.length === 0) return 'pending';
  
  const allApproved = this.assignedTo.every(a => a.completionStatus === 'approved');
  const anyRejected = this.assignedTo.some(a => a.completionStatus === 'rejected');
  const anySubmitted = this.assignedTo.some(a => a.completionStatus === 'submitted');
  
  if (allApproved) return 'approved';
  if (anyRejected) return 'rejected';
  if (anySubmitted) return 'submitted';
  return 'pending';
});

// Methods
ActionItemSchema.methods.logActivity = function(action, performedBy, details, oldValue = null, newValue = null) {
  this.activityLog.push({
    action,
    performedBy,
    timestamp: new Date(),
    details,
    oldValue,
    newValue
  });
};

ActionItemSchema.methods.approveCreation = function(userId, comments) {
  const oldStatus = this.status;
  this.status = 'Not Started';
  this.creationApproval.status = 'approved';
  this.creationApproval.approvedBy = userId;
  this.creationApproval.approvalDate = new Date();
  this.creationApproval.comments = comments || '';
  
  this.logActivity('creation_approved', userId, 
    `Task creation approved${comments ? ': ' + comments : ''}`, oldStatus, this.status);
};

ActionItemSchema.methods.rejectCreation = function(userId, comments) {
  const oldStatus = this.status;
  this.status = 'Rejected';
  this.creationApproval.status = 'rejected';
  this.creationApproval.approvedBy = userId;
  this.creationApproval.approvalDate = new Date();
  this.creationApproval.comments = comments || 'Task creation rejected';
  
  this.logActivity('creation_rejected', userId, 
    `Task creation rejected: ${comments}`, oldStatus, this.status);
};

// Submit completion for specific assignee
ActionItemSchema.methods.submitCompletionForAssignee = function(userId, assigneeUserId, documents, notes) {
  const assignee = this.assignedTo.find(a => a.user.equals(assigneeUserId));
  if (!assignee) {
    throw new Error('Assignee not found');
  }

  assignee.completionStatus = 'submitted';
  assignee.completionDocuments = documents || [];
  assignee.completionNotes = notes || '';
  assignee.submittedAt = new Date();

  // Update task status if this is the first submission
  if (this.status !== 'Pending Completion Approval') {
    this.status = 'Pending Completion Approval';
  }

  this.logActivity('submitted_for_completion', userId, 
    `Completion submitted by assignee ${assigneeUserId}`);
};

// Approve completion for specific assignee
ActionItemSchema.methods.approveCompletionForAssignee = async function(userId, assigneeUserId, grade, qualityNotes, comments) {
  const assignee = this.assignedTo.find(a => a.user.equals(assigneeUserId));
  if (!assignee) {
    throw new Error('Assignee not found');
  }

  // ✅ Calculate effective score with decimal precision
  const effectiveScore = parseFloat(((grade / 5.0) * this.taskWeight).toFixed(2));

  assignee.completionStatus = 'approved';
  assignee.completionGrade = {
    score: parseFloat(grade.toFixed(1)), // Store with 1 decimal place
    effectiveScore: effectiveScore,
    qualityNotes: qualityNotes || '',
    gradedBy: userId,
    gradedAt: new Date()
  };

  this.logActivity('completion_approved', userId, 
    `Completion approved for assignee with grade ${grade.toFixed(1)}/5.0 (Effective: ${effectiveScore}%)`);

  // Check if all assignees are approved
  const allApproved = this.assignedTo.every(a => a.completionStatus === 'approved');
  if (allApproved) {
    this.status = 'Completed';
    this.completedDate = new Date();
    this.completedBy = userId;
    this.progress = 100;
  }

  // Update KPI achievements for this assignee
  await this.updateKPIAchievements(assigneeUserId, grade);

  // Update milestone and project progress
  if (this.milestoneId) {
    await this.updateMilestoneProgress();
  }
};

// Reject completion for specific assignee
ActionItemSchema.methods.rejectCompletionForAssignee = function(userId, assigneeUserId, comments) {
  const assignee = this.assignedTo.find(a => a.user.equals(assigneeUserId));
  if (!assignee) {
    throw new Error('Assignee not found');
  }

  assignee.completionStatus = 'rejected';
  assignee.completionGrade = {
    qualityNotes: comments || 'Needs revision',
    gradedBy: userId,
    gradedAt: new Date()
  };

  // Set status back to In Progress
  this.status = 'In Progress';

  this.logActivity('completion_rejected', userId, 
    `Completion rejected for assignee: ${comments}`);
};

// Update KPI achievements - with decimal support
ActionItemSchema.methods.updateKPIAchievements = async function(assigneeUserId, grade) {
  const QuarterlyKPI = mongoose.model('QuarterlyKPI');

  for (const linkedKPI of this.linkedKPIs) {
    const kpiDoc = await QuarterlyKPI.findById(linkedKPI.kpiDocId);
    if (!kpiDoc) continue;

    const kpi = kpiDoc.kpis[linkedKPI.kpiIndex];
    if (!kpi) continue;

    const contribution = parseFloat((((grade / 5.0) * (linkedKPI.kpiWeight / 100)) * 100).toFixed(2));
    
    kpi.achievement = (kpi.achievement || 0) + contribution;
    kpi.achievement = Math.min(100, parseFloat(kpi.achievement.toFixed(2)));

    linkedKPI.contributionToKPI = contribution;

    await kpiDoc.save();
  }
};


// Update milestone progress
ActionItemSchema.methods.updateMilestoneProgress = async function() {
  if (!this.milestoneId) return;

  const Project = mongoose.model('Project');
  const project = await Project.findOne({ 'milestones._id': this.milestoneId });
  
  if (!project) return;

  await project.recalculateMilestoneProgress(this.milestoneId);
  await project.save();
};

ActionItemSchema.methods.updateProgress = function(progress, userId) {
  const oldProgress = this.progress;
  this.progress = Math.max(0, Math.min(100, progress));
  
  if (this.progress === 0 && this.status === 'Not Started') {
    // Keep as Not Started
  } else if (this.progress > 0 && this.progress < 100 && this.status === 'Not Started') {
    this.status = 'In Progress';
  }
  
  this.logActivity('progress_updated', userId, 
    `Progress updated from ${oldProgress}% to ${this.progress}%`, oldProgress, this.progress);
};

// Update task status
ActionItemSchema.methods.updateStatus = function(status, userId, notes) {
  const oldStatus = this.status;
  
  const validStatuses = [
    'Not Started',
    'In Progress',
    'Completed',
    'On Hold'
  ];
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  
  this.status = status;
  
  if (status === 'Completed') {
    this.progress = 100;
    this.completedDate = new Date();
    this.completedBy = userId;
  } else if (status === 'In Progress' && this.progress === 0) {
    this.progress = 10;
  } else if (status === 'Not Started') {
    this.progress = 0;
  }
  
  this.logActivity('status_changed', userId, 
    `Status changed from ${oldStatus} to ${status}${notes ? ': ' + notes : ''}`,
    oldStatus,
    status
  );
};

module.exports = mongoose.model('ActionItem', ActionItemSchema);

