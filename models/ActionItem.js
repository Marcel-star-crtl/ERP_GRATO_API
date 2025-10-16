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
      'Pending Approval',           // Waiting for supervisor to approve task creation
      'Not Started',                 // Approved but not started
      'In Progress',                 // Work in progress
      'Pending Completion Approval', // Submitted for completion approval
      'Completed',                   // Approved as complete
      'Rejected',                    // Rejected by supervisor
      'On Hold'                      // Paused
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
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Immediate supervisor (only one level)
  supervisor: {
    name: String,
    email: String,
    department: String
  },
  
  // Creation approval (supervisor approves task creation)
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
  
  // Completion approval (supervisor approves task completion)
  completionApproval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'not_submitted'],
      default: 'not_submitted'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalDate: Date,
    comments: String
  },
  
  // Project Association (optional)
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  
  // Additional fields
  notes: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Completion tracking
  completedDate: Date,
  
  // Completion documents (when submitting for completion approval)
  completionDocuments: [{
    name: String,
    url: String,
    publicId: String,
    size: Number,
    mimetype: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  completionNotes: String,
  
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
        'submitted_for_completion',
        'completion_approved',
        'completion_rejected'
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
ActionItemSchema.index({ assignedTo: 1, status: 1 });
ActionItemSchema.index({ 'supervisor.email': 1, status: 1 });
ActionItemSchema.index({ projectId: 1, status: 1 });
ActionItemSchema.index({ dueDate: 1, status: 1 });
ActionItemSchema.index({ priority: 1, status: 1 });
ActionItemSchema.index({ status: 1, createdAt: -1 });

// Virtual for display ID
ActionItemSchema.virtual('displayId').get(function() {
  return `TASK-${this._id.toString().slice(-6).toUpperCase()}`;
});

// Virtual for overdue status
ActionItemSchema.virtual('isOverdue').get(function() {
  if (['Completed'].includes(this.status)) return false;
  return this.dueDate && new Date(this.dueDate) < new Date();
});

// Virtual for days until due
ActionItemSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
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
  
  this.logActivity('creation_approved', userId, `Task creation approved${comments ? ': ' + comments : ''}`, oldStatus, this.status);
};

ActionItemSchema.methods.rejectCreation = function(userId, comments) {
  const oldStatus = this.status;
  this.status = 'Rejected';
  this.creationApproval.status = 'rejected';
  this.creationApproval.approvedBy = userId;
  this.creationApproval.approvalDate = new Date();
  this.creationApproval.comments = comments || 'Task creation rejected';
  
  this.logActivity('creation_rejected', userId, `Task creation rejected: ${comments}`, oldStatus, this.status);
};

ActionItemSchema.methods.submitForCompletion = function(userId, documents, completionNotes) {
  const oldStatus = this.status;
  this.status = 'Pending Completion Approval';
  this.progress = 100;
  this.completionDocuments = documents || [];
  this.completionNotes = completionNotes || '';
  this.completionApproval.status = 'pending';
  
  this.logActivity('submitted_for_completion', userId, 'Task submitted for completion approval', oldStatus, this.status);
};

ActionItemSchema.methods.approveCompletion = function(userId, comments) {
  const oldStatus = this.status;
  this.status = 'Completed';
  this.completedDate = new Date();
  this.completionApproval.status = 'approved';
  this.completionApproval.approvedBy = userId;
  this.completionApproval.approvalDate = new Date();
  this.completionApproval.comments = comments || '';
  
  this.logActivity('completion_approved', userId, `Task completion approved${comments ? ': ' + comments : ''}`, oldStatus, this.status);
};

ActionItemSchema.methods.rejectCompletion = function(userId, comments) {
  const oldStatus = this.status;
  this.status = 'In Progress'; // Send back to in progress
  this.progress = this.progress > 0 ? this.progress : 50; // Reset progress but keep some
  this.completionApproval.status = 'rejected';
  this.completionApproval.approvedBy = userId;
  this.completionApproval.approvalDate = new Date();
  this.completionApproval.comments = comments || 'Task completion rejected - needs revision';
  
  this.logActivity('completion_rejected', userId, `Task completion rejected: ${comments}`, oldStatus, this.status);
};

ActionItemSchema.methods.updateProgress = function(progress, userId) {
  const oldProgress = this.progress;
  this.progress = Math.max(0, Math.min(100, progress));
  
  // Auto-update status based on progress
  if (this.progress === 0 && this.status === 'Not Started') {
    // Keep as Not Started
  } else if (this.progress > 0 && this.progress < 100 && this.status === 'Not Started') {
    this.status = 'In Progress';
  }
  
  this.logActivity('progress_updated', userId, `Progress updated from ${oldProgress}% to ${this.progress}%`, oldProgress, this.progress);
};

module.exports = mongoose.model('ActionItem', ActionItemSchema);





