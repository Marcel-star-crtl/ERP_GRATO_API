// backend/models/ActionItem.js

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
      'Pending Completion Approval',
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
        min: 1,
        max: 5,
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
      size: Number,
      mimetype: String,
      uploadedAt: Date
    }],
    completionNotes: String,
    submittedAt: Date
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

  // Calculate effective score
  const effectiveScore = (grade / 5) * this.taskWeight;

  assignee.completionStatus = 'approved';
  assignee.completionGrade = {
    score: grade,
    effectiveScore: effectiveScore,
    qualityNotes: qualityNotes || '',
    gradedBy: userId,
    gradedAt: new Date()
  };

  this.logActivity('completion_approved', userId, 
    `Completion approved for assignee with grade ${grade}/5`);

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

// Update KPI achievements
ActionItemSchema.methods.updateKPIAchievements = async function(assigneeUserId, grade) {
  const QuarterlyKPI = mongoose.model('QuarterlyKPI');

  for (const linkedKPI of this.linkedKPIs) {
    const kpiDoc = await QuarterlyKPI.findById(linkedKPI.kpiDocId);
    if (!kpiDoc) continue;

    const kpi = kpiDoc.kpis[linkedKPI.kpiIndex];
    if (!kpi) continue;

    // Calculate contribution: (grade/5) × (kpiWeight/100) × 100
    const contribution = (grade / 5) * (linkedKPI.kpiWeight / 100) * 100;
    
    kpi.achievement = (kpi.achievement || 0) + contribution;
    kpi.achievement = Math.min(100, kpi.achievement); // Cap at 100%

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

// Update task progress
ActionItemSchema.methods.updateProgress = function(progress, userId) {
  const oldProgress = this.progress;
  this.progress = Math.max(0, Math.min(100, progress));
  
  // Auto-update status based on progress
  if (this.progress === 0 && this.status === 'Not Started') {
    // Keep as Not Started
  } else if (this.progress > 0 && this.progress < 100 && this.status === 'Not Started') {
    this.status = 'In Progress';
  }
  
  this.logActivity('progress_updated', userId, 
    `Progress updated from ${oldProgress}% to ${this.progress}%`, oldProgress, this.progress);
};

// NEW: Update task status
ActionItemSchema.methods.updateStatus = function(status, userId, notes) {
  const oldStatus = this.status;
  
  // Validate status transition
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
  
  // Auto-update progress and completion date based on status
  if (status === 'Completed') {
    this.progress = 100;
    this.completedDate = new Date();
    this.completedBy = userId;
  } else if (status === 'In Progress' && this.progress === 0) {
    this.progress = 10; // Set initial progress
  } else if (status === 'Not Started') {
    this.progress = 0;
  }
  
  // Log the status change
  this.logActivity('status_changed', userId, 
    `Status changed from ${oldStatus} to ${status}${notes ? ': ' + notes : ''}`,
    oldStatus,
    status
  );
};

module.exports = mongoose.model('ActionItem', ActionItemSchema);








// // backend/models/ActionItem.js

// const mongoose = require('mongoose');

// const ActionItemSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: [true, 'Task title is required'],
//     trim: true,
//     minlength: [3, 'Title must be at least 3 characters'],
//     maxlength: [200, 'Title cannot exceed 200 characters']
//   },
//   description: {
//     type: String,
//     required: [true, 'Task description is required'],
//     trim: true,
//     minlength: [10, 'Description must be at least 10 characters']
//   },
//   priority: {
//     type: String,
//     enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
//     required: [true, 'Priority is required'],
//     default: 'MEDIUM'
//   },
//   status: {
//     type: String,
//     enum: [
//       'Pending Approval',
//       'Not Started',
//       'In Progress',
//       'Pending Completion Approval',
//       'Completed',
//       'Rejected',
//       'On Hold'
//     ],
//     default: 'Pending Approval'
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   dueDate: {
//     type: Date,
//     required: [true, 'Due date is required']
//   },
  
//   // Assignment - NEW: Support multiple assignees
//   assignedTo: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true
//     },
//     // Individual grading per assignee
//     completionGrade: {
//       score: {
//         type: Number,
//         min: 1,
//         max: 5,
//         default: null
//       },
//       effectiveScore: {
//         type: Number,
//         default: null
//       },
//       qualityNotes: String,
//       gradedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       },
//       gradedAt: Date
//     },
//     // Individual completion tracking
//     completionStatus: {
//       type: String,
//       enum: ['pending', 'submitted', 'approved', 'rejected'],
//       default: 'pending'
//     },
//     completionDocuments: [{
//       name: String,
//       url: String,
//       publicId: String,
//       size: Number,
//       mimetype: String,
//       uploadedAt: Date
//     }],
//     completionNotes: String,
//     submittedAt: Date
//   }],
  
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
  
//   // Immediate supervisor
//   supervisor: {
//     name: String,
//     email: String,
//     department: String
//   },
  
//   // Creation approval
//   creationApproval: {
//     status: {
//       type: String,
//       enum: ['pending', 'approved', 'rejected'],
//       default: 'pending'
//     },
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     approvalDate: Date,
//     comments: String
//   },
  
//   // NEW: Milestone relationship
//   milestoneId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Project.milestones',
//     default: null
//   },
  
//   // NEW: Task weight (percentage of milestone)
//   taskWeight: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0,
//     required: function() {
//       return this.milestoneId != null;
//     }
//   },
  
//   // Project Association
//   projectId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Project',
//     default: null
//   },
  
//   // NEW: Link to multiple KPIs
//   linkedKPIs: [{
//     kpiDocId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'QuarterlyKPI',
//       required: true
//     },
//     kpiIndex: {
//       type: Number,
//       required: true
//     },
//     kpiTitle: String,
//     kpiWeight: Number,
//     // Track contribution to this specific KPI
//     contributionToKPI: {
//       type: Number,
//       default: 0
//     }
//   }],
  
//   notes: {
//     type: String,
//     default: ''
//   },
//   tags: [{
//     type: String,
//     trim: true
//   }],
  
//   completedDate: Date,
  
//   // Activity log
//   activityLog: [{
//     action: {
//       type: String,
//       enum: [
//         'created',
//         'creation_approved',
//         'creation_rejected',
//         'updated',
//         'status_changed',
//         'progress_updated',
//         'assignee_added',
//         'assignee_removed',
//         'submitted_for_completion',
//         'completion_approved',
//         'completion_rejected',
//         'reassigned'
//       ]
//     },
//     performedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     timestamp: {
//       type: Date,
//       default: Date.now
//     },
//     details: String,
//     oldValue: mongoose.Schema.Types.Mixed,
//     newValue: mongoose.Schema.Types.Mixed
//   }]
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes
// ActionItemSchema.index({ 'assignedTo.user': 1, status: 1 });
// ActionItemSchema.index({ 'supervisor.email': 1, status: 1 });
// ActionItemSchema.index({ projectId: 1, status: 1 });
// ActionItemSchema.index({ milestoneId: 1, status: 1 });
// ActionItemSchema.index({ dueDate: 1, status: 1 });
// ActionItemSchema.index({ priority: 1, status: 1 });
// ActionItemSchema.index({ status: 1, createdAt: -1 });
// ActionItemSchema.index({ 'linkedKPIs.kpiDocId': 1 });

// // Virtual for display ID
// ActionItemSchema.virtual('displayId').get(function() {
//   return `TASK-${this._id.toString().slice(-6).toUpperCase()}`;
// });

// // Virtual for overdue status
// ActionItemSchema.virtual('isOverdue').get(function() {
//   if (['Completed'].includes(this.status)) return false;
//   return this.dueDate && new Date(this.dueDate) < new Date();
// });

// // Virtual for overall completion status
// ActionItemSchema.virtual('overallCompletionStatus').get(function() {
//   if (this.assignedTo.length === 0) return 'pending';
  
//   const allApproved = this.assignedTo.every(a => a.completionStatus === 'approved');
//   const anyRejected = this.assignedTo.some(a => a.completionStatus === 'rejected');
//   const anySubmitted = this.assignedTo.some(a => a.completionStatus === 'submitted');
  
//   if (allApproved) return 'approved';
//   if (anyRejected) return 'rejected';
//   if (anySubmitted) return 'submitted';
//   return 'pending';
// });

// // Methods
// ActionItemSchema.methods.logActivity = function(action, performedBy, details, oldValue = null, newValue = null) {
//   this.activityLog.push({
//     action,
//     performedBy,
//     timestamp: new Date(),
//     details,
//     oldValue,
//     newValue
//   });
// };

// ActionItemSchema.methods.approveCreation = function(userId, comments) {
//   const oldStatus = this.status;
//   this.status = 'Not Started';
//   this.creationApproval.status = 'approved';
//   this.creationApproval.approvedBy = userId;
//   this.creationApproval.approvalDate = new Date();
//   this.creationApproval.comments = comments || '';
  
//   this.logActivity('creation_approved', userId, 
//     `Task creation approved${comments ? ': ' + comments : ''}`, oldStatus, this.status);
// };

// ActionItemSchema.methods.rejectCreation = function(userId, comments) {
//   const oldStatus = this.status;
//   this.status = 'Rejected';
//   this.creationApproval.status = 'rejected';
//   this.creationApproval.approvedBy = userId;
//   this.creationApproval.approvalDate = new Date();
//   this.creationApproval.comments = comments || 'Task creation rejected';
  
//   this.logActivity('creation_rejected', userId, 
//     `Task creation rejected: ${comments}`, oldStatus, this.status);
// };

// // NEW: Submit completion for specific assignee
// ActionItemSchema.methods.submitCompletionForAssignee = function(userId, assigneeUserId, documents, notes) {
//   const assignee = this.assignedTo.find(a => a.user.equals(assigneeUserId));
//   if (!assignee) {
//     throw new Error('Assignee not found');
//   }

//   assignee.completionStatus = 'submitted';
//   assignee.completionDocuments = documents || [];
//   assignee.completionNotes = notes || '';
//   assignee.submittedAt = new Date();

//   this.logActivity('submitted_for_completion', userId, 
//     `Completion submitted by assignee ${assigneeUserId}`);
// };

// // NEW: Approve completion for specific assignee
// ActionItemSchema.methods.approveCompletionForAssignee = async function(userId, assigneeUserId, grade, qualityNotes, comments) {
//   const assignee = this.assignedTo.find(a => a.user.equals(assigneeUserId));
//   if (!assignee) {
//     throw new Error('Assignee not found');
//   }

//   // Calculate effective score
//   const effectiveScore = (grade / 5) * this.taskWeight;

//   assignee.completionStatus = 'approved';
//   assignee.completionGrade = {
//     score: grade,
//     effectiveScore: effectiveScore,
//     qualityNotes: qualityNotes || '',
//     gradedBy: userId,
//     gradedAt: new Date()
//   };

//   this.logActivity('completion_approved', userId, 
//     `Completion approved for assignee with grade ${grade}/5`);

//   // Check if all assignees are approved
//   const allApproved = this.assignedTo.every(a => a.completionStatus === 'approved');
//   if (allApproved) {
//     this.status = 'Completed';
//     this.completedDate = new Date();
//     this.progress = 100;
//   }

//   // Update KPI achievements for this assignee
//   await this.updateKPIAchievements(assigneeUserId, grade);

//   // Update milestone and project progress
//   if (this.milestoneId) {
//     await this.updateMilestoneProgress();
//   }
// };

// // NEW: Reject completion for specific assignee
// ActionItemSchema.methods.rejectCompletionForAssignee = function(userId, assigneeUserId, comments) {
//   const assignee = this.assignedTo.find(a => a.user.equals(assigneeUserId));
//   if (!assignee) {
//     throw new Error('Assignee not found');
//   }

//   assignee.completionStatus = 'rejected';
//   assignee.completionGrade = {
//     qualityNotes: comments || 'Needs revision',
//     gradedBy: userId,
//     gradedAt: new Date()
//   };

//   this.status = 'In Progress';

//   this.logActivity('completion_rejected', userId, 
//     `Completion rejected for assignee: ${comments}`);
// };

// // NEW: Update KPI achievements
// ActionItemSchema.methods.updateKPIAchievements = async function(assigneeUserId, grade) {
//   const QuarterlyKPI = mongoose.model('QuarterlyKPI');

//   for (const linkedKPI of this.linkedKPIs) {
//     const kpiDoc = await QuarterlyKPI.findById(linkedKPI.kpiDocId);
//     if (!kpiDoc) continue;

//     const kpi = kpiDoc.kpis[linkedKPI.kpiIndex];
//     if (!kpi) continue;

//     // Calculate contribution: (grade/5) × (kpiWeight/100) × 100
//     const contribution = (grade / 5) * (linkedKPI.kpiWeight / 100) * 100;
    
//     kpi.achievement = (kpi.achievement || 0) + contribution;
//     kpi.achievement = Math.min(100, kpi.achievement); // Cap at 100%

//     linkedKPI.contributionToKPI = contribution;

//     await kpiDoc.save();
//   }
// };

// // NEW: Update milestone progress
// ActionItemSchema.methods.updateMilestoneProgress = async function() {
//   if (!this.milestoneId) return;

//   const Project = mongoose.model('Project');
//   const project = await Project.findOne({ 'milestones._id': this.milestoneId });
  
//   if (!project) return;

//   await project.recalculateMilestoneProgress(this.milestoneId);
//   await project.save();
// };

// ActionItemSchema.methods.updateProgress = function(progress, userId) {
//   const oldProgress = this.progress;
//   this.progress = Math.max(0, Math.min(100, progress));
  
//   if (this.progress === 0 && this.status === 'Not Started') {
//     // Keep as Not Started
//   } else if (this.progress > 0 && this.progress < 100 && this.status === 'Not Started') {
//     this.status = 'In Progress';
//   }
  
//   this.logActivity('progress_updated', userId, 
//     `Progress updated from ${oldProgress}% to ${this.progress}%`, oldProgress, this.progress);
// };

// module.exports = mongoose.model('ActionItem', ActionItemSchema);









// const mongoose = require('mongoose');

// const ActionItemSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: [true, 'Task title is required'],
//     trim: true,
//     minlength: [3, 'Title must be at least 3 characters'],
//     maxlength: [200, 'Title cannot exceed 200 characters']
//   },
//   description: {
//     type: String,
//     required: [true, 'Task description is required'],
//     trim: true,
//     minlength: [10, 'Description must be at least 10 characters']
//   },
//   priority: {
//     type: String,
//     enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
//     required: [true, 'Priority is required'],
//     default: 'MEDIUM'
//   },
//   status: {
//     type: String,
//     enum: [
//       'Pending Approval',           // Waiting for supervisor to approve task creation
//       'Not Started',                 // Approved but not started
//       'In Progress',                 // Work in progress
//       'Pending Completion Approval', // Submitted for completion approval
//       'Completed',                   // Approved as complete
//       'Rejected',                    // Rejected by supervisor
//       'On Hold'                      // Paused
//     ],
//     default: 'Pending Approval'
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   dueDate: {
//     type: Date,
//     required: [true, 'Due date is required']
//   },
  
//   // Assignment
//   assignedTo: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
  
//   // Immediate supervisor (only one level)
//   supervisor: {
//     name: String,
//     email: String,
//     department: String
//   },
  
//   // Creation approval (supervisor approves task creation)
//   creationApproval: {
//     status: {
//       type: String,
//       enum: ['pending', 'approved', 'rejected'],
//       default: 'pending'
//     },
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     approvalDate: Date,
//     comments: String
//   },
  
//   // Completion approval (supervisor approves task completion)
//   completionApproval: {
//     status: {
//       type: String,
//       enum: ['pending', 'approved', 'rejected', 'not_submitted'],
//       default: 'not_submitted'
//     },
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     approvalDate: Date,
//     comments: String
//   },

//   // Task completion grading (by supervisor)
//   completionGrade: {
//     score: {
//       type: Number,
//       min: 1,
//       max: 5,
//       default: null
//     },
//     qualityNotes: {
//       type: String,
//       trim: true,
//       maxlength: 500
//     },
//     gradedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     gradedAt: Date
//   },
  
//   // Link to KPI
//   linkedKPI: {
//     kpiDocId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'QuarterlyKPI'
//     },
//     kpiIndex: Number,        
//     kpiTitle: String,
//     kpiWeight: Number
//   },
  
//   // Project Association (optional)
//   projectId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Project',
//     default: null
//   },
  
//   // Additional fields
//   notes: {
//     type: String,
//     default: ''
//   },
//   tags: [{
//     type: String,
//     trim: true
//   }],
  
//   // Completion tracking
//   completedDate: Date,
  
//   // Completion documents (when submitting for completion approval)
//   completionDocuments: [{
//     name: String,
//     url: String,
//     publicId: String,
//     size: Number,
//     mimetype: String,
//     uploadedAt: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   completionNotes: String,
  
//   // Activity log
//   activityLog: [{
//     action: {
//       type: String,
//       enum: [
//         'created',
//         'creation_approved',
//         'creation_rejected',
//         'updated',
//         'status_changed',
//         'progress_updated',
//         'submitted_for_completion',
//         'completion_approved',
//         'completion_rejected'
//       ]
//     },
//     performedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     timestamp: {
//       type: Date,
//       default: Date.now
//     },
//     details: String,
//     oldValue: mongoose.Schema.Types.Mixed,
//     newValue: mongoose.Schema.Types.Mixed
//   }]
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes
// ActionItemSchema.index({ assignedTo: 1, status: 1 });
// ActionItemSchema.index({ 'supervisor.email': 1, status: 1 });
// ActionItemSchema.index({ projectId: 1, status: 1 });
// ActionItemSchema.index({ dueDate: 1, status: 1 });
// ActionItemSchema.index({ priority: 1, status: 1 });
// ActionItemSchema.index({ status: 1, createdAt: -1 });

// // Virtual for display ID
// ActionItemSchema.virtual('displayId').get(function() {
//   return `TASK-${this._id.toString().slice(-6).toUpperCase()}`;
// });

// // Virtual for overdue status
// ActionItemSchema.virtual('isOverdue').get(function() {
//   if (['Completed'].includes(this.status)) return false;
//   return this.dueDate && new Date(this.dueDate) < new Date();
// });

// // Virtual for days until due
// ActionItemSchema.virtual('daysUntilDue').get(function() {
//   if (!this.dueDate) return null;
//   const now = new Date();
//   const due = new Date(this.dueDate);
//   const diffTime = due - now;
//   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
//   return diffDays;
// });

// // Methods
// ActionItemSchema.methods.logActivity = function(action, performedBy, details, oldValue = null, newValue = null) {
//   this.activityLog.push({
//     action,
//     performedBy,
//     timestamp: new Date(),
//     details,
//     oldValue,
//     newValue
//   });
// };

// ActionItemSchema.methods.approveCreation = function(userId, comments) {
//   const oldStatus = this.status;
//   this.status = 'Not Started';
//   this.creationApproval.status = 'approved';
//   this.creationApproval.approvedBy = userId;
//   this.creationApproval.approvalDate = new Date();
//   this.creationApproval.comments = comments || '';
  
//   this.logActivity('creation_approved', userId, `Task creation approved${comments ? ': ' + comments : ''}`, oldStatus, this.status);
// };

// ActionItemSchema.methods.rejectCreation = function(userId, comments) {
//   const oldStatus = this.status;
//   this.status = 'Rejected';
//   this.creationApproval.status = 'rejected';
//   this.creationApproval.approvedBy = userId;
//   this.creationApproval.approvalDate = new Date();
//   this.creationApproval.comments = comments || 'Task creation rejected';
  
//   this.logActivity('creation_rejected', userId, `Task creation rejected: ${comments}`, oldStatus, this.status);
// };

// ActionItemSchema.methods.submitForCompletion = function(userId, documents, completionNotes) {
//   const oldStatus = this.status;
//   this.status = 'Pending Completion Approval';
//   this.progress = 100;
//   this.completionDocuments = documents || [];
//   this.completionNotes = completionNotes || '';
//   this.completionApproval.status = 'pending';
  
//   this.logActivity('submitted_for_completion', userId, 'Task submitted for completion approval', oldStatus, this.status);
// };

// ActionItemSchema.methods.approveCompletion = function(userId, comments) {
//   const oldStatus = this.status;
//   this.status = 'Completed';
//   this.completedDate = new Date();
//   this.completionApproval.status = 'approved';
//   this.completionApproval.approvedBy = userId;
//   this.completionApproval.approvalDate = new Date();
//   this.completionApproval.comments = comments || '';
  
//   this.logActivity('completion_approved', userId, `Task completion approved${comments ? ': ' + comments : ''}`, oldStatus, this.status);
// };

// ActionItemSchema.methods.rejectCompletion = function(userId, comments) {
//   const oldStatus = this.status;
//   this.status = 'In Progress'; // Send back to in progress
//   this.progress = this.progress > 0 ? this.progress : 50; // Reset progress but keep some
//   this.completionApproval.status = 'rejected';
//   this.completionApproval.approvedBy = userId;
//   this.completionApproval.approvalDate = new Date();
//   this.completionApproval.comments = comments || 'Task completion rejected - needs revision';
  
//   this.logActivity('completion_rejected', userId, `Task completion rejected: ${comments}`, oldStatus, this.status);
// };

// ActionItemSchema.methods.updateProgress = function(progress, userId) {
//   const oldProgress = this.progress;
//   this.progress = Math.max(0, Math.min(100, progress));
  
//   // Auto-update status based on progress
//   if (this.progress === 0 && this.status === 'Not Started') {
//     // Keep as Not Started
//   } else if (this.progress > 0 && this.progress < 100 && this.status === 'Not Started') {
//     this.status = 'In Progress';
//   }
  
//   this.logActivity('progress_updated', userId, `Progress updated from ${oldProgress}% to ${this.progress}%`, oldProgress, this.progress);
// };

// module.exports = mongoose.model('ActionItem', ActionItemSchema);





