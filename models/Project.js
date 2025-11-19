const mongoose = require('mongoose');

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
    default: 0,
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
  totalTaskWeightAssigned: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
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
  },
  attachments: [{
    name: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    size: Number,
    mimetype: String
  }],
  risks: [{
    description: String,
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical']
    },
    mitigation: String,
    identifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    identifiedAt: Date,
    status: {
      type: String,
      enum: ['Active', 'Mitigated', 'Resolved'],
      default: 'Active'
    }
  }],
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  notes: [{
    content: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { _id: true, timestamps: true });

const projectSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  projectType: {
    type: String,
    required: true,
    enum: [
      // 'Infrastructure',
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
    required: true,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Planning', 'Approved', 'In Progress', 'Completed', 'On Hold', 'Cancelled'],
    default: 'Planning'
  },
  department: {
    type: String,
    required: true,
    enum: ['Roll Out', 'Operations', 'IT', 'Finance', 'HR', 'Marketing', 'Supply Chain', 'Facilities']
  },
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timeline: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  budgetCodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BudgetCode',
    default: null
  },
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
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  phases: [{
    name: String,
    description: String,
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Completed', 'Delayed'],
      default: 'Not Started'
    },
    completionCriteria: [String],
    deliverables: [String]
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

  communications: [{
    subject: String,
    message: String,
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    sentAt: Date,
    read: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: Date
    }]
  }],

  meetings: [{
    title: String,
    date: Date,
    duration: Number, // in minutes
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

  dependencies: [{
    dependsOn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    type: {
      type: String,
      enum: ['Finish-to-Start', 'Start-to-Start', 'Finish-to-Finish', 'Start-to-Finish'],
      default: 'Finish-to-Start'
    },
    description: String
  }],

  qualityMetrics: [{
    name: String,
    target: Number,
    actual: Number,
    unit: String,
    status: {
      type: String,
      enum: ['On Track', 'At Risk', 'Off Track'],
      default: 'On Track'
    }
  }],

  lessons: [{
    category: {
      type: String,
      enum: ['Success', 'Challenge', 'Best Practice', 'Improvement']
    },
    description: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedDate: Date
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

  customFields: [{
    name: String,
    value: mongoose.Schema.Types.Mixed,
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'boolean', 'list']
    }
  }],
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
projectSchema.index({ 'milestones.assignedSupervisor': 1 });
projectSchema.index({ 'timeline.startDate': 1, 'timeline.endDate': 1 });
projectSchema.index({ createdAt: -1 });
projectSchema.index({ isActive: 1 });

// Virtual for project duration
projectSchema.virtual('duration').get(function() {
  if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
    const diffTime = Math.abs(this.timeline.endDate - this.timeline.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Virtual for days remaining
projectSchema.virtual('daysRemaining').get(function() {
  if (this.timeline && this.timeline.endDate) {
    const today = new Date();
    const diffTime = this.timeline.endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Virtual for overdue status
projectSchema.virtual('isOverdue').get(function() {
  if (this.timeline && this.timeline.endDate && this.status !== 'Completed') {
    return new Date() > this.timeline.endDate;
  }
  return false;
});

// Helper function to generate unique project code
async function generateProjectCode(department) {
  const Project = mongoose.model('Project');
  
  // Create department prefix (first 2-3 letters)
  const deptPrefixes = {
    'Operations': 'OPS',
    'IT': 'IT',
    'Finance': 'FIN',
    'HR': 'HR',
    'Marketing': 'MKT',
    'Supply Chain': 'SCM',
    'Facilities': 'FAC'
  };
  
  const prefix = deptPrefixes[department] || 'GEN';
  
  // Get current year
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Find the latest project with this prefix and year
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
  
  // Format: DEPT-YY-NNNN (e.g., SCM-25-0001)
  return `${prefix}${year}-${String(sequence).padStart(4, '0')}`;
}

// Pre-save hook to generate code and validate
projectSchema.pre('save', async function(next) {
  try {
    // Generate unique project code if new and no code provided
    if (this.isNew && !this.code) {
      this.code = await generateProjectCode(this.department);
      
      // Ensure uniqueness (in rare cases of race conditions)
      let exists = await this.constructor.findOne({ code: this.code });
      let attempts = 0;
      while (exists && attempts < 10) {
        // Extract number and increment
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
    
    // Validate timeline
    if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
      if (this.timeline.endDate <= this.timeline.startDate) {
        return next(new Error('End date must be after start date'));
      }
    }
    
    // Validate milestone weights sum to 100%
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

  // Get all completed tasks for this milestone
  const completedTasks = await ActionItem.find({
    milestoneId: milestoneId,
    status: 'Completed'
  });

  if (completedTasks.length === 0) {
    milestone.progress = 0;
    milestone.status = 'Not Started';
    return;
  }

  // Calculate progress: sum of (taskWeight × grade/5)
  let totalProgress = 0;
  completedTasks.forEach(task => {
    if (task.completionGrade && task.completionGrade.score) {
      const effectiveScore = (task.completionGrade.score / 5) * task.taskWeight;
      totalProgress += effectiveScore;
    }
  });

  milestone.progress = Math.min(100, Math.round(totalProgress));

  // Update status
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

  // Update project progress
  this.progress = this.calculateProjectProgress();
};

// Static method to get projects by supervisor
projectSchema.statics.getProjectsBySupervisor = function(supervisorId) {
  return this.find({
    'milestones.assignedSupervisor': supervisorId,
    isActive: true
  })
  .populate('projectManager', 'fullName email role')
  .populate('milestones.assignedSupervisor', 'fullName email department')
  .sort({ createdAt: -1 });
};

// Static method to get supervisor's milestones
projectSchema.statics.getSupervisorMilestones = async function(supervisorId) {
  const projects = await this.find({
    'milestones.assignedSupervisor': supervisorId,
    isActive: true
  })
  .populate('projectManager', 'fullName email')
  .populate('milestones.assignedSupervisor', 'fullName email');

  const result = [];
  
  projects.forEach(project => {
    const supervisorMilestones = project.milestones.filter(m => 
      m.assignedSupervisor && m.assignedSupervisor._id.equals(supervisorId)
    );

    supervisorMilestones.forEach(milestone => {
      result.push({
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
          totalTaskWeightAssigned: milestone.totalTaskWeightAssigned,
          manuallyCompleted: milestone.manuallyCompleted
        }
      });
    });
  });

  return result;
};

// Static method to get project statistics
projectSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        planning: {
          $sum: { $cond: [{ $eq: ['$status', 'Planning'] }, 1, 0] }
        },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
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
    status: { $nin: ['Completed', 'Cancelled'] },
    'timeline.endDate': { $lt: new Date() }
  });

  return stats.length > 0 ? { ...stats[0], overdue } : {
    total: 0,
    planning: 0,
    approved: 0,
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

  // Scope health (based on change requests)
  const pendingChanges = this.changeRequests.filter(cr => cr.status === 'Pending').length;
  if (pendingChanges > 5) scopeScore = 60;
  else if (pendingChanges > 3) scopeScore = 75;
  else if (pendingChanges > 1) scopeScore = 90;

  // Quality health (based on issues and quality metrics)
  const criticalIssues = this.issues.filter(i => i.severity === 'Critical' && i.status === 'Open').length;
  if (criticalIssues > 3) qualityScore = 50;
  else if (criticalIssues > 1) qualityScore = 70;
  else if (criticalIssues > 0) qualityScore = 85;

  // Team health (based on milestones and risks)
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
    isActive: true
  };

  return this.find(query)
    .populate('projectManager', 'fullName email role')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;

