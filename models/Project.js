// backend/models/Project.js

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
  }
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
    enum: ['Operations', 'IT', 'Finance', 'HR', 'Marketing', 'Supply Chain', 'Facilities']
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

















// // backend/models/Project.js

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
//   // NEW: Assigned supervisor for this milestone
//   assignedSupervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   // NEW: Weight of this milestone in the project (must sum to 100%)
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
//   // NEW: Calculated from tasks, not manual
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   // NEW: Track total task weights assigned
//   totalTaskWeightAssigned: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   completedDate: {
//     type: Date
//   },
//   // NEW: Supervisor can manually mark as complete
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
//       'Infrastructure',
//       'IT Implementation', 
//       'Process Improvement',
//       'Product Development',
//       'Marketing Campaign',
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
//     enum: ['Operations', 'IT', 'Finance', 'HR', 'Marketing', 'Supply Chain', 'Facilities']
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
//   // UPDATED: Simplified milestones (no sub-milestones)
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

// // Pre-save validation
// projectSchema.pre('save', function(next) {
//   // Validate timeline
//   if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
//     if (this.timeline.endDate <= this.timeline.startDate) {
//       return next(new Error('End date must be after start date'));
//     }
//   }

//   // Validate milestone weights sum to 100%
//   if (this.milestones && this.milestones.length > 0) {
//     const totalWeight = this.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
//     if (totalWeight !== 100) {
//       return next(new Error('Milestone weights must sum to 100%'));
//     }
//   }

//   next();
// });

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
//           code: project.code || `PROJ-${project._id.toString().slice(-6)}`,
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

// const Project = mongoose.model('Project', projectSchema);

// module.exports = Project;








