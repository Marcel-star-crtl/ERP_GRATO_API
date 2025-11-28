const mongoose = require('mongoose');

const subMilestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  weight: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    required: true
  },
  dueDate: {
    type: Date
  },
  assignedSupervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed'],
    default: 'Not Started'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
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
    kpiTitle: {
      type: String,
      required: true
    },
    kpiWeight: {
      type: Number,
      required: true
    },
    contributionWeight: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    currentContribution: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  }],
  subMilestones: [],
  completedDate: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, { _id: true });

// Enable recursive structure
subMilestoneSchema.add({
  subMilestones: [subMilestoneSchema]
});

const milestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  dueDate: {
    type: Date
  },
  assignedSupervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  weight: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed'],
    default: 'Not Started'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  totalTaskWeightAssigned: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // NEW: PM Approval and KPI Linking
  approvalStatus: {
    type: String,
    enum: ['pending_pm_review', 'approved', 'rejected'],
    default: 'pending_pm_review'
  },
  pmLinkedKPIs: [{
    kpiDocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuarterlyKPI',
      required: true
    },
    kpiIndex: {
      type: Number,
      required: true
    },
    kpiTitle: {
      type: String,
      required: true
    },
    kpiWeight: {
      type: Number,
      required: true
    },
    contributionWeight: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    currentContribution: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  }],
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  subMilestones: [subMilestoneSchema],
  completedDate: {
    type: Date
  },
  manuallyCompleted: {
    type: Boolean,
    default: false
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: true, timestamps: true });

const projectSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: function() {
      // Name is always required, even for drafts
      return true;
    },
    trim: true,
    maxlength: 255
  },
  description: {
    type: String,
    required: function() {
      // Description only required for non-drafts
      return !this.isDraft;
    },
    trim: true
  },
  projectType: {
    type: String,
    required: function() {
      return !this.isDraft;
    },
    enum: [
      'Site Build',
      'Colocation',
      'Power Projects',
      'Tower Maintenance',
      'Refurbishment (Gen)',
      'Kiosk',
      'Managed Service',
      'IT Implementation', 
      'Process Improvement',
      'Product Development',
      'Training Program',
      'Facility Upgrade',
      'Equipment Installation',
      'System Integration',
      'Research & Development',
      'Maintenance',
      'Other'
    ]
  },
  priority: {
    type: String,
    required: function() {
      return !this.isDraft;
    },
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'],
    default: 'Planning'
  },
  department: {
    type: String,
    required: function() {
      return !this.isDraft;
    },
    enum: [
      'Technical Roll Out', 
      'Operations', 
      'IT', 
      'Technical', 
      'Technical Operations', 
      'Technical QHSE', 
      'Finance', 
      'HR', 
      'Marketing', 
      'Supply Chain', 
      'Facilities', 
      'Business'
    ]
  },
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.isDraft;
    }
  },
  timeline: {
    startDate: {
      type: Date,
      required: function() {
        return !this.isDraft;
      }
    },
    endDate: {
      type: Date,
      required: function() {
        return !this.isDraft;
      }
    }
  },
  budgetCodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BudgetCode',
    default: null
  },
  
  // ========== NEW: DRAFT & APPROVAL FIELDS ==========
  isDraft: {
    type: Boolean,
    default: false
    // index added in schema.index() below
  },
  
  approvalStatus: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft'
  },
  
  approvalHistory: [{
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    decision: {
      type: String,
      enum: ['approved', 'rejected']
    },
    comments: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  submittedForApprovalAt: Date,
  approvedAt: Date,
  rejectedAt: Date,
  // ========== END NEW FIELDS ==========
  
  milestones: [milestoneSchema],
  teamMembers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      trim: true
    },
    addedDate: {
      type: Date,
      default: Date.now
    }
  }],
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  resources: {
    budget: {
      allocated: Number,
      spent: Number,
      remaining: Number,
      currency: {
        type: String,
        default: 'XAF'
      }
    },
    manpower: [{
      role: String,
      count: Number,
      allocated: Number,
      hoursLogged: {
        type: Number,
        default: 0
      }
    }],
    equipment: [{
      name: String,
      quantity: Number,
      status: String
    }]
  },
  risks: [{
    title: String,
    description: String,
    category: {
      type: String,
      enum: ['Technical', 'Financial', 'Resource', 'Schedule', 'External', 'Other']
    },
    probability: {
      type: String,
      enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
    },
    impact: {
      type: String,
      enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
    },
    mitigation: String,
    contingency: String,
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['Identified', 'Analyzing', 'Mitigating', 'Monitoring', 'Closed'],
      default: 'Identified'
    },
    identifiedDate: Date,
    closedDate: Date
  }],
  issues: [{
    title: String,
    description: String,
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical']
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedDate: Date,
    resolvedDate: Date,
    resolution: String
  }],
  changeRequests: [{
    title: String,
    description: String,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requestDate: Date,
    type: {
      type: String,
      enum: ['Scope', 'Schedule', 'Budget', 'Resources', 'Quality', 'Other']
    },
    impact: String,
    justification: String,
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Implemented'],
      default: 'Pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalDate: Date,
    implementationDate: Date
  }],
  meetings: [{
    title: String,
    date: Date,
    duration: Number,
    attendees: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    agenda: [String],
    minutes: String,
    actionItems: [{
      description: String,
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      dueDate: Date,
      status: String
    }],
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  healthScore: {
    overall: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    schedule: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    budget: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    scope: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    quality: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    team: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    lastUpdated: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
projectSchema.index({ code: 1 }, { unique: true, sparse: true });
projectSchema.index({ name: 1 });
projectSchema.index({ department: 1 });
projectSchema.index({ projectManager: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ isDraft: 1 }); // Index for draft queries
projectSchema.index({ approvalStatus: 1 }); // Index for approval queries
projectSchema.index({ 'milestones.assignedSupervisor': 1 });
projectSchema.index({ 'milestones.subMilestones.assignedSupervisor': 1 });
projectSchema.index({ createdBy: 1 });
projectSchema.index({ createdAt: -1 });
projectSchema.index({ isActive: 1 });

// Helper function to generate unique project code
async function generateProjectCode(department) {
  const Project = mongoose.model('Project');

  const deptPrefixes = {
    'Operations': 'OPS',
    'IT': 'IT',
    'Finance': 'FIN',
    'Technical': 'TECH',
    'Technical Operations': 'TECHOPS',
    'Technical QHSE': 'TECHSE',
    'HR': 'HR',
    'Marketing': 'MKT',
    'Supply Chain': 'SCM',
    'Facilities': 'FAC',
    'Roll Out': 'RO',
    'Technical Roll Out': 'TRO',
    'Business': 'BU'
  };
  
  const prefix = deptPrefixes[department] || 'GEN';
  const year = new Date().getFullYear().toString().slice(-2);
  
  const latestProject = await Project.findOne({
    code: new RegExp(`^${prefix}${year}-`, 'i')
  }).sort({ code: -1 }).limit(1);
  
  let sequence = 1;
  if (latestProject && latestProject.code) {
    const match = latestProject.code.match(/-(\d+)$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }
  
  return `${prefix}${year}-${String(sequence).padStart(4, '0')}`;
}

// Pre-save hook
projectSchema.pre('save', async function(next) {
  try {
    // Generate code ONLY for non-draft projects
    if (this.isNew && !this.code && !this.isDraft) {
      this.code = await generateProjectCode(this.department);
      
      let exists = await this.constructor.findOne({ code: this.code });
      let attempts = 0;
      while (exists && attempts < 10) {
        const match = this.code.match(/^([A-Z]+\d{2}-)(\d+)$/);
        if (match) {
          const newSeq = parseInt(match[2]) + 1;
          this.code = `${match[1]}${String(newSeq).padStart(4, '0')}`;
          exists = await this.constructor.findOne({ code: this.code });
          attempts++;
        } else {
          break;
        }
      }
      
      if (exists) {
        return next(new Error('Unable to generate unique project code. Please try again.'));
      }
    }
    
    // Skip validation for drafts
    if (this.isDraft) {
      return next();
    }
    
    // Validate timeline for non-drafts
    if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
      if (this.timeline.endDate <= this.timeline.startDate) {
        return next(new Error('End date must be after start date'));
      }
    }
    
    // Validate milestone weights for non-drafts
    if (this.milestones && this.milestones.length > 0) {
      const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
      if (totalWeight !== 100) {
        return next(new Error(`Milestone weights must sum to 100%. Current total: ${totalWeight}%`));
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to calculate project progress from milestones
projectSchema.methods.calculateProjectProgress = function() {
  if (!this.milestones || this.milestones.length === 0) {
    return 0;
  }

  const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
  if (totalWeight === 0) return 0;

  const weightedProgress = this.milestones.reduce((sum, m) => {
    return sum + ((m.progress || 0) * (m.weight || 0) / 100);
  }, 0);

  return Math.round(weightedProgress);
};

// Method to recalculate milestone progress from tasks
projectSchema.methods.recalculateMilestoneProgress = async function(milestoneId) {
  const ActionItem = mongoose.model('ActionItem');
  const milestone = this.milestones.id(milestoneId);
  
  if (!milestone) return;

  const completedTasks = await ActionItem.find({
    milestoneId: milestoneId,
    status: 'Completed'
  });

  if (completedTasks.length === 0) {
    milestone.progress = 0;
    milestone.status = 'Not Started';
    return;
  }

  let totalProgress = 0;
  completedTasks.forEach(task => {
    if (task.completionGrade && task.completionGrade.score) {
      const effectiveScore = (task.completionGrade.score / 5) * task.taskWeight;
      totalProgress += effectiveScore;
    }
  });

  milestone.progress = Math.min(100, Math.round(totalProgress));

  if (milestone.progress === 0) {
    milestone.status = 'Not Started';
  } else if (milestone.progress >= 100 && milestone.manuallyCompleted) {
    milestone.status = 'Completed';
    if (!milestone.completedDate) {
      milestone.completedDate = new Date();
    }
  } else if (milestone.progress > 0) {
    milestone.status = 'In Progress';
  }

  this.progress = this.calculateProjectProgress();
};

// Static method to get projects by supervisor
projectSchema.statics.getProjectsBySupervisor = function(supervisorId) {
  return this.find({
    'milestones.assignedSupervisor': supervisorId,
    isActive: true,
    isDraft: false
  })
  .populate('projectManager', 'fullName email role')
  .populate('milestones.assignedSupervisor', 'fullName email department')
  .populate('milestones.subMilestones.assignedSupervisor', 'fullName email department')
  .sort({ createdAt: -1 });
};

// Static method to get project statistics
projectSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $match: { 
        isActive: true,
        isDraft: false // Don't count drafts in stats
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        planning: {
          $sum: { $cond: [{ $eq: ['$status', 'Planning'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
        },
        onHold: {
          $sum: { $cond: [{ $eq: ['$status', 'On Hold'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
        },
        averageProgress: { $avg: '$progress' }
      }
    }
  ]);

  const overdue = await this.countDocuments({
    isActive: true,
    isDraft: false,
    status: { $nin: ['Completed', 'Cancelled'] },
    'timeline.endDate': { $lt: new Date() }
  });

  return stats.length > 0 ? { ...stats[0], overdue } : {
    total: 0,
    planning: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
    cancelled: 0,
    averageProgress: 0,
    overdue: 0
  };
};

// Static method to search projects
projectSchema.statics.searchProjects = function(searchQuery, filters = {}) {
  const query = {
    isActive: true,
    isDraft: false,
    $or: [
      { name: new RegExp(searchQuery, 'i') },
      { code: new RegExp(searchQuery, 'i') },
      { description: new RegExp(searchQuery, 'i') },
      { tags: new RegExp(searchQuery, 'i') }
    ]
  };

  if (filters.status) query.status = filters.status;
  if (filters.department) query.department = filters.department;
  if (filters.priority) query.priority = filters.priority;
  if (filters.projectType) query.projectType = filters.projectType;

  return this.find(query)
    .populate('projectManager', 'fullName email role department')
    .populate('budgetCodeId', 'code name')
    .sort({ createdAt: -1 });
};

// Add method to calculate health score
projectSchema.methods.calculateHealthScore = function() {
  let scheduleScore = 100;
  let budgetScore = 100;
  let scopeScore = 100;
  let qualityScore = 100;
  let teamScore = 100;

  // Schedule health
  if (this.timeline && this.timeline.endDate) {
    const daysRemaining = Math.ceil((this.timeline.endDate - new Date()) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil((this.timeline.endDate - this.timeline.startDate) / (1000 * 60 * 60 * 24));
    const expectedProgress = ((totalDays - daysRemaining) / totalDays) * 100;
    const deviation = this.progress - expectedProgress;
    
    if (deviation < -20) scheduleScore = 50;
    else if (deviation < -10) scheduleScore = 70;
    else if (deviation < 0) scheduleScore = 85;
  }

  // Budget health
  if (this.resources && this.resources.budget) {
    const budgetUtilization = (this.resources.budget.spent / this.resources.budget.allocated) * 100;
    const scheduleUtilization = this.progress;
    const budgetDeviation = budgetUtilization - scheduleUtilization;
    
    if (budgetDeviation > 20) budgetScore = 50;
    else if (budgetDeviation > 10) budgetScore = 70;
    else if (budgetDeviation > 5) budgetScore = 85;
  }

  // Scope health
  const pendingChanges = this.changeRequests.filter(cr => cr.status === 'Pending').length;
  if (pendingChanges > 5) scopeScore = 60;
  else if (pendingChanges > 3) scopeScore = 75;
  else if (pendingChanges > 1) scopeScore = 90;

  // Quality health
  const criticalIssues = this.issues.filter(i => i.severity === 'Critical' && i.status === 'Open').length;
  if (criticalIssues > 3) qualityScore = 50;
  else if (criticalIssues > 1) qualityScore = 70;
  else if (criticalIssues > 0) qualityScore = 85;

  // Team health
  const overdueMilestones = this.milestones.filter(m => 
    m.status !== 'Completed' && m.dueDate && new Date(m.dueDate) < new Date()
  ).length;
  if (overdueMilestones > 3) teamScore = 60;
  else if (overdueMilestones > 1) teamScore = 75;
  else if (overdueMilestones > 0) teamScore = 90;

  // Calculate overall
  const overall = Math.round(
    (scheduleScore + budgetScore + scopeScore + qualityScore + teamScore) / 5
  );

  this.healthScore = {
    overall,
    schedule: scheduleScore,
    budget: budgetScore,
    scope: scopeScore,
    quality: qualityScore,
    team: teamScore,
    lastUpdated: new Date()
  };

  return this.healthScore;
};

// Add method for timeline analysis
projectSchema.methods.getTimelineAnalysis = function() {
  const now = new Date();
  const totalDuration = this.timeline.endDate - this.timeline.startDate;
  const elapsed = now - this.timeline.startDate;
  const remaining = this.timeline.endDate - now;
  
  const percentTimeElapsed = (elapsed / totalDuration) * 100;
  const percentComplete = this.progress;
  
  return {
    percentTimeElapsed: Math.round(percentTimeElapsed),
    percentComplete,
    schedulePerformanceIndex: percentComplete / percentTimeElapsed,
    daysElapsed: Math.ceil(elapsed / (1000 * 60 * 60 * 24)),
    daysRemaining: Math.ceil(remaining / (1000 * 60 * 60 * 24)),
    isAheadOfSchedule: percentComplete > percentTimeElapsed,
    isOnTrack: Math.abs(percentComplete - percentTimeElapsed) <= 5,
    isBehindSchedule: percentComplete < percentTimeElapsed - 5
  };
};

// Static method to get projects by department
projectSchema.statics.getByDepartment = function(department, options = {}) {
  const query = {
    department,
    isActive: true,
    isDraft: false
  };

  return this.find(query)
    .populate('projectManager', 'fullName email role')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;






// const mongoose = require('mongoose');

// // Sub-milestone schema (recursive structure)
// const subMilestoneSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   weight: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0,
//     required: true
//   },
//   dueDate: {
//     type: Date
//   },
//   assignedSupervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   status: {
//     type: String,
//     enum: ['Not Started', 'In Progress', 'Completed'],
//     default: 'Not Started'
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   subMilestones: [],
//   completedDate: Date,
//   completedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   updatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: Date
// }, { _id: true });

// subMilestoneSchema.add({
//   subMilestones: [subMilestoneSchema]
// });

// const milestoneSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: function() { return !this.parent().isDraft; },
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   dueDate: {
//     type: Date
//   },
//   assignedSupervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: function() { return !this.parent().isDraft; }
//   },
//   weight: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   status: {
//     type: String,
//     enum: ['Not Started', 'In Progress', 'Completed'],
//     default: 'Not Started'
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   totalTaskWeightAssigned: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   subMilestones: [subMilestoneSchema],
//   completedDate: {
//     type: Date
//   },
//   manuallyCompleted: {
//     type: Boolean,
//     default: false
//   },
//   completedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }
// }, { _id: true, timestamps: true });

// const projectSchema = new mongoose.Schema({
//   code: {
//     type: String,
//     unique: true,
//     sparse: true,
//     trim: true,
//     uppercase: true
//   },
//   name: {
//     type: String,
//     required: function() { return !this.isDraft; },
//     trim: true,
//     maxlength: 255
//   },
//   description: {
//     type: String,
//     required: function() { return !this.isDraft; },
//     trim: true
//   },
//   projectType: {
//     type: String,
//     required: function() { return !this.isDraft; },
//     enum: [
//       'Site Build',
//       'Colocation',
//       'Power Projects',
//       'Tower Maintenance',
//       'Refurbishment (Gen)',
//       'Kiosk',
//       'Managed Service',
//       'IT Implementation', 
//       'Process Improvement',
//       'Product Development',
//       'Training Program',
//       'Facility Upgrade',
//       'Equipment Installation',
//       'System Integration',
//       'Research & Development',
//       'Maintenance',
//       'Other'
//     ]
//   },
//   priority: {
//     type: String,
//     required: function() { return !this.isDraft; },
//     enum: ['Low', 'Medium', 'High', 'Critical'],
//     default: 'Medium'
//   },
//   status: {
//     type: String,
//     enum: ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'],
//     default: 'Planning'
//   },
//   isDraft: {
//     type: Boolean,
//     default: true
//   },
//   department: {
//     type: String,
//     required: function() { return !this.isDraft; },
//     enum: ['Technical Roll Out', 'Operations', 'IT', 'Technical', 'Technical Operations', 'Technical QHSE', 'Finance', 'HR', 'Marketing', 'Supply Chain', 'Facilities', 'Business', ]
//   },
//   projectManager: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: function() { return !this.isDraft; }
//   },
//   timeline: {
//     startDate: {
//       type: Date,
//       required: function() { return !this.isDraft; }
//     },
//     endDate: {
//       type: Date,
//       required: function() { return !this.isDraft; }
//     }
//   },
//   budgetCodeId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'BudgetCode',
//     default: null
//   },
//   milestones: [milestoneSchema],
//   teamMembers: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     role: {
//       type: String,
//       trim: true
//     },
//     addedDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   tags: [{
//     type: String,
//     trim: true
//   }],
//   resources: {
//     budget: {
//       allocated: Number,
//       spent: Number,
//       remaining: Number,
//       currency: {
//         type: String,
//         default: 'XAF'
//       }
//     },
//     manpower: [{
//       role: String,
//       count: Number,
//       allocated: Number,
//       hoursLogged: {
//         type: Number,
//         default: 0
//       }
//     }],
//     equipment: [{
//       name: String,
//       quantity: Number,
//       status: String
//     }]
//   },
//   risks: [{
//     title: String,
//     description: String,
//     category: {
//       type: String,
//       enum: ['Technical', 'Financial', 'Resource', 'Schedule', 'External', 'Other']
//     },
//     probability: {
//       type: String,
//       enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
//     },
//     impact: {
//       type: String,
//       enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
//     },
//     mitigation: String,
//     contingency: String,
//     owner: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     status: {
//       type: String,
//       enum: ['Identified', 'Analyzing', 'Mitigating', 'Monitoring', 'Closed'],
//       default: 'Identified'
//     },
//     identifiedDate: Date,
//     closedDate: Date
//   }],
//   issues: [{
//     title: String,
//     description: String,
//     severity: {
//       type: String,
//       enum: ['Low', 'Medium', 'High', 'Critical']
//     },
//     status: {
//       type: String,
//       enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
//       default: 'Open'
//     },
//     assignedTo: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reportedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reportedDate: Date,
//     resolvedDate: Date,
//     resolution: String
//   }],
//   changeRequests: [{
//     title: String,
//     description: String,
//     requestedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     requestDate: Date,
//     type: {
//       type: String,
//       enum: ['Scope', 'Schedule', 'Budget', 'Resources', 'Quality', 'Other']
//     },
//     impact: String,
//     justification: String,
//     status: {
//       type: String,
//       enum: ['Pending', 'Approved', 'Rejected', 'Implemented'],
//       default: 'Pending'
//     },
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     approvalDate: Date,
//     implementationDate: Date
//   }],
//   meetings: [{
//     title: String,
//     date: Date,
//     duration: Number,
//     attendees: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }],
//     agenda: [String],
//     minutes: String,
//     actionItems: [{
//       description: String,
//       assignedTo: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       },
//       dueDate: Date,
//       status: String
//     }],
//     organizer: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
//   healthScore: {
//     overall: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     schedule: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     budget: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     scope: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     quality: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     team: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     lastUpdated: Date
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   updatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes
// projectSchema.index({ code: 1 }, { unique: true, sparse: true });
// projectSchema.index({ name: 1 });
// projectSchema.index({ department: 1 });
// projectSchema.index({ projectManager: 1 });
// projectSchema.index({ status: 1 });
// projectSchema.index({ isDraft: 1 });
// projectSchema.index({ priority: 1 });
// projectSchema.index({ 'milestones.assignedSupervisor': 1 });
// projectSchema.index({ 'milestones.subMilestones.assignedSupervisor': 1 });
// projectSchema.index({ createdBy: 1 });
// projectSchema.index({ createdAt: -1 });
// projectSchema.index({ isActive: 1 });

// // Generate unique project code
// async function generateProjectCode(department) {
//   const Project = mongoose.model('Project');
  
//   const deptPrefixes = {
//     'Operations': 'OPS',
//     'IT': 'IT',
//     'Finance': 'FIN',
//     'Technical': 'TECH',
//     'Technical Operations': 'TECHPOPS',
//     'Technical QHSE': 'TECHSE',
//     'HR': 'HR',
//     'Marketing': 'MKT',
//     'Supply Chain': 'SCM',
//     'Facilities': 'FAC',
//     'Roll Out': 'RO',
//     'Business': 'BU'
//   };
  
//   const prefix = deptPrefixes[department] || 'GEN';
//   const year = new Date().getFullYear().toString().slice(-2);
  
//   const latestProject = await Project.findOne({
//     code: new RegExp(`^${prefix}${year}-`, 'i')
//   }).sort({ code: -1 }).limit(1);
  
//   let sequence = 1;
//   if (latestProject && latestProject.code) {
//     const match = latestProject.code.match(/-(\d+)$/);
//     if (match) {
//       sequence = parseInt(match[1]) + 1;
//     }
//   }
  
//   return `${prefix}${year}-${String(sequence).padStart(4, '0')}`;
// }

// // Pre-save hook
// projectSchema.pre('save', async function(next) {
//   try {
//     // Generate code when project is submitted (not draft)
//     if (!this.isDraft && !this.code) {
//       this.code = await generateProjectCode(this.department);
      
//       let exists = await this.constructor.findOne({ code: this.code });
//       let attempts = 0;
//       while (exists && attempts < 10) {
//         const match = this.code.match(/^([A-Z]+\d{2}-)(\d+)$/);
//         if (match) {
//           const newSeq = parseInt(match[2]) + 1;
//           this.code = `${match[1]}${String(newSeq).padStart(4, '0')}`;
//           exists = await this.constructor.findOne({ code: this.code });
//           attempts++;
//         } else {
//           break;
//         }
//       }
      
//       if (exists) {
//         return next(new Error('Unable to generate unique project code. Please try again.'));
//       }
//     }
    
//     // Validate only non-draft projects
//     if (!this.isDraft) {
//       if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
//         if (this.timeline.endDate <= this.timeline.startDate) {
//           return next(new Error('End date must be after start date'));
//         }
//       }
      
//       if (this.milestones && this.milestones.length > 0) {
//         const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//         if (totalWeight !== 100) {
//           return next(new Error(`Milestone weights must sum to 100%. Current total: ${totalWeight}%`));
//         }
//       }
//     }
    
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// // Method to calculate project progress from milestones
// projectSchema.methods.calculateProjectProgress = function() {
//   if (!this.milestones || this.milestones.length === 0) {
//     return 0;
//   }

//   const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//   if (totalWeight === 0) return 0;

//   const weightedProgress = this.milestones.reduce((sum, m) => {
//     return sum + ((m.progress || 0) * (m.weight || 0) / 100);
//   }, 0);

//   return Math.round(weightedProgress);
// };

// // Method to recalculate milestone progress from tasks
// projectSchema.methods.recalculateMilestoneProgress = async function(milestoneId) {
//   const ActionItem = mongoose.model('ActionItem');
//   const milestone = this.milestones.id(milestoneId);
  
//   if (!milestone) return;

//   const completedTasks = await ActionItem.find({
//     milestoneId: milestoneId,
//     status: 'Completed'
//   });

//   if (completedTasks.length === 0) {
//     milestone.progress = 0;
//     milestone.status = 'Not Started';
//     return;
//   }

//   let totalProgress = 0;
//   completedTasks.forEach(task => {
//     if (task.completionGrade && task.completionGrade.score) {
//       const effectiveScore = (task.completionGrade.score / 5) * task.taskWeight;
//       totalProgress += effectiveScore;
//     }
//   });

//   milestone.progress = Math.min(100, Math.round(totalProgress));

//   if (milestone.progress === 0) {
//     milestone.status = 'Not Started';
//   } else if (milestone.progress >= 100 && milestone.manuallyCompleted) {
//     milestone.status = 'Completed';
//     if (!milestone.completedDate) {
//       milestone.completedDate = new Date();
//     }
//   } else if (milestone.progress > 0) {
//     milestone.status = 'In Progress';
//   }

//   this.progress = this.calculateProjectProgress();
// };

// // Static method to get projects by supervisor
// projectSchema.statics.getProjectsBySupervisor = function(supervisorId) {
//   return this.find({
//     'milestones.assignedSupervisor': supervisorId,
//     isActive: true,
//     isDraft: false
//   })
//   .populate('projectManager', 'fullName email role')
//   .populate('milestones.assignedSupervisor', 'fullName email department')
//   .populate('milestones.subMilestones.assignedSupervisor', 'fullName email department')
//   .sort({ createdAt: -1 });
// };

// // Static method to get supervisor's milestones
// projectSchema.statics.getSupervisorMilestones = async function(supervisorId) {
//   const projects = await this.find({
//     $or: [
//       { 'milestones.assignedSupervisor': supervisorId },
//       { 'milestones.subMilestones.assignedSupervisor': supervisorId }
//     ],
//     isActive: true,
//     isDraft: false
//   })
//   .populate('projectManager', 'fullName email')
//   .populate('milestones.assignedSupervisor', 'fullName email')
//   .populate('milestones.subMilestones.assignedSupervisor', 'fullName email');

//   const result = [];
  
//   projects.forEach(project => {
//     project.milestones.forEach(milestone => {
//       if (milestone.assignedSupervisor && milestone.assignedSupervisor._id.equals(supervisorId)) {
//         result.push({
//           project: {
//             _id: project._id,
//             name: project.name,
//             code: project.code,
//             status: project.status
//           },
//           milestone: {
//             _id: milestone._id,
//             title: milestone.title,
//             description: milestone.description,
//             weight: milestone.weight,
//             progress: milestone.progress,
//             status: milestone.status,
//             dueDate: milestone.dueDate,
//             totalTaskWeightAssigned: milestone.totalTaskWeightAssigned,
//             subMilestoneCount: milestone.subMilestones?.length || 0,
//             type: 'milestone'
//           }
//         });
//       }

//       if (milestone.subMilestones && milestone.subMilestones.length > 0) {
//         const subMilestoneResults = findSupervisorSubMilestones(
//           milestone.subMilestones,
//           supervisorId,
//           project,
//           milestone
//         );
//         result.push(...subMilestoneResults);
//       }
//     });
//   });

//   return result;
// };

// function findSupervisorSubMilestones(subMilestones, supervisorId, project, parentMilestone) {
//   const results = [];
  
//   subMilestones.forEach(subMilestone => {
//     if (subMilestone.assignedSupervisor && subMilestone.assignedSupervisor._id.equals(supervisorId)) {
//       results.push({
//         project: {
//           _id: project._id,
//           name: project.name,
//           code: project.code,
//           status: project.status
//         },
//         milestone: {
//           _id: subMilestone._id,
//           title: subMilestone.title,
//           description: subMilestone.description,
//           weight: subMilestone.weight,
//           progress: subMilestone.progress,
//           status: subMilestone.status,
//           dueDate: subMilestone.dueDate,
//           subMilestoneCount: subMilestone.subMilestones?.length || 0,
//           type: 'sub-milestone',
//           parentMilestone: {
//             _id: parentMilestone._id,
//             title: parentMilestone.title
//           }
//         }
//       });
//     }

//     if (subMilestone.subMilestones && subMilestone.subMilestones.length > 0) {
//       const nestedResults = findSupervisorSubMilestones(
//         subMilestone.subMilestones,
//         supervisorId,
//         project,
//         parentMilestone
//       );
//       results.push(...nestedResults);
//     }
//   });

//   return results;
// }

// // Static method to get project statistics
// projectSchema.statics.getStatistics = async function() {
//   const stats = await this.aggregate([
//     {
//       $match: { isActive: true, isDraft: false }
//     },
//     {
//       $group: {
//         _id: null,
//         total: { $sum: 1 },
//         planning: {
//           $sum: { $cond: [{ $eq: ['$status', 'Planning'] }, 1, 0] }
//         },
//         inProgress: {
//           $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
//         },
//         completed: {
//           $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
//         },
//         onHold: {
//           $sum: { $cond: [{ $eq: ['$status', 'On Hold'] }, 1, 0] }
//         },
//         cancelled: {
//           $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
//         },
//         averageProgress: { $avg: '$progress' }
//       }
//     }
//   ]);

//   const overdue = await this.countDocuments({
//     isActive: true,
//     isDraft: false,
//     status: { $nin: ['Completed', 'Cancelled'] },
//     'timeline.endDate': { $lt: new Date() }
//   });

//   return stats.length > 0 ? { ...stats[0], overdue } : {
//     total: 0,
//     planning: 0,
//     inProgress: 0,
//     completed: 0,
//     onHold: 0,
//     cancelled: 0,
//     averageProgress: 0,
//     overdue: 0
//   };
// };

// // Static method to search projects
// projectSchema.statics.searchProjects = function(searchQuery, filters = {}) {
//   const query = {
//     isActive: true,
//     isDraft: false,
//     $or: [
//       { name: new RegExp(searchQuery, 'i') },
//       { code: new RegExp(searchQuery, 'i') },
//       { description: new RegExp(searchQuery, 'i') },
//       { tags: new RegExp(searchQuery, 'i') }
//     ]
//   };

//   if (filters.status) query.status = filters.status;
//   if (filters.department) query.department = filters.department;
//   if (filters.priority) query.priority = filters.priority;
//   if (filters.projectType) query.projectType = filters.projectType;

//   return this.find(query)
//     .populate('projectManager', 'fullName email role department')
//     .populate('budgetCodeId', 'code name')
//     .sort({ createdAt: -1 });
// };

// projectSchema.methods.calculateHealthScore = function() {
//   let scheduleScore = 100;
//   let budgetScore = 100;
//   let scopeScore = 100;
//   let qualityScore = 100;
//   let teamScore = 100;

//   if (this.timeline && this.timeline.endDate) {
//     const daysRemaining = Math.ceil((this.timeline.endDate - new Date()) / (1000 * 60 * 60 * 24));
//     const totalDays = Math.ceil((this.timeline.endDate - this.timeline.startDate) / (1000 * 60 * 60 * 24));
//     const expectedProgress = ((totalDays - daysRemaining) / totalDays) * 100;
//     const deviation = this.progress - expectedProgress;
    
//     if (deviation < -20) scheduleScore = 50;
//     else if (deviation < -10) scheduleScore = 70;
//     else if (deviation < 0) scheduleScore = 85;
//   }

//   if (this.resources && this.resources.budget) {
//     const budgetUtilization = (this.resources.budget.spent / this.resources.budget.allocated) * 100;
//     const scheduleUtilization = this.progress;
//     const budgetDeviation = budgetUtilization - scheduleUtilization;
    
//     if (budgetDeviation > 20) budgetScore = 50;
//     else if (budgetDeviation > 10) budgetScore = 70;
//     else if (budgetDeviation > 5) budgetScore = 85;
//   }

//   const pendingChanges = this.changeRequests.filter(cr => cr.status === 'Pending').length;
//   if (pendingChanges > 5) scopeScore = 60;
//   else if (pendingChanges > 3) scopeScore = 75;
//   else if (pendingChanges > 1) scopeScore = 90;

//   const criticalIssues = this.issues.filter(i => i.severity === 'Critical' && i.status === 'Open').length;
//   if (criticalIssues > 3) qualityScore = 50;
//   else if (criticalIssues > 1) qualityScore = 70;
//   else if (criticalIssues > 0) qualityScore = 85;

//   const overdueMilestones = this.milestones.filter(m => 
//     m.status !== 'Completed' && m.dueDate && new Date(m.dueDate) < new Date()
//   ).length;
//   if (overdueMilestones > 3) teamScore = 60;
//   else if (overdueMilestones > 1) teamScore = 75;
//   else if (overdueMilestones > 0) teamScore = 90;

//   const overall = Math.round(
//     (scheduleScore + budgetScore + scopeScore + qualityScore + teamScore) / 5
//   );

//   this.healthScore = {
//     overall,
//     schedule: scheduleScore,
//     budget: budgetScore,
//     scope: scopeScore,
//     quality: qualityScore,
//     team: teamScore,
//     lastUpdated: new Date()
//   };

//   return this.healthScore;
// };

// projectSchema.methods.getTimelineAnalysis = function() {
//   const now = new Date();
//   const totalDuration = this.timeline.endDate - this.timeline.startDate;
//   const elapsed = now - this.timeline.startDate;
//   const remaining = this.timeline.endDate - now;
  
//   const percentTimeElapsed = (elapsed / totalDuration) * 100;
//   const percentComplete = this.progress;
  
//   return {
//     percentTimeElapsed: Math.round(percentTimeElapsed),
//     percentComplete,
//     schedulePerformanceIndex: percentComplete / percentTimeElapsed,
//     daysElapsed: Math.ceil(elapsed / (1000 * 60 * 60 * 24)),
//     daysRemaining: Math.ceil(remaining / (1000 * 60 * 60 * 24)),
//     isAheadOfSchedule: percentComplete > percentTimeElapsed,
//     isOnTrack: Math.abs(percentComplete - percentTimeElapsed) <= 5,
//     isBehindSchedule: percentComplete < percentTimeElapsed - 5
//   };
// };

// projectSchema.statics.getByDepartment = function(department, options = {}) {
//   const query = {
//     department,
//     isActive: true,
//     isDraft: false
//   };

//   return this.find(query)
//     .populate('projectManager', 'fullName email role')
//     .sort({ createdAt: -1 })
//     .limit(options.limit || 50);
// };

// const Project = mongoose.model('Project', projectSchema);

// module.exports = Project;











// const mongoose = require('mongoose');

// // Sub-milestone schema (recursive structure)
// const subMilestoneSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   weight: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0,
//     required: true
//   },
//   dueDate: {
//     type: Date
//   },
//   assignedSupervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   status: {
//     type: String,
//     enum: ['Not Started', 'In Progress', 'Completed'],
//     default: 'Not Started'
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   subMilestones: [], // Will be populated recursively
//   completedDate: Date,
//   completedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   updatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: Date
// }, { _id: true });

// // Enable recursive structure
// subMilestoneSchema.add({
//   subMilestones: [subMilestoneSchema]
// });

// const milestoneSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: function() { return this.parent().approvalStatus !== 'draft'; },
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   dueDate: {
//     type: Date
//   },
//   assignedSupervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: function() { return this.parent().approvalStatus !== 'draft'; }
//   },
//   weight: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   status: {
//     type: String,
//     enum: ['Not Started', 'In Progress', 'Completed'],
//     default: 'Not Started'
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   totalTaskWeightAssigned: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   // NEW: Sub-milestones for breakdown
//   subMilestones: [subMilestoneSchema],
//   completedDate: {
//     type: Date
//   },
//   manuallyCompleted: {
//     type: Boolean,
//     default: false
//   },
//   completedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }
// }, { _id: true, timestamps: true });

// const projectSchema = new mongoose.Schema({
//   code: {
//     type: String,
//     unique: true,
//     sparse: true,
//     trim: true,
//     uppercase: true
//   },
//   name: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     trim: true,
//     maxlength: 255
//   },
//   description: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     trim: true
//   },
//   projectType: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     enum: [
//       'Site Build',
//       'Colocation',
//       'Power Projects',
//       'Tower Maintenance',
//       'Refurbishment (Gen)',
//       'Kiosk',
//       'Managed Service',
//       'IT Implementation', 
//       'Process Improvement',
//       'Product Development',
//       'Training Program',
//       'Facility Upgrade',
//       'Equipment Installation',
//       'System Integration',
//       'Research & Development',
//       'Maintenance',
//       'Other'
//     ]
//   },
//   priority: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     enum: ['Low', 'Medium', 'High', 'Critical'],
//     default: 'Medium'
//   },
//   status: {
//     type: String,
//     enum: ['Planning', 'Approved', 'In Progress', 'Completed', 'On Hold', 'Cancelled'],
//     default: 'Planning'
//   },
//   approvalStatus: {
//     type: String,
//     enum: ['draft', 'pending', 'approved', 'rejected'],
//     default: 'draft'
//   },
//   submittedAt: Date,
//   submittedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   approvedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   approvedAt: Date,
//   rejectionReason: String,
//   department: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     enum: ['Roll Out', 'Operations', 'IT', 'Finance', 'HR', 'Marketing', 'Supply Chain', 'Facilities']
//   },
//   projectManager: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: function() { return this.approvalStatus !== 'draft'; }
//   },
//   timeline: {
//     startDate: {
//       type: Date,
//       required: function() { return this.approvalStatus !== 'draft'; }
//     },
//     endDate: {
//       type: Date,
//       required: function() { return this.approvalStatus !== 'draft'; }
//     }
//   },
//   budgetCodeId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'BudgetCode',
//     default: null
//   },
//   milestones: [milestoneSchema],
//   teamMembers: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     role: {
//       type: String,
//       trim: true
//     },
//     addedDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   tags: [{
//     type: String,
//     trim: true
//   }],
//   resources: {
//     budget: {
//       allocated: Number,
//       spent: Number,
//       remaining: Number,
//       currency: {
//         type: String,
//         default: 'XAF'
//       }
//     },
//     manpower: [{
//       role: String,
//       count: Number,
//       allocated: Number,
//       hoursLogged: {
//         type: Number,
//         default: 0
//       }
//     }],
//     equipment: [{
//       name: String,
//       quantity: Number,
//       status: String
//     }]
//   },
//   risks: [{
//     title: String,
//     description: String,
//     category: {
//       type: String,
//       enum: ['Technical', 'Financial', 'Resource', 'Schedule', 'External', 'Other']
//     },
//     probability: {
//       type: String,
//       enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
//     },
//     impact: {
//       type: String,
//       enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
//     },
//     mitigation: String,
//     contingency: String,
//     owner: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     status: {
//       type: String,
//       enum: ['Identified', 'Analyzing', 'Mitigating', 'Monitoring', 'Closed'],
//       default: 'Identified'
//     },
//     identifiedDate: Date,
//     closedDate: Date
//   }],
//   issues: [{
//     title: String,
//     description: String,
//     severity: {
//       type: String,
//       enum: ['Low', 'Medium', 'High', 'Critical']
//     },
//     status: {
//       type: String,
//       enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
//       default: 'Open'
//     },
//     assignedTo: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reportedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reportedDate: Date,
//     resolvedDate: Date,
//     resolution: String
//   }],
//   changeRequests: [{
//     title: String,
//     description: String,
//     requestedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     requestDate: Date,
//     type: {
//       type: String,
//       enum: ['Scope', 'Schedule', 'Budget', 'Resources', 'Quality', 'Other']
//     },
//     impact: String,
//     justification: String,
//     status: {
//       type: String,
//       enum: ['Pending', 'Approved', 'Rejected', 'Implemented'],
//       default: 'Pending'
//     },
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     approvalDate: Date,
//     implementationDate: Date
//   }],
//   meetings: [{
//     title: String,
//     date: Date,
//     duration: Number,
//     attendees: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }],
//     agenda: [String],
//     minutes: String,
//     actionItems: [{
//       description: String,
//       assignedTo: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       },
//       dueDate: Date,
//       status: String
//     }],
//     organizer: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
//   healthScore: {
//     overall: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     schedule: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     budget: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     scope: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     quality: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     team: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     lastUpdated: Date
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   updatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes
// projectSchema.index({ code: 1 }, { unique: true, sparse: true });
// projectSchema.index({ name: 1 });
// projectSchema.index({ department: 1 });
// projectSchema.index({ projectManager: 1 });
// projectSchema.index({ status: 1 });
// projectSchema.index({ approvalStatus: 1 });
// projectSchema.index({ priority: 1 });
// projectSchema.index({ 'milestones.assignedSupervisor': 1 });
// projectSchema.index({ 'milestones.subMilestones.assignedSupervisor': 1 }); // NEW
// projectSchema.index({ createdBy: 1 });
// projectSchema.index({ createdAt: -1 });
// projectSchema.index({ isActive: 1 });

// // Helper function to generate unique project code
// async function generateProjectCode(department) {
//   const Project = mongoose.model('Project');
  
//   const deptPrefixes = {
//     'Operations': 'OPS',
//     'IT': 'IT',
//     'Finance': 'FIN',
//     'HR': 'HR',
//     'Marketing': 'MKT',
//     'Supply Chain': 'SCM',
//     'Facilities': 'FAC',
//     'Roll Out': 'RO'
//   };
  
//   const prefix = deptPrefixes[department] || 'GEN';
//   const year = new Date().getFullYear().toString().slice(-2);
  
//   const latestProject = await Project.findOne({
//     code: new RegExp(`^${prefix}${year}-`, 'i')
//   }).sort({ code: -1 }).limit(1);
  
//   let sequence = 1;
//   if (latestProject && latestProject.code) {
//     const match = latestProject.code.match(/-(\d+)$/);
//     if (match) {
//       sequence = parseInt(match[1]) + 1;
//     }
//   }
  
//   return `${prefix}${year}-${String(sequence).padStart(4, '0')}`;
// }

// // Pre-save hook
// projectSchema.pre('save', async function(next) {
//   try {
//     if (this.isModified('approvalStatus') && this.approvalStatus === 'approved' && !this.code) {
//       this.code = await generateProjectCode(this.department);
      
//       let exists = await this.constructor.findOne({ code: this.code });
//       let attempts = 0;
//       while (exists && attempts < 10) {
//         const match = this.code.match(/^([A-Z]+\d{2}-)(\d+)$/);
//         if (match) {
//           const newSeq = parseInt(match[2]) + 1;
//           this.code = `${match[1]}${String(newSeq).padStart(4, '0')}`;
//           exists = await this.constructor.findOne({ code: this.code });
//           attempts++;
//         } else {
//           break;
//         }
//       }
      
//       if (exists) {
//         return next(new Error('Unable to generate unique project code. Please try again.'));
//       }
//     }
    
//     if (this.approvalStatus !== 'draft') {
//       if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
//         if (this.timeline.endDate <= this.timeline.startDate) {
//           return next(new Error('End date must be after start date'));
//         }
//       }
      
//       if (this.milestones && this.milestones.length > 0) {
//         const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//         if (totalWeight !== 100) {
//           return next(new Error(`Milestone weights must sum to 100%. Current total: ${totalWeight}%`));
//         }
//       }
//     }
    
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// // Method to submit for approval
// projectSchema.methods.submitForApproval = function() {
//   if (!this.name || !this.description || !this.projectType || !this.priority || 
//       !this.department || !this.projectManager || !this.timeline || 
//       !this.timeline.startDate || !this.timeline.endDate) {
//     throw new Error('All required fields must be completed before submission');
//   }

//   if (!this.milestones || this.milestones.length === 0) {
//     throw new Error('At least one milestone is required');
//   }

//   const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//   if (totalWeight !== 100) {
//     throw new Error(`Milestone weights must sum to 100%. Current total: ${totalWeight}%`);
//   }

//   for (const milestone of this.milestones) {
//     if (!milestone.assignedSupervisor) {
//       throw new Error(`Milestone "${milestone.title}" must have an assigned supervisor`);
//     }
//   }

//   this.approvalStatus = 'pending';
//   this.submittedAt = new Date();
// };

// // Method to approve project
// projectSchema.methods.approve = function(userId) {
//   this.approvalStatus = 'approved';
//   this.approvedBy = userId;
//   this.approvedAt = new Date();
//   this.status = 'Planning';
// };

// // Method to reject project
// projectSchema.methods.reject = function(userId, reason) {
//   this.approvalStatus = 'rejected';
//   this.approvedBy = userId;
//   this.approvedAt = new Date();
//   this.rejectionReason = reason;
// };

// // Method to calculate project progress from milestones
// projectSchema.methods.calculateProjectProgress = function() {
//   if (!this.milestones || this.milestones.length === 0) {
//     return 0;
//   }

//   const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//   if (totalWeight === 0) return 0;

//   const weightedProgress = this.milestones.reduce((sum, m) => {
//     return sum + ((m.progress || 0) * (m.weight || 0) / 100);
//   }, 0);

//   return Math.round(weightedProgress);
// };

// // Method to recalculate milestone progress from tasks
// projectSchema.methods.recalculateMilestoneProgress = async function(milestoneId) {
//   const ActionItem = mongoose.model('ActionItem');
//   const milestone = this.milestones.id(milestoneId);
  
//   if (!milestone) return;

//   const completedTasks = await ActionItem.find({
//     milestoneId: milestoneId,
//     status: 'Completed'
//   });

//   if (completedTasks.length === 0) {
//     milestone.progress = 0;
//     milestone.status = 'Not Started';
//     return;
//   }

//   let totalProgress = 0;
//   completedTasks.forEach(task => {
//     if (task.completionGrade && task.completionGrade.score) {
//       const effectiveScore = (task.completionGrade.score / 5) * task.taskWeight;
//       totalProgress += effectiveScore;
//     }
//   });

//   milestone.progress = Math.min(100, Math.round(totalProgress));

//   if (milestone.progress === 0) {
//     milestone.status = 'Not Started';
//   } else if (milestone.progress >= 100 && milestone.manuallyCompleted) {
//     milestone.status = 'Completed';
//     if (!milestone.completedDate) {
//       milestone.completedDate = new Date();
//     }
//   } else if (milestone.progress > 0) {
//     milestone.status = 'In Progress';
//   }

//   this.progress = this.calculateProjectProgress();
// };

// // Static method to get projects by supervisor
// projectSchema.statics.getProjectsBySupervisor = function(supervisorId) {
//   return this.find({
//     'milestones.assignedSupervisor': supervisorId,
//     isActive: true,
//     approvalStatus: 'approved'
//   })
//   .populate('projectManager', 'fullName email role')
//   .populate('milestones.assignedSupervisor', 'fullName email department')
//   .populate('milestones.subMilestones.assignedSupervisor', 'fullName email department')
//   .sort({ createdAt: -1 });
// };

// // Static method to get supervisor's milestones (including sub-milestones)
// projectSchema.statics.getSupervisorMilestones = async function(supervisorId) {
//   const projects = await this.find({
//     $or: [
//       { 'milestones.assignedSupervisor': supervisorId },
//       { 'milestones.subMilestones.assignedSupervisor': supervisorId }
//     ],
//     isActive: true,
//     approvalStatus: 'approved'
//   })
//   .populate('projectManager', 'fullName email')
//   .populate('milestones.assignedSupervisor', 'fullName email')
//   .populate('milestones.subMilestones.assignedSupervisor', 'fullName email');

//   const result = [];
  
//   projects.forEach(project => {
//     project.milestones.forEach(milestone => {
//       // Check if supervisor is assigned to main milestone
//       if (milestone.assignedSupervisor && milestone.assignedSupervisor._id.equals(supervisorId)) {
//         result.push({
//           project: {
//             _id: project._id,
//             name: project.name,
//             code: project.code,
//             status: project.status
//           },
//           milestone: {
//             _id: milestone._id,
//             title: milestone.title,
//             description: milestone.description,
//             weight: milestone.weight,
//             progress: milestone.progress,
//             status: milestone.status,
//             dueDate: milestone.dueDate,
//             totalTaskWeightAssigned: milestone.totalTaskWeightAssigned,
//             subMilestoneCount: milestone.subMilestones?.length || 0,
//             type: 'milestone'
//           }
//         });
//       }

//       // Check sub-milestones recursively
//       if (milestone.subMilestones && milestone.subMilestones.length > 0) {
//         const subMilestoneResults = findSupervisorSubMilestones(
//           milestone.subMilestones,
//           supervisorId,
//           project,
//           milestone
//         );
//         result.push(...subMilestoneResults);
//       }
//     });
//   });

//   return result;
// };

// // Helper function to find sub-milestones assigned to supervisor
// function findSupervisorSubMilestones(subMilestones, supervisorId, project, parentMilestone) {
//   const results = [];
  
//   subMilestones.forEach(subMilestone => {
//     if (subMilestone.assignedSupervisor && subMilestone.assignedSupervisor._id.equals(supervisorId)) {
//       results.push({
//         project: {
//           _id: project._id,
//           name: project.name,
//           code: project.code,
//           status: project.status
//         },
//         milestone: {
//           _id: subMilestone._id,
//           title: subMilestone.title,
//           description: subMilestone.description,
//           weight: subMilestone.weight,
//           progress: subMilestone.progress,
//           status: subMilestone.status,
//           dueDate: subMilestone.dueDate,
//           subMilestoneCount: subMilestone.subMilestones?.length || 0,
//           type: 'sub-milestone',
//           parentMilestone: {
//             _id: parentMilestone._id,
//             title: parentMilestone.title
//           }
//         }
//       });
//     }

//     if (subMilestone.subMilestones && subMilestone.subMilestones.length > 0) {
//       const nestedResults = findSupervisorSubMilestones(
//         subMilestone.subMilestones,
//         supervisorId,
//         project,
//         parentMilestone
//       );
//       results.push(...nestedResults);
//     }
//   });

//   return results;
// }

// // Static method to get project statistics
// projectSchema.statics.getStatistics = async function() {
//   const stats = await this.aggregate([
//     {
//       $match: { isActive: true, approvalStatus: 'approved' }
//     },
//     {
//       $group: {
//         _id: null,
//         total: { $sum: 1 },
//         planning: {
//           $sum: { $cond: [{ $eq: ['$status', 'Planning'] }, 1, 0] }
//         },
//         approved: {
//           $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
//         },
//         inProgress: {
//           $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
//         },
//         completed: {
//           $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
//         },
//         onHold: {
//           $sum: { $cond: [{ $eq: ['$status', 'On Hold'] }, 1, 0] }
//         },
//         cancelled: {
//           $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
//         },
//         averageProgress: { $avg: '$progress' }
//       }
//     }
//   ]);

//   const overdue = await this.countDocuments({
//     isActive: true,
//     approvalStatus: 'approved',
//     status: { $nin: ['Completed', 'Cancelled'] },
//     'timeline.endDate': { $lt: new Date() }
//   });

//   return stats.length > 0 ? { ...stats[0], overdue } : {
//     total: 0,
//     planning: 0,
//     approved: 0,
//     inProgress: 0,
//     completed: 0,
//     onHold: 0,
//     cancelled: 0,
//     averageProgress: 0,
//     overdue: 0
//   };
// };

// // Static method to search projects
// projectSchema.statics.searchProjects = function(searchQuery, filters = {}) {
//   const query = {
//     isActive: true,
//     approvalStatus: 'approved',
//     $or: [
//       { name: new RegExp(searchQuery, 'i') },
//       { code: new RegExp(searchQuery, 'i') },
//       { description: new RegExp(searchQuery, 'i') },
//       { tags: new RegExp(searchQuery, 'i') }
//     ]
//   };

//   if (filters.status) query.status = filters.status;
//   if (filters.department) query.department = filters.department;
//   if (filters.priority) query.priority = filters.priority;
//   if (filters.projectType) query.projectType = filters.projectType;

//   return this.find(query)
//     .populate('projectManager', 'fullName email role department')
//     .populate('budgetCodeId', 'code name')
//     .sort({ createdAt: -1 });
// };

// // Add method to calculate health score
// projectSchema.methods.calculateHealthScore = function() {
//   let scheduleScore = 100;
//   let budgetScore = 100;
//   let scopeScore = 100;
//   let qualityScore = 100;
//   let teamScore = 100;

//   // Schedule health
//   if (this.timeline && this.timeline.endDate) {
//     const daysRemaining = Math.ceil((this.timeline.endDate - new Date()) / (1000 * 60 * 60 * 24));
//     const totalDays = Math.ceil((this.timeline.endDate - this.timeline.startDate) / (1000 * 60 * 60 * 24));
//     const expectedProgress = ((totalDays - daysRemaining) / totalDays) * 100;
//     const deviation = this.progress - expectedProgress;
    
//     if (deviation < -20) scheduleScore = 50;
//     else if (deviation < -10) scheduleScore = 70;
//     else if (deviation < 0) scheduleScore = 85;
//   }

//   // Budget health
//   if (this.resources && this.resources.budget) {
//     const budgetUtilization = (this.resources.budget.spent / this.resources.budget.allocated) * 100;
//     const scheduleUtilization = this.progress;
//     const budgetDeviation = budgetUtilization - scheduleUtilization;
    
//     if (budgetDeviation > 20) budgetScore = 50;
//     else if (budgetDeviation > 10) budgetScore = 70;
//     else if (budgetDeviation > 5) budgetScore = 85;
//   }

//   // Scope health (based on change requests)
//   const pendingChanges = this.changeRequests.filter(cr => cr.status === 'Pending').length;
//   if (pendingChanges > 5) scopeScore = 60;
//   else if (pendingChanges > 3) scopeScore = 75;
//   else if (pendingChanges > 1) scopeScore = 90;

//   // Quality health (based on issues and quality metrics)
//   const criticalIssues = this.issues.filter(i => i.severity === 'Critical' && i.status === 'Open').length;
//   if (criticalIssues > 3) qualityScore = 50;
//   else if (criticalIssues > 1) qualityScore = 70;
//   else if (criticalIssues > 0) qualityScore = 85;

//   // Team health (based on milestones and risks)
//   const overdueMilestones = this.milestones.filter(m => 
//     m.status !== 'Completed' && m.dueDate && new Date(m.dueDate) < new Date()
//   ).length;
//   if (overdueMilestones > 3) teamScore = 60;
//   else if (overdueMilestones > 1) teamScore = 75;
//   else if (overdueMilestones > 0) teamScore = 90;

//   // Calculate overall
//   const overall = Math.round(
//     (scheduleScore + budgetScore + scopeScore + qualityScore + teamScore) / 5
//   );

//   this.healthScore = {
//     overall,
//     schedule: scheduleScore,
//     budget: budgetScore,
//     scope: scopeScore,
//     quality: qualityScore,
//     team: teamScore,
//     lastUpdated: new Date()
//   };

//   return this.healthScore;
// };

// // Add method for timeline analysis
// projectSchema.methods.getTimelineAnalysis = function() {
//   const now = new Date();
//   const totalDuration = this.timeline.endDate - this.timeline.startDate;
//   const elapsed = now - this.timeline.startDate;
//   const remaining = this.timeline.endDate - now;
  
//   const percentTimeElapsed = (elapsed / totalDuration) * 100;
//   const percentComplete = this.progress;
  
//   return {
//     percentTimeElapsed: Math.round(percentTimeElapsed),
//     percentComplete,
//     schedulePerformanceIndex: percentComplete / percentTimeElapsed,
//     daysElapsed: Math.ceil(elapsed / (1000 * 60 * 60 * 24)),
//     daysRemaining: Math.ceil(remaining / (1000 * 60 * 60 * 24)),
//     isAheadOfSchedule: percentComplete > percentTimeElapsed,
//     isOnTrack: Math.abs(percentComplete - percentTimeElapsed) <= 5,
//     isBehindSchedule: percentComplete < percentTimeElapsed - 5
//   };
// };

// // Static method to get projects by department
// projectSchema.statics.getByDepartment = function(department, options = {}) {
//   const query = {
//     department,
//     isActive: true,
//     approvalStatus: 'approved'
//   };

//   return this.find(query)
//     .populate('projectManager', 'fullName email role')
//     .sort({ createdAt: -1 })
//     .limit(options.limit || 50);
// };

// const Project = mongoose.model('Project', projectSchema);

// module.exports = Project;










// const mongoose = require('mongoose');

// // Sub-milestone schema (recursive structure)
// const subMilestoneSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   weight: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0,
//     required: true
//   },
//   dueDate: {
//     type: Date
//   },
//   assignedSupervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   status: {
//     type: String,
//     enum: ['Not Started', 'In Progress', 'Completed'],
//     default: 'Not Started'
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   subMilestones: [], // Will be populated recursively
//   completedDate: Date,
//   completedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   updatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: Date
// }, { _id: true });

// // Enable recursive structure
// subMilestoneSchema.add({
//   subMilestones: [subMilestoneSchema]
// });

// const milestoneSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: function() { return this.parent().approvalStatus !== 'draft'; },
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   dueDate: {
//     type: Date
//   },
//   assignedSupervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: function() { return this.parent().approvalStatus !== 'draft'; }
//   },
//   weight: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   status: {
//     type: String,
//     enum: ['Not Started', 'In Progress', 'Completed'],
//     default: 'Not Started'
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   totalTaskWeightAssigned: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   // NEW: Sub-milestones for breakdown
//   subMilestones: [subMilestoneSchema],
//   completedDate: {
//     type: Date
//   },
//   manuallyCompleted: {
//     type: Boolean,
//     default: false
//   },
//   completedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }
// }, { _id: true, timestamps: true });

// const projectSchema = new mongoose.Schema({
//   code: {
//     type: String,
//     unique: true,
//     sparse: true,
//     trim: true,
//     uppercase: true
//   },
//   name: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     trim: true,
//     maxlength: 255
//   },
//   description: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     trim: true
//   },
//   projectType: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     enum: [
//       'Site Build',
//       'Colocation',
//       'Power Projects',
//       'Tower Maintenance',
//       'Refurbishment (Gen)',
//       'Kiosk',
//       'Managed Service',
//       'IT Implementation', 
//       'Process Improvement',
//       'Product Development',
//       'Training Program',
//       'Facility Upgrade',
//       'Equipment Installation',
//       'System Integration',
//       'Research & Development',
//       'Maintenance',
//       'Other'
//     ]
//   },
//   priority: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     enum: ['Low', 'Medium', 'High', 'Critical'],
//     default: 'Medium'
//   },
//   status: {
//     type: String,
//     enum: ['Planning', 'Approved', 'In Progress', 'Completed', 'On Hold', 'Cancelled'],
//     default: 'Planning'
//   },
//   approvalStatus: {
//     type: String,
//     enum: ['draft', 'pending', 'approved', 'rejected'],
//     default: 'draft'
//   },
//   submittedAt: Date,
//   submittedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   approvedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   approvedAt: Date,
//   rejectionReason: String,
//   department: {
//     type: String,
//     required: function() { return this.approvalStatus !== 'draft'; },
//     enum: ['Roll Out', 'Operations', 'IT', 'Finance', 'HR', 'Marketing', 'Supply Chain', 'Facilities']
//   },
//   projectManager: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: function() { return this.approvalStatus !== 'draft'; }
//   },
//   timeline: {
//     startDate: {
//       type: Date,
//       required: function() { return this.approvalStatus !== 'draft'; }
//     },
//     endDate: {
//       type: Date,
//       required: function() { return this.approvalStatus !== 'draft'; }
//     }
//   },
//   budgetCodeId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'BudgetCode',
//     default: null
//   },
//   milestones: [milestoneSchema],
//   teamMembers: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     role: {
//       type: String,
//       trim: true
//     },
//     addedDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   tags: [{
//     type: String,
//     trim: true
//   }],
//   resources: {
//     budget: {
//       allocated: Number,
//       spent: Number,
//       remaining: Number,
//       currency: {
//         type: String,
//         default: 'XAF'
//       }
//     },
//     manpower: [{
//       role: String,
//       count: Number,
//       allocated: Number,
//       hoursLogged: {
//         type: Number,
//         default: 0
//       }
//     }],
//     equipment: [{
//       name: String,
//       quantity: Number,
//       status: String
//     }]
//   },
//   risks: [{
//     title: String,
//     description: String,
//     category: {
//       type: String,
//       enum: ['Technical', 'Financial', 'Resource', 'Schedule', 'External', 'Other']
//     },
//     probability: {
//       type: String,
//       enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
//     },
//     impact: {
//       type: String,
//       enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
//     },
//     mitigation: String,
//     contingency: String,
//     owner: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     status: {
//       type: String,
//       enum: ['Identified', 'Analyzing', 'Mitigating', 'Monitoring', 'Closed'],
//       default: 'Identified'
//     },
//     identifiedDate: Date,
//     closedDate: Date
//   }],
//   issues: [{
//     title: String,
//     description: String,
//     severity: {
//       type: String,
//       enum: ['Low', 'Medium', 'High', 'Critical']
//     },
//     status: {
//       type: String,
//       enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
//       default: 'Open'
//     },
//     assignedTo: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reportedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reportedDate: Date,
//     resolvedDate: Date,
//     resolution: String
//   }],
//   changeRequests: [{
//     title: String,
//     description: String,
//     requestedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     requestDate: Date,
//     type: {
//       type: String,
//       enum: ['Scope', 'Schedule', 'Budget', 'Resources', 'Quality', 'Other']
//     },
//     impact: String,
//     justification: String,
//     status: {
//       type: String,
//       enum: ['Pending', 'Approved', 'Rejected', 'Implemented'],
//       default: 'Pending'
//     },
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     approvalDate: Date,
//     implementationDate: Date
//   }],
//   meetings: [{
//     title: String,
//     date: Date,
//     duration: Number,
//     attendees: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }],
//     agenda: [String],
//     minutes: String,
//     actionItems: [{
//       description: String,
//       assignedTo: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       },
//       dueDate: Date,
//       status: String
//     }],
//     organizer: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
//   healthScore: {
//     overall: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     schedule: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     budget: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     scope: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     quality: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     team: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     lastUpdated: Date
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   updatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes
// projectSchema.index({ code: 1 }, { unique: true, sparse: true });
// projectSchema.index({ name: 1 });
// projectSchema.index({ department: 1 });
// projectSchema.index({ projectManager: 1 });
// projectSchema.index({ status: 1 });
// projectSchema.index({ approvalStatus: 1 });
// projectSchema.index({ priority: 1 });
// projectSchema.index({ 'milestones.assignedSupervisor': 1 });
// projectSchema.index({ 'milestones.subMilestones.assignedSupervisor': 1 }); // NEW
// projectSchema.index({ createdBy: 1 });
// projectSchema.index({ createdAt: -1 });
// projectSchema.index({ isActive: 1 });

// // Helper function to generate unique project code
// async function generateProjectCode(department) {
//   const Project = mongoose.model('Project');
  
//   const deptPrefixes = {
//     'Operations': 'OPS',
//     'IT': 'IT',
//     'Finance': 'FIN',
//     'HR': 'HR',
//     'Marketing': 'MKT',
//     'Supply Chain': 'SCM',
//     'Facilities': 'FAC',
//     'Roll Out': 'RO'
//   };
  
//   const prefix = deptPrefixes[department] || 'GEN';
//   const year = new Date().getFullYear().toString().slice(-2);
  
//   const latestProject = await Project.findOne({
//     code: new RegExp(`^${prefix}${year}-`, 'i')
//   }).sort({ code: -1 }).limit(1);
  
//   let sequence = 1;
//   if (latestProject && latestProject.code) {
//     const match = latestProject.code.match(/-(\d+)$/);
//     if (match) {
//       sequence = parseInt(match[1]) + 1;
//     }
//   }
  
//   return `${prefix}${year}-${String(sequence).padStart(4, '0')}`;
// }

// // Pre-save hook
// projectSchema.pre('save', async function(next) {
//   try {
//     if (this.isModified('approvalStatus') && this.approvalStatus === 'approved' && !this.code) {
//       this.code = await generateProjectCode(this.department);
      
//       let exists = await this.constructor.findOne({ code: this.code });
//       let attempts = 0;
//       while (exists && attempts < 10) {
//         const match = this.code.match(/^([A-Z]+\d{2}-)(\d+)$/);
//         if (match) {
//           const newSeq = parseInt(match[2]) + 1;
//           this.code = `${match[1]}${String(newSeq).padStart(4, '0')}`;
//           exists = await this.constructor.findOne({ code: this.code });
//           attempts++;
//         } else {
//           break;
//         }
//       }
      
//       if (exists) {
//         return next(new Error('Unable to generate unique project code. Please try again.'));
//       }
//     }
    
//     if (this.approvalStatus !== 'draft') {
//       if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
//         if (this.timeline.endDate <= this.timeline.startDate) {
//           return next(new Error('End date must be after start date'));
//         }
//       }
      
//       if (this.milestones && this.milestones.length > 0) {
//         const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//         if (totalWeight !== 100) {
//           return next(new Error(`Milestone weights must sum to 100%. Current total: ${totalWeight}%`));
//         }
//       }
//     }
    
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// // Method to submit for approval
// projectSchema.methods.submitForApproval = function() {
//   if (!this.name || !this.description || !this.projectType || !this.priority || 
//       !this.department || !this.projectManager || !this.timeline || 
//       !this.timeline.startDate || !this.timeline.endDate) {
//     throw new Error('All required fields must be completed before submission');
//   }

//   if (!this.milestones || this.milestones.length === 0) {
//     throw new Error('At least one milestone is required');
//   }

//   const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//   if (totalWeight !== 100) {
//     throw new Error(`Milestone weights must sum to 100%. Current total: ${totalWeight}%`);
//   }

//   for (const milestone of this.milestones) {
//     if (!milestone.assignedSupervisor) {
//       throw new Error(`Milestone "${milestone.title}" must have an assigned supervisor`);
//     }
//   }

//   this.approvalStatus = 'pending';
//   this.submittedAt = new Date();
// };

// // Method to approve project
// projectSchema.methods.approve = function(userId) {
//   this.approvalStatus = 'approved';
//   this.approvedBy = userId;
//   this.approvedAt = new Date();
//   this.status = 'Planning';
// };

// // Method to reject project
// projectSchema.methods.reject = function(userId, reason) {
//   this.approvalStatus = 'rejected';
//   this.approvedBy = userId;
//   this.approvedAt = new Date();
//   this.rejectionReason = reason;
// };

// // Method to calculate project progress from milestones
// projectSchema.methods.calculateProjectProgress = function() {
//   if (!this.milestones || this.milestones.length === 0) {
//     return 0;
//   }

//   const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//   if (totalWeight === 0) return 0;

//   const weightedProgress = this.milestones.reduce((sum, m) => {
//     return sum + ((m.progress || 0) * (m.weight || 0) / 100);
//   }, 0);

//   return Math.round(weightedProgress);
// };

// // Method to recalculate milestone progress from tasks
// projectSchema.methods.recalculateMilestoneProgress = async function(milestoneId) {
//   const ActionItem = mongoose.model('ActionItem');
//   const milestone = this.milestones.id(milestoneId);
  
//   if (!milestone) return;

//   const completedTasks = await ActionItem.find({
//     milestoneId: milestoneId,
//     status: 'Completed'
//   });

//   if (completedTasks.length === 0) {
//     milestone.progress = 0;
//     milestone.status = 'Not Started';
//     return;
//   }

//   let totalProgress = 0;
//   completedTasks.forEach(task => {
//     if (task.completionGrade && task.completionGrade.score) {
//       const effectiveScore = (task.completionGrade.score / 5) * task.taskWeight;
//       totalProgress += effectiveScore;
//     }
//   });

//   milestone.progress = Math.min(100, Math.round(totalProgress));

//   if (milestone.progress === 0) {
//     milestone.status = 'Not Started';
//   } else if (milestone.progress >= 100 && milestone.manuallyCompleted) {
//     milestone.status = 'Completed';
//     if (!milestone.completedDate) {
//       milestone.completedDate = new Date();
//     }
//   } else if (milestone.progress > 0) {
//     milestone.status = 'In Progress';
//   }

//   this.progress = this.calculateProjectProgress();
// };

// // Static method to get projects by supervisor
// projectSchema.statics.getProjectsBySupervisor = function(supervisorId) {
//   return this.find({
//     'milestones.assignedSupervisor': supervisorId,
//     isActive: true,
//     approvalStatus: 'approved'
//   })
//   .populate('projectManager', 'fullName email role')
//   .populate('milestones.assignedSupervisor', 'fullName email department')
//   .populate('milestones.subMilestones.assignedSupervisor', 'fullName email department')
//   .sort({ createdAt: -1 });
// };

// // Static method to get supervisor's milestones (including sub-milestones)
// projectSchema.statics.getSupervisorMilestones = async function(supervisorId) {
//   const projects = await this.find({
//     $or: [
//       { 'milestones.assignedSupervisor': supervisorId },
//       { 'milestones.subMilestones.assignedSupervisor': supervisorId }
//     ],
//     isActive: true,
//     approvalStatus: 'approved'
//   })
//   .populate('projectManager', 'fullName email')
//   .populate('milestones.assignedSupervisor', 'fullName email')
//   .populate('milestones.subMilestones.assignedSupervisor', 'fullName email');

//   const result = [];
  
//   projects.forEach(project => {
//     project.milestones.forEach(milestone => {
//       // Check if supervisor is assigned to main milestone
//       if (milestone.assignedSupervisor && milestone.assignedSupervisor._id.equals(supervisorId)) {
//         result.push({
//           project: {
//             _id: project._id,
//             name: project.name,
//             code: project.code,
//             status: project.status
//           },
//           milestone: {
//             _id: milestone._id,
//             title: milestone.title,
//             description: milestone.description,
//             weight: milestone.weight,
//             progress: milestone.progress,
//             status: milestone.status,
//             dueDate: milestone.dueDate,
//             totalTaskWeightAssigned: milestone.totalTaskWeightAssigned,
//             subMilestoneCount: milestone.subMilestones?.length || 0,
//             type: 'milestone'
//           }
//         });
//       }

//       // Check sub-milestones recursively
//       if (milestone.subMilestones && milestone.subMilestones.length > 0) {
//         const subMilestoneResults = findSupervisorSubMilestones(
//           milestone.subMilestones,
//           supervisorId,
//           project,
//           milestone
//         );
//         result.push(...subMilestoneResults);
//       }
//     });
//   });

//   return result;
// };

// // Helper function to find sub-milestones assigned to supervisor
// function findSupervisorSubMilestones(subMilestones, supervisorId, project, parentMilestone) {
//   const results = [];
  
//   subMilestones.forEach(subMilestone => {
//     if (subMilestone.assignedSupervisor && subMilestone.assignedSupervisor._id.equals(supervisorId)) {
//       results.push({
//         project: {
//           _id: project._id,
//           name: project.name,
//           code: project.code,
//           status: project.status
//         },
//         milestone: {
//           _id: subMilestone._id,
//           title: subMilestone.title,
//           description: subMilestone.description,
//           weight: subMilestone.weight,
//           progress: subMilestone.progress,
//           status: subMilestone.status,
//           dueDate: subMilestone.dueDate,
//           subMilestoneCount: subMilestone.subMilestones?.length || 0,
//           type: 'sub-milestone',
//           parentMilestone: {
//             _id: parentMilestone._id,
//             title: parentMilestone.title
//           }
//         }
//       });
//     }

//     if (subMilestone.subMilestones && subMilestone.subMilestones.length > 0) {
//       const nestedResults = findSupervisorSubMilestones(
//         subMilestone.subMilestones,
//         supervisorId,
//         project,
//         parentMilestone
//       );
//       results.push(...nestedResults);
//     }
//   });

//   return results;
// }

// // Static method to get project statistics
// projectSchema.statics.getStatistics = async function() {
//   const stats = await this.aggregate([
//     {
//       $match: { isActive: true, approvalStatus: 'approved' }
//     },
//     {
//       $group: {
//         _id: null,
//         total: { $sum: 1 },
//         planning: {
//           $sum: { $cond: [{ $eq: ['$status', 'Planning'] }, 1, 0] }
//         },
//         approved: {
//           $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
//         },
//         inProgress: {
//           $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
//         },
//         completed: {
//           $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
//         },
//         onHold: {
//           $sum: { $cond: [{ $eq: ['$status', 'On Hold'] }, 1, 0] }
//         },
//         cancelled: {
//           $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
//         },
//         averageProgress: { $avg: '$progress' }
//       }
//     }
//   ]);

//   const overdue = await this.countDocuments({
//     isActive: true,
//     approvalStatus: 'approved',
//     status: { $nin: ['Completed', 'Cancelled'] },
//     'timeline.endDate': { $lt: new Date() }
//   });

//   return stats.length > 0 ? { ...stats[0], overdue } : {
//     total: 0,
//     planning: 0,
//     approved: 0,
//     inProgress: 0,
//     completed: 0,
//     onHold: 0,
//     cancelled: 0,
//     averageProgress: 0,
//     overdue: 0
//   };
// };

// // Static method to search projects
// projectSchema.statics.searchProjects = function(searchQuery, filters = {}) {
//   const query = {
//     isActive: true,
//     approvalStatus: 'approved',
//     $or: [
//       { name: new RegExp(searchQuery, 'i') },
//       { code: new RegExp(searchQuery, 'i') },
//       { description: new RegExp(searchQuery, 'i') },
//       { tags: new RegExp(searchQuery, 'i') }
//     ]
//   };

//   if (filters.status) query.status = filters.status;
//   if (filters.department) query.department = filters.department;
//   if (filters.priority) query.priority = filters.priority;
//   if (filters.projectType) query.projectType = filters.projectType;

//   return this.find(query)
//     .populate('projectManager', 'fullName email role department')
//     .populate('budgetCodeId', 'code name')
//     .sort({ createdAt: -1 });
// };

// // Static method to get projects by department
// projectSchema.statics.getByDepartment = function(department, options = {}) {
//   const query = {
//     department,
//     isActive: true,
//     approvalStatus: 'approved'
//   };

//   return this.find(query)
//     .populate('projectManager', 'fullName email role')
//     .sort({ createdAt: -1 })
//     .limit(options.limit || 50);
// };

// const Project = mongoose.model('Project', projectSchema);

// module.exports = Project;










// const mongoose = require('mongoose');

// const milestoneSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   dueDate: {
//     type: Date
//   },
//   assignedSupervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   weight: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0,
//     required: true
//   },
//   status: {
//     type: String,
//     enum: ['Not Started', 'In Progress', 'Completed'],
//     default: 'Not Started'
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   totalTaskWeightAssigned: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   completedDate: {
//     type: Date
//   },
//   manuallyCompleted: {
//     type: Boolean,
//     default: false
//   },
//   completedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   attachments: [{
//     name: String,
//     url: String,
//     uploadedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     uploadedAt: {
//       type: Date,
//       default: Date.now
//     },
//     size: Number,
//     mimetype: String
//   }],
//   risks: [{
//     description: String,
//     severity: {
//       type: String,
//       enum: ['Low', 'Medium', 'High', 'Critical']
//     },
//     mitigation: String,
//     identifiedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     identifiedAt: Date,
//     status: {
//       type: String,
//       enum: ['Active', 'Mitigated', 'Resolved'],
//       default: 'Active'
//     }
//   }],
//   dependencies: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Project'
//   }],
//   notes: [{
//     content: String,
//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     createdAt: {
//       type: Date,
//       default: Date.now
//     }
//   }]
// }, { _id: true, timestamps: true });

// const projectSchema = new mongoose.Schema({
//   code: {
//     type: String,
//     unique: true,
//     trim: true,
//     uppercase: true
//   },
//   name: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 255
//   },
//   description: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   projectType: {
//     type: String,
//     required: true,
//     enum: [
//       // 'Infrastructure',
//       'Site Build',
//       'Colocation',
//       'Power Projects',
//       'Tower Maintenance',
//       'Refurbishment (Gen)',
//       'Kiosk',
//       'Managed Service',
//       'IT Implementation', 
//       'Process Improvement',
//       'Product Development',
//       'Training Program',
//       'Facility Upgrade',
//       'Equipment Installation',
//       'System Integration',
//       'Research & Development',
//       'Maintenance',
//       'Other'
//     ]
//   },
//   priority: {
//     type: String,
//     required: true,
//     enum: ['Low', 'Medium', 'High', 'Critical'],
//     default: 'Medium'
//   },
//   status: {
//     type: String,
//     enum: ['Planning', 'Approved', 'In Progress', 'Completed', 'On Hold', 'Cancelled'],
//     default: 'Planning'
//   },
//   department: {
//     type: String,
//     required: true,
//     enum: ['Roll Out', 'Operations', 'IT', 'Finance', 'HR', 'Marketing', 'Supply Chain', 'Facilities']
//   },
//   projectManager: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   timeline: {
//     startDate: {
//       type: Date,
//       required: true
//     },
//     endDate: {
//       type: Date,
//       required: true
//     }
//   },
//   budgetCodeId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'BudgetCode',
//     default: null
//   },
//   milestones: [milestoneSchema],
//   teamMembers: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     role: {
//       type: String,
//       trim: true
//     },
//     addedDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   tags: [{
//     type: String,
//     trim: true
//   }],
//   attachments: [{
//     filename: String,
//     originalName: String,
//     path: String,
//     size: Number,
//     uploadDate: {
//       type: Date,
//       default: Date.now
//     },
//     uploadedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
//   phases: [{
//     name: String,
//     description: String,
//     startDate: Date,
//     endDate: Date,
//     status: {
//       type: String,
//       enum: ['Not Started', 'In Progress', 'Completed', 'Delayed'],
//       default: 'Not Started'
//     },
//     completionCriteria: [String],
//     deliverables: [String]
//   }],

//   resources: {
//     budget: {
//       allocated: Number,
//       spent: Number,
//       remaining: Number,
//       currency: {
//         type: String,
//         default: 'XAF'
//       }
//     },
//     manpower: [{
//       role: String,
//       count: Number,
//       allocated: Number,
//       hoursLogged: {
//         type: Number,
//         default: 0
//       }
//     }],
//     equipment: [{
//       name: String,
//       quantity: Number,
//       status: String
//     }]
//   },

//   risks: [{
//     title: String,
//     description: String,
//     category: {
//       type: String,
//       enum: ['Technical', 'Financial', 'Resource', 'Schedule', 'External', 'Other']
//     },
//     probability: {
//       type: String,
//       enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
//     },
//     impact: {
//       type: String,
//       enum: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
//     },
//     mitigation: String,
//     contingency: String,
//     owner: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     status: {
//       type: String,
//       enum: ['Identified', 'Analyzing', 'Mitigating', 'Monitoring', 'Closed'],
//       default: 'Identified'
//     },
//     identifiedDate: Date,
//     closedDate: Date
//   }],

//   issues: [{
//     title: String,
//     description: String,
//     severity: {
//       type: String,
//       enum: ['Low', 'Medium', 'High', 'Critical']
//     },
//     status: {
//       type: String,
//       enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
//       default: 'Open'
//     },
//     assignedTo: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reportedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reportedDate: Date,
//     resolvedDate: Date,
//     resolution: String
//   }],

//   changeRequests: [{
//     title: String,
//     description: String,
//     requestedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     requestDate: Date,
//     type: {
//       type: String,
//       enum: ['Scope', 'Schedule', 'Budget', 'Resources', 'Quality', 'Other']
//     },
//     impact: String,
//     justification: String,
//     status: {
//       type: String,
//       enum: ['Pending', 'Approved', 'Rejected', 'Implemented'],
//       default: 'Pending'
//     },
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     approvalDate: Date,
//     implementationDate: Date
//   }],

//   communications: [{
//     subject: String,
//     message: String,
//     sentBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     recipients: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }],
//     sentAt: Date,
//     read: [{
//       user: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       },
//       readAt: Date
//     }]
//   }],

//   meetings: [{
//     title: String,
//     date: Date,
//     duration: Number, // in minutes
//     attendees: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }],
//     agenda: [String],
//     minutes: String,
//     actionItems: [{
//       description: String,
//       assignedTo: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       },
//       dueDate: Date,
//       status: String
//     }],
//     organizer: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],

//   dependencies: [{
//     dependsOn: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Project'
//     },
//     type: {
//       type: String,
//       enum: ['Finish-to-Start', 'Start-to-Start', 'Finish-to-Finish', 'Start-to-Finish'],
//       default: 'Finish-to-Start'
//     },
//     description: String
//   }],

//   qualityMetrics: [{
//     name: String,
//     target: Number,
//     actual: Number,
//     unit: String,
//     status: {
//       type: String,
//       enum: ['On Track', 'At Risk', 'Off Track'],
//       default: 'On Track'
//     }
//   }],

//   lessons: [{
//     category: {
//       type: String,
//       enum: ['Success', 'Challenge', 'Best Practice', 'Improvement']
//     },
//     description: String,
//     addedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     addedDate: Date
//   }],

//   healthScore: {
//     overall: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     schedule: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     budget: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     scope: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     quality: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     team: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 100
//     },
//     lastUpdated: Date
//   },

//   customFields: [{
//     name: String,
//     value: mongoose.Schema.Types.Mixed,
//     type: {
//       type: String,
//       enum: ['text', 'number', 'date', 'boolean', 'list']
//     }
//   }],
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   updatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes
// projectSchema.index({ code: 1 }, { unique: true, sparse: true });
// projectSchema.index({ name: 1 });
// projectSchema.index({ department: 1 });
// projectSchema.index({ projectManager: 1 });
// projectSchema.index({ status: 1 });
// projectSchema.index({ priority: 1 });
// projectSchema.index({ 'milestones.assignedSupervisor': 1 });
// projectSchema.index({ 'timeline.startDate': 1, 'timeline.endDate': 1 });
// projectSchema.index({ createdAt: -1 });
// projectSchema.index({ isActive: 1 });

// // Virtual for project duration
// projectSchema.virtual('duration').get(function() {
//   if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
//     const diffTime = Math.abs(this.timeline.endDate - this.timeline.startDate);
//     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
//     return diffDays;
//   }
//   return 0;
// });

// // Virtual for days remaining
// projectSchema.virtual('daysRemaining').get(function() {
//   if (this.timeline && this.timeline.endDate) {
//     const today = new Date();
//     const diffTime = this.timeline.endDate - today;
//     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
//     return diffDays;
//   }
//   return 0;
// });

// // Virtual for overdue status
// projectSchema.virtual('isOverdue').get(function() {
//   if (this.timeline && this.timeline.endDate && this.status !== 'Completed') {
//     return new Date() > this.timeline.endDate;
//   }
//   return false;
// });

// // Helper function to generate unique project code
// async function generateProjectCode(department) {
//   const Project = mongoose.model('Project');
  
//   // Create department prefix (first 2-3 letters)
//   const deptPrefixes = {
//     'Operations': 'OPS',
//     'IT': 'IT',
//     'Finance': 'FIN',
//     'HR': 'HR',
//     'Marketing': 'MKT',
//     'Supply Chain': 'SCM',
//     'Facilities': 'FAC'
//   };
  
//   const prefix = deptPrefixes[department] || 'GEN';
  
//   // Get current year
//   const year = new Date().getFullYear().toString().slice(-2);
  
//   // Find the latest project with this prefix and year
//   const latestProject = await Project.findOne({
//     code: new RegExp(`^${prefix}${year}-`, 'i')
//   }).sort({ code: -1 }).limit(1);
  
//   let sequence = 1;
//   if (latestProject && latestProject.code) {
//     const match = latestProject.code.match(/-(\d+)$/);
//     if (match) {
//       sequence = parseInt(match[1]) + 1;
//     }
//   }
  
//   // Format: DEPT-YY-NNNN (e.g., SCM-25-0001)
//   return `${prefix}${year}-${String(sequence).padStart(4, '0')}`;
// }

// // Pre-save hook to generate code and validate
// projectSchema.pre('save', async function(next) {
//   try {
//     // Generate unique project code if new and no code provided
//     if (this.isNew && !this.code) {
//       this.code = await generateProjectCode(this.department);
      
//       // Ensure uniqueness (in rare cases of race conditions)
//       let exists = await this.constructor.findOne({ code: this.code });
//       let attempts = 0;
//       while (exists && attempts < 10) {
//         // Extract number and increment
//         const match = this.code.match(/^([A-Z]+\d{2}-)(\d+)$/);
//         if (match) {
//           const newSeq = parseInt(match[2]) + 1;
//           this.code = `${match[1]}${String(newSeq).padStart(4, '0')}`;
//           exists = await this.constructor.findOne({ code: this.code });
//           attempts++;
//         } else {
//           break;
//         }
//       }
      
//       if (exists) {
//         return next(new Error('Unable to generate unique project code. Please try again.'));
//       }
//     }
    
//     // Validate timeline
//     if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
//       if (this.timeline.endDate <= this.timeline.startDate) {
//         return next(new Error('End date must be after start date'));
//       }
//     }
    
//     // Validate milestone weights sum to 100%
//     if (this.milestones && this.milestones.length > 0) {
//       const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//       if (totalWeight !== 100) {
//         return next(new Error(`Milestone weights must sum to 100%. Current total: ${totalWeight}%`));
//       }
//     }
    
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// // Method to calculate project progress from milestones
// projectSchema.methods.calculateProjectProgress = function() {
//   if (!this.milestones || this.milestones.length === 0) {
//     return 0;
//   }

//   const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//   if (totalWeight === 0) return 0;

//   const weightedProgress = this.milestones.reduce((sum, m) => {
//     return sum + ((m.progress || 0) * (m.weight || 0) / 100);
//   }, 0);

//   return Math.round(weightedProgress);
// };

// // Method to recalculate milestone progress from tasks
// projectSchema.methods.recalculateMilestoneProgress = async function(milestoneId) {
//   const ActionItem = mongoose.model('ActionItem');
//   const milestone = this.milestones.id(milestoneId);
  
//   if (!milestone) return;

//   // Get all completed tasks for this milestone
//   const completedTasks = await ActionItem.find({
//     milestoneId: milestoneId,
//     status: 'Completed'
//   });

//   if (completedTasks.length === 0) {
//     milestone.progress = 0;
//     milestone.status = 'Not Started';
//     return;
//   }

//   // Calculate progress: sum of (taskWeight × grade/5)
//   let totalProgress = 0;
//   completedTasks.forEach(task => {
//     if (task.completionGrade && task.completionGrade.score) {
//       const effectiveScore = (task.completionGrade.score / 5) * task.taskWeight;
//       totalProgress += effectiveScore;
//     }
//   });

//   milestone.progress = Math.min(100, Math.round(totalProgress));

//   // Update status
//   if (milestone.progress === 0) {
//     milestone.status = 'Not Started';
//   } else if (milestone.progress >= 100 && milestone.manuallyCompleted) {
//     milestone.status = 'Completed';
//     if (!milestone.completedDate) {
//       milestone.completedDate = new Date();
//     }
//   } else if (milestone.progress > 0) {
//     milestone.status = 'In Progress';
//   }

//   // Update project progress
//   this.progress = this.calculateProjectProgress();
// };

// // Static method to get projects by supervisor
// projectSchema.statics.getProjectsBySupervisor = function(supervisorId) {
//   return this.find({
//     'milestones.assignedSupervisor': supervisorId,
//     isActive: true
//   })
//   .populate('projectManager', 'fullName email role')
//   .populate('milestones.assignedSupervisor', 'fullName email department')
//   .sort({ createdAt: -1 });
// };

// // Static method to get supervisor's milestones
// projectSchema.statics.getSupervisorMilestones = async function(supervisorId) {
//   const projects = await this.find({
//     'milestones.assignedSupervisor': supervisorId,
//     isActive: true
//   })
//   .populate('projectManager', 'fullName email')
//   .populate('milestones.assignedSupervisor', 'fullName email');

//   const result = [];
  
//   projects.forEach(project => {
//     const supervisorMilestones = project.milestones.filter(m => 
//       m.assignedSupervisor && m.assignedSupervisor._id.equals(supervisorId)
//     );

//     supervisorMilestones.forEach(milestone => {
//       result.push({
//         project: {
//           _id: project._id,
//           name: project.name,
//           code: project.code,
//           status: project.status
//         },
//         milestone: {
//           _id: milestone._id,
//           title: milestone.title,
//           description: milestone.description,
//           weight: milestone.weight,
//           progress: milestone.progress,
//           status: milestone.status,
//           dueDate: milestone.dueDate,
//           totalTaskWeightAssigned: milestone.totalTaskWeightAssigned,
//           manuallyCompleted: milestone.manuallyCompleted
//         }
//       });
//     });
//   });

//   return result;
// };

// // Static method to get project statistics
// projectSchema.statics.getStatistics = async function() {
//   const stats = await this.aggregate([
//     {
//       $match: { isActive: true }
//     },
//     {
//       $group: {
//         _id: null,
//         total: { $sum: 1 },
//         planning: {
//           $sum: { $cond: [{ $eq: ['$status', 'Planning'] }, 1, 0] }
//         },
//         approved: {
//           $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
//         },
//         inProgress: {
//           $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
//         },
//         completed: {
//           $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
//         },
//         onHold: {
//           $sum: { $cond: [{ $eq: ['$status', 'On Hold'] }, 1, 0] }
//         },
//         cancelled: {
//           $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
//         },
//         averageProgress: { $avg: '$progress' }
//       }
//     }
//   ]);

//   const overdue = await this.countDocuments({
//     isActive: true,
//     status: { $nin: ['Completed', 'Cancelled'] },
//     'timeline.endDate': { $lt: new Date() }
//   });

//   return stats.length > 0 ? { ...stats[0], overdue } : {
//     total: 0,
//     planning: 0,
//     approved: 0,
//     inProgress: 0,
//     completed: 0,
//     onHold: 0,
//     cancelled: 0,
//     averageProgress: 0,
//     overdue: 0
//   };
// };

// // Static method to search projects
// projectSchema.statics.searchProjects = function(searchQuery, filters = {}) {
//   const query = {
//     isActive: true,
//     $or: [
//       { name: new RegExp(searchQuery, 'i') },
//       { code: new RegExp(searchQuery, 'i') },
//       { description: new RegExp(searchQuery, 'i') },
//       { tags: new RegExp(searchQuery, 'i') }
//     ]
//   };

//   if (filters.status) query.status = filters.status;
//   if (filters.department) query.department = filters.department;
//   if (filters.priority) query.priority = filters.priority;
//   if (filters.projectType) query.projectType = filters.projectType;

//   return this.find(query)
//     .populate('projectManager', 'fullName email role department')
//     .populate('budgetCodeId', 'code name')
//     .sort({ createdAt: -1 });
// };

// // Add method to calculate health score
// projectSchema.methods.calculateHealthScore = function() {
//   let scheduleScore = 100;
//   let budgetScore = 100;
//   let scopeScore = 100;
//   let qualityScore = 100;
//   let teamScore = 100;

//   // Schedule health
//   if (this.timeline && this.timeline.endDate) {
//     const daysRemaining = Math.ceil((this.timeline.endDate - new Date()) / (1000 * 60 * 60 * 24));
//     const totalDays = Math.ceil((this.timeline.endDate - this.timeline.startDate) / (1000 * 60 * 60 * 24));
//     const expectedProgress = ((totalDays - daysRemaining) / totalDays) * 100;
//     const deviation = this.progress - expectedProgress;
    
//     if (deviation < -20) scheduleScore = 50;
//     else if (deviation < -10) scheduleScore = 70;
//     else if (deviation < 0) scheduleScore = 85;
//   }

//   // Budget health
//   if (this.resources && this.resources.budget) {
//     const budgetUtilization = (this.resources.budget.spent / this.resources.budget.allocated) * 100;
//     const scheduleUtilization = this.progress;
//     const budgetDeviation = budgetUtilization - scheduleUtilization;
    
//     if (budgetDeviation > 20) budgetScore = 50;
//     else if (budgetDeviation > 10) budgetScore = 70;
//     else if (budgetDeviation > 5) budgetScore = 85;
//   }

//   // Scope health (based on change requests)
//   const pendingChanges = this.changeRequests.filter(cr => cr.status === 'Pending').length;
//   if (pendingChanges > 5) scopeScore = 60;
//   else if (pendingChanges > 3) scopeScore = 75;
//   else if (pendingChanges > 1) scopeScore = 90;

//   // Quality health (based on issues and quality metrics)
//   const criticalIssues = this.issues.filter(i => i.severity === 'Critical' && i.status === 'Open').length;
//   if (criticalIssues > 3) qualityScore = 50;
//   else if (criticalIssues > 1) qualityScore = 70;
//   else if (criticalIssues > 0) qualityScore = 85;

//   // Team health (based on milestones and risks)
//   const overdueMilestones = this.milestones.filter(m => 
//     m.status !== 'Completed' && m.dueDate && new Date(m.dueDate) < new Date()
//   ).length;
//   if (overdueMilestones > 3) teamScore = 60;
//   else if (overdueMilestones > 1) teamScore = 75;
//   else if (overdueMilestones > 0) teamScore = 90;

//   // Calculate overall
//   const overall = Math.round(
//     (scheduleScore + budgetScore + scopeScore + qualityScore + teamScore) / 5
//   );

//   this.healthScore = {
//     overall,
//     schedule: scheduleScore,
//     budget: budgetScore,
//     scope: scopeScore,
//     quality: qualityScore,
//     team: teamScore,
//     lastUpdated: new Date()
//   };

//   return this.healthScore;
// };

// // Add method for timeline analysis
// projectSchema.methods.getTimelineAnalysis = function() {
//   const now = new Date();
//   const totalDuration = this.timeline.endDate - this.timeline.startDate;
//   const elapsed = now - this.timeline.startDate;
//   const remaining = this.timeline.endDate - now;
  
//   const percentTimeElapsed = (elapsed / totalDuration) * 100;
//   const percentComplete = this.progress;
  
//   return {
//     percentTimeElapsed: Math.round(percentTimeElapsed),
//     percentComplete,
//     schedulePerformanceIndex: percentComplete / percentTimeElapsed,
//     daysElapsed: Math.ceil(elapsed / (1000 * 60 * 60 * 24)),
//     daysRemaining: Math.ceil(remaining / (1000 * 60 * 60 * 24)),
//     isAheadOfSchedule: percentComplete > percentTimeElapsed,
//     isOnTrack: Math.abs(percentComplete - percentTimeElapsed) <= 5,
//     isBehindSchedule: percentComplete < percentTimeElapsed - 5
//   };
// };

// // Static method to get projects by department
// projectSchema.statics.getByDepartment = function(department, options = {}) {
//   const query = {
//     department,
//     isActive: true
//   };

//   return this.find(query)
//     .populate('projectManager', 'fullName email role')
//     .sort({ createdAt: -1 })
//     .limit(options.limit || 50);
// };

// const Project = mongoose.model('Project', projectSchema);

// module.exports = Project;

