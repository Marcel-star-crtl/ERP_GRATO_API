const mongoose = require('mongoose');

const budgetCodeSchema = new mongoose.Schema({
  // Basic Information
  code: {
    type: String,
    required: [true, 'Budget code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9\-_]+$/, 'Budget code can only contain uppercase letters, numbers, hyphens and underscores']
  },
  
  name: {
    type: String,
    required: [true, 'Budget name is required'],
    trim: true
  },
  
  description: {
    type: String,
    trim: true
  },

  // Budget Details
  budget: {
    type: Number,
    required: [true, 'Total budget amount is required'],
    min: [0, 'Budget cannot be negative']
  },
  
  used: {
    type: Number,
    default: 0,
    min: [0, 'Used amount cannot be negative']
  },

  // Department/Project Association
  department: {
    type: String,
    required: [true, 'Department or project is required'],
    trim: true
  },
  
  budgetType: {
    type: String,
    required: [true, 'Budget type is required'],
    enum: ['departmental', 'project', 'capital', 'operational', 'emergency', 'maintenance']
  },
  
  budgetPeriod: {
    type: String,
    required: [true, 'Budget period is required'],
    enum: ['monthly', 'quarterly', 'yearly', 'project']
  },

  // Budget Owner
  budgetOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Budget owner is required']
  },

  // Approval Workflow
  status: {
    type: String,
    enum: [
      'pending',
      'pending_departmental_head',
      'pending_head_of_business',
      'pending_finance',
      'active',
      'rejected',
      'suspended',
      'expired'
    ],
    default: 'pending'
  },

  approvalChain: [{
    level: {
      type: Number,
      required: true
    },
    approver: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      role: { type: String, required: true },
      department: { type: String }
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    actionDate: Date,
    actionTime: String,
    comments: String
  }],

  // Allocation Tracking
  allocations: [{
    requisitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseRequisition'
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    actualSpent: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['allocated', 'spent', 'refunded', 'cancelled'],
      default: 'allocated'
    },
    allocationDate: {
      type: Date,
      default: Date.now
    },
    completionDate: Date,
    notes: String
  }],

  // Budget History
  budgetHistory: [{
    previousBudget: Number,
    newBudget: Number,
    changeAmount: Number,
    reason: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changeDate: {
      type: Date,
      default: Date.now
    }
  }],

  // Dates
  startDate: {
    type: Date,
    default: Date.now
  },
  
  endDate: {
    type: Date
  },

  // Status Management
  active: {
    type: Boolean,
    default: true
  },

  // Rejection Details
  rejectionReason: String,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionDate: Date,

  // Creation & Modification
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true
});

// Virtual for remaining budget
budgetCodeSchema.virtual('remaining').get(function() {
  return this.budget - this.used;
});

// Virtual for utilization percentage
budgetCodeSchema.virtual('utilizationPercentage').get(function() {
  if (this.budget === 0) return 0;
  return Math.round((this.used / this.budget) * 100);
});

// Virtual for utilization rate (for detailed reporting)
budgetCodeSchema.virtual('utilizationRate').get(function() {
  if (this.budget === 0) return 0;
  return ((this.used / this.budget) * 100).toFixed(2);
});

// Virtual for budget status indicator
budgetCodeSchema.virtual('budgetStatus').get(function() {
  const utilization = this.utilizationPercentage;
  if (utilization >= 95) return 'critical';
  if (utilization >= 80) return 'warning';
  if (utilization >= 60) return 'moderate';
  return 'healthy';
});

// Ensure virtuals are included in JSON output
budgetCodeSchema.set('toJSON', { virtuals: true });
budgetCodeSchema.set('toObject', { virtuals: true });

// Indexes for performance
budgetCodeSchema.index({ code: 1 });
budgetCodeSchema.index({ status: 1 });
budgetCodeSchema.index({ department: 1 });
budgetCodeSchema.index({ budgetType: 1 });
budgetCodeSchema.index({ active: 1 });
budgetCodeSchema.index({ createdBy: 1 });
budgetCodeSchema.index({ 'approvalChain.approver.email': 1 });

// Methods
budgetCodeSchema.methods = {
  /**
   * Allocate budget to a requisition
   */
  async allocateBudget(requisitionId, amount) {
    if (amount > this.remaining) {
      throw new Error('Insufficient budget available');
    }

    this.allocations.push({
      requisitionId,
      allocatedAmount: amount,
      status: 'allocated',
      allocationDate: new Date()
    });

    this.used += amount;
    await this.save();
    
    return this;
  },

  /**
   * Record actual spending
   */
  async recordSpending(requisitionId, actualAmount) {
    const allocation = this.allocations.find(
      a => a.requisitionId.toString() === requisitionId.toString()
    );

    if (!allocation) {
      throw new Error('Allocation not found');
    }

    allocation.actualSpent = actualAmount;
    allocation.status = 'spent';
    allocation.completionDate = new Date();

    // Adjust used amount if actual is different from allocated
    const difference = actualAmount - allocation.allocatedAmount;
    this.used += difference;

    await this.save();
    return this;
  },

  /**
   * Update budget amount
   */
  async updateBudget(newAmount, reason, userId) {
    this.budgetHistory.push({
      previousBudget: this.budget,
      newBudget: newAmount,
      changeAmount: newAmount - this.budget,
      reason,
      changedBy: userId,
      changeDate: new Date()
    });

    this.budget = newAmount;
    this.lastModifiedBy = userId;
    
    await this.save();
    return this;
  }
};

// Static methods
budgetCodeSchema.statics = {
  /**
   * Get budget codes requiring attention (high utilization)
   */
  async getRequiringAttention(threshold = 75) {
    const codes = await this.find({ active: true });
    
    return codes.filter(code => {
      const utilization = (code.used / code.budget) * 100;
      return utilization >= threshold;
    });
  },

  /**
   * Get available budget codes for a department
   */
  async getAvailableForDepartment(department) {
    return await this.find({
      active: true,
      $or: [
        { department: department },
        { department: `PROJECT-${department}` }
      ],
      $expr: { $gt: [{ $subtract: ['$budget', '$used'] }, 0] }
    }).sort({ name: 1 });
  },

  /**
   * Get budget utilization summary
   */
  async getUtilizationSummary() {
    const codes = await this.find({ active: true });
    
    const summary = {
      totalBudget: 0,
      totalUsed: 0,
      totalRemaining: 0,
      byDepartment: {},
      byType: {}
    };

    codes.forEach(code => {
      summary.totalBudget += code.budget;
      summary.totalUsed += code.used;
      summary.totalRemaining += (code.budget - code.used);

      // By department
      if (!summary.byDepartment[code.department]) {
        summary.byDepartment[code.department] = {
          budget: 0,
          used: 0,
          remaining: 0,
          count: 0
        };
      }
      summary.byDepartment[code.department].budget += code.budget;
      summary.byDepartment[code.department].used += code.used;
      summary.byDepartment[code.department].remaining += (code.budget - code.used);
      summary.byDepartment[code.department].count++;

      // By type
      if (!summary.byType[code.budgetType]) {
        summary.byType[code.budgetType] = {
          budget: 0,
          used: 0,
          remaining: 0,
          count: 0
        };
      }
      summary.byType[code.budgetType].budget += code.budget;
      summary.byType[code.budgetType].used += code.used;
      summary.byType[code.budgetType].remaining += (code.budget - code.used);
      summary.byType[code.budgetType].count++;
    });

    summary.overallUtilization = summary.totalBudget > 0 
      ? Math.round((summary.totalUsed / summary.totalBudget) * 100) 
      : 0;

    return summary;
  }
};

// Pre-save middleware to validate dates
budgetCodeSchema.pre('save', function(next) {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    next(new Error('End date cannot be before start date'));
  }
  
  if (this.used > this.budget) {
    next(new Error('Used amount cannot exceed budget'));
  }
  
  next();
});

const BudgetCode = mongoose.model('BudgetCode', budgetCodeSchema);

module.exports = BudgetCode;









// const mongoose = require('mongoose');

// const budgetCodeSchema = new mongoose.Schema({
//   // Basic Information
//   code: {
//     type: String,
//     required: true,
//     unique: true,
//     uppercase: true,
//     trim: true,
//     index: true
//   },
//   name: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
  
//   // Budget Details
//   budget: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   used: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
  
//   // Classification
//   department: {
//     type: String,
//     required: true,
//     index: true
//   },
//   budgetType: {
//     type: String,
//     required: true,
//     enum: ['departmental', 'project', 'capital', 'operational', 'emergency', 'maintenance'],
//     index: true
//   },
//   budgetPeriod: {
//     type: String,
//     required: true,
//     enum: ['monthly', 'quarterly', 'yearly', 'project']
//   },
  
//   // Ownership
//   budgetOwner: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
  
//   // Status and Activation
//   active: {
//     type: Boolean,
//     default: false,
//     index: true
//   },
//   status: {
//     type: String,
//     enum: [
//       'pending_departmental_approval',
//       'pending_head_of_business',
//       'pending_finance_activation',
//       'active',
//       'inactive',
//       'rejected',
//       'suspended'
//     ],
//     default: 'pending_departmental_approval',
//     index: true
//   },
  
//   // Approval Workflow
//   approvalChain: [{
//     level: {
//       type: Number,
//       required: true
//     },
//     approver: {
//       name: String,
//       email: String,
//       role: String,
//       department: String
//     },
//     status: {
//       type: String,
//       enum: ['pending', 'approved', 'rejected', 'waiting'],
//       default: 'pending'
//     },
//     assignedDate: {
//       type: Date,
//       default: Date.now
//     },
//     actionDate: Date,
//     actionTime: String,
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     comments: String,
//     responsibilities: {
//       type: Map,
//       of: Boolean
//     }
//   }],
  
//   // Approval Tracking
//   submissionDate: {
//     type: Date,
//     default: Date.now
//   },
//   approvedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   activationDate: Date,
//   rejectionDate: Date,
//   rejectionReason: String,
//   justification: String,
  
//   // Time Period
//   startDate: {
//     type: Date,
//     default: Date.now
//   },
//   endDate: Date,
  
//   // Budget Allocations
//   allocations: [{
//     requisitionId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'PurchaseRequisition'
//     },
//     allocatedAmount: {
//       type: Number,
//       required: true,
//       min: 0
//     },
//     allocationDate: {
//       type: Date,
//       default: Date.now
//     },
//     actualSpent: {
//       type: Number,
//       default: 0,
//       min: 0
//     },
//     status: {
//       type: String,
//       enum: ['allocated', 'spent', 'cancelled'],
//       default: 'allocated'
//     },
//     notes: String
//   }],
  
//   // Budget History
//   budgetHistory: [{
//     previousAmount: Number,
//     newAmount: Number,
//     changeDate: {
//       type: Date,
//       default: Date.now
//     },
//     changedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reason: String
//   }]
// }, {
//   timestamps: true
// });

// // Virtual Fields
// budgetCodeSchema.virtual('remaining').get(function() {
//   return this.budget - this.used;
// });

// budgetCodeSchema.virtual('utilizationPercentage').get(function() {
//   if (this.budget === 0) return 0;
//   return Math.round((this.used / this.budget) * 100);
// });

// budgetCodeSchema.virtual('utilizationRate').get(function() {
//   if (this.budget === 0) return 0;
//   return (this.used / this.budget) * 100;
// });

// budgetCodeSchema.virtual('isExpired').get(function() {
//   if (!this.endDate) return false;
//   return new Date() > this.endDate;
// });

// budgetCodeSchema.virtual('daysUntilExpiry').get(function() {
//   if (!this.endDate) return null;
//   const now = new Date();
//   const expiry = new Date(this.endDate);
//   const diffTime = expiry - now;
//   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
//   return diffDays > 0 ? diffDays : 0;
// });

// budgetCodeSchema.virtual('currentApprovalLevel').get(function() {
//   if (!this.approvalChain || this.approvalChain.length === 0) return null;
//   const pendingStep = this.approvalChain.find(step => step.status === 'pending');
//   return pendingStep ? pendingStep.level : null;
// });

// budgetCodeSchema.virtual('nextApprover').get(function() {
//   if (!this.approvalChain || this.approvalChain.length === 0) return null;
//   const pendingStep = this.approvalChain.find(step => step.status === 'pending');
//   return pendingStep ? pendingStep.approver : null;
// });

// // Ensure virtuals are included in JSON/Object output
// budgetCodeSchema.set('toJSON', { virtuals: true });
// budgetCodeSchema.set('toObject', { virtuals: true });

// // Indexes
// budgetCodeSchema.index({ code: 1 });
// budgetCodeSchema.index({ department: 1, active: 1 });
// budgetCodeSchema.index({ budgetType: 1, active: 1 });
// budgetCodeSchema.index({ status: 1 });
// budgetCodeSchema.index({ createdBy: 1 });
// budgetCodeSchema.index({ 'approvalChain.approver.email': 1 });
// budgetCodeSchema.index({ startDate: 1, endDate: 1 });

// // Methods
// budgetCodeSchema.methods.allocateBudget = async function(requisitionId, amount) {
//   if (!this.active) {
//     throw new Error('Cannot allocate from inactive budget code');
//   }

//   if (this.isExpired) {
//     throw new Error('Budget code has expired');
//   }

//   const availableAmount = this.remaining;
  
//   if (amount > availableAmount) {
//     throw new Error(`Insufficient budget. Available: XAF ${availableAmount.toLocaleString()}, Requested: XAF ${amount.toLocaleString()}`);
//   }

//   this.allocations.push({
//     requisitionId,
//     allocatedAmount: amount,
//     allocationDate: new Date(),
//     status: 'allocated'
//   });

//   this.used += amount;
  
//   await this.save();
  
//   return {
//     success: true,
//     allocated: amount,
//     remaining: this.remaining,
//     utilizationPercentage: this.utilizationPercentage
//   };
// };

// budgetCodeSchema.methods.updateBudget = async function(newBudget, reason, userId) {
//   if (newBudget < this.used) {
//     throw new Error('New budget cannot be less than already used amount');
//   }

//   this.budgetHistory.push({
//     previousAmount: this.budget,
//     newAmount: newBudget,
//     changeDate: new Date(),
//     changedBy: userId,
//     reason: reason || 'Budget adjustment'
//   });

//   this.budget = newBudget;
  
//   await this.save();
  
//   return {
//     success: true,
//     previousBudget: this.budgetHistory[this.budgetHistory.length - 1].previousAmount,
//     newBudget: this.budget,
//     remaining: this.remaining
//   };
// };

// budgetCodeSchema.methods.markAllocationAsSpent = async function(requisitionId, actualAmount) {
//   const allocation = this.allocations.find(
//     alloc => alloc.requisitionId.equals(requisitionId) && alloc.status === 'allocated'
//   );

//   if (!allocation) {
//     throw new Error('Allocation not found or already processed');
//   }

//   allocation.actualSpent = actualAmount;
//   allocation.status = 'spent';

//   // Adjust used amount if actual spending differs from allocated
//   if (actualAmount < allocation.allocatedAmount) {
//     this.used -= (allocation.allocatedAmount - actualAmount);
//   } else if (actualAmount > allocation.allocatedAmount) {
//     const additionalAmount = actualAmount - allocation.allocatedAmount;
//     if (additionalAmount > this.remaining) {
//       throw new Error('Actual spending exceeds remaining budget');
//     }
//     this.used += additionalAmount;
//   }

//   await this.save();
  
//   return {
//     success: true,
//     allocated: allocation.allocatedAmount,
//     actualSpent: actualAmount,
//     variance: actualAmount - allocation.allocatedAmount,
//     remaining: this.remaining
//   };
// };

// budgetCodeSchema.methods.cancelAllocation = async function(requisitionId, reason) {
//   const allocation = this.allocations.find(
//     alloc => alloc.requisitionId.equals(requisitionId) && alloc.status === 'allocated'
//   );

//   if (!allocation) {
//     throw new Error('Active allocation not found');
//   }

//   allocation.status = 'cancelled';
//   allocation.notes = reason || 'Allocation cancelled';
  
//   // Return budget to available pool
//   this.used -= allocation.allocatedAmount;

//   await this.save();
  
//   return {
//     success: true,
//     freedAmount: allocation.allocatedAmount,
//     remaining: this.remaining
//   };
// };

// budgetCodeSchema.methods.suspend = async function(reason) {
//   this.status = 'suspended';
//   this.active = false;
//   this.rejectionReason = reason;
  
//   await this.save();
  
//   return {
//     success: true,
//     message: 'Budget code suspended',
//     reason
//   };
// };

// budgetCodeSchema.methods.reactivate = async function() {
//   if (this.isExpired) {
//     throw new Error('Cannot reactivate expired budget code');
//   }

//   this.status = 'active';
//   this.active = true;
//   this.rejectionReason = null;
  
//   await this.save();
  
//   return {
//     success: true,
//     message: 'Budget code reactivated'
//   };
// };

// // Static Methods
// budgetCodeSchema.statics.getActiveBudgetCodes = function(filters = {}) {
//   return this.find({ active: true, ...filters })
//     .populate('createdBy', 'fullName email')
//     .populate('budgetOwner', 'fullName email')
//     .sort({ code: 1 });
// };

// budgetCodeSchema.statics.getBudgetCodesByDepartment = function(department) {
//   return this.find({ department, active: true })
//     .populate('createdBy', 'fullName email')
//     .populate('budgetOwner', 'fullName email')
//     .sort({ code: 1 });
// };

// budgetCodeSchema.statics.getRequiringAttention = function(threshold = 75) {
//   return this.find({
//     active: true,
//     $expr: {
//       $gte: [
//         { $multiply: [{ $divide: ['$used', '$budget'] }, 100] },
//         threshold
//       ]
//     }
//   })
//   .populate('createdBy', 'fullName email')
//   .populate('budgetOwner', 'fullName email')
//   .sort({ utilizationPercentage: -1 });
// };

// budgetCodeSchema.statics.getPendingApprovals = function(email) {
//   return this.find({
//     'approvalChain': {
//       $elemMatch: {
//         'approver.email': email,
//         status: 'pending'
//       }
//     },
//     active: false
//   })
//   .populate('createdBy', 'fullName email department')
//   .sort({ submissionDate: 1 });
// };

// // Pre-save middleware
// budgetCodeSchema.pre('save', function(next) {
//   // Ensure used amount doesn't exceed budget
//   if (this.used > this.budget) {
//     return next(new Error('Used amount cannot exceed total budget'));
//   }
  
//   // Auto-suspend if over budget
//   if (this.utilizationPercentage >= 100 && this.active) {
//     this.status = 'suspended';
//     this.active = false;
//   }
  
//   next();
// });

// const BudgetCode = mongoose.model('BudgetCode', budgetCodeSchema);

// module.exports = BudgetCode;










// const mongoose = require('mongoose');

// const BudgetCodeSchema = new mongoose.Schema({
//   code: {
//     type: String,
//     required: true,
//     unique: true,
//     uppercase: true,
//     trim: true,
//     match: [/^[A-Z0-9\-_]+$/, 'Budget code can only contain uppercase letters, numbers, hyphens, and underscores']
//   },
//   name: {
//     type: String,
//     required: true,
//     trim: true,
//     minlength: 3,
//     maxlength: 100
//   },
//   description: {
//     type: String,
//     trim: true,
//     maxlength: 500
//   },
//   budget: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   used: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   available: {
//     type: Number,
//     virtual: true,
//     get: function() {
//       return this.budget - this.used;
//     }
//   },
//   utilizationRate: {
//     type: Number,
//     virtual: true,
//     get: function() {
//       return this.budget > 0 ? (this.used / this.budget) * 100 : 0;
//     }
//   },
//   department: {
//     type: String,
//     required: true,
//     trim: true
//     // Removed enum restriction to allow both departments and project IDs
//   },
//   budgetType: {
//     type: String,
//     required: true,
//     enum: [
//       'departmental', 'project', 'capital', 'operational', 
//       'emergency', 'maintenance'
//     ]
//   },
//   budgetPeriod: {
//     type: String,
//     required: true,
//     enum: ['monthly', 'quarterly', 'yearly', 'project']
//   },
//   budgetOwner: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   active: {
//     type: Boolean,
//     default: true
//   },
//   startDate: {
//     type: Date,
//     default: Date.now
//   },
//   endDate: {
//     type: Date
//   },
//   approvedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   // Track budget allocations and spending
//   allocations: [{
//     requisitionId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'PurchaseRequisition',
//       required: true
//     },
//     allocatedAmount: {
//       type: Number,
//       required: true,
//       min: 0
//     },
//     actualSpent: {
//       type: Number,
//       default: 0,
//       min: 0
//     },
//     allocationDate: {
//       type: Date,
//       default: Date.now
//     },
//     status: {
//       type: String,
//       enum: ['allocated', 'spent', 'returned'],
//       default: 'allocated'
//     }
//   }],
//   // Budget history for tracking changes
//   budgetHistory: [{
//     previousBudget: Number,
//     newBudget: Number,
//     reason: String,
//     changedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     changeDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes for efficient querying
// BudgetCodeSchema.index({ code: 1 });
// BudgetCodeSchema.index({ department: 1, active: 1 });
// BudgetCodeSchema.index({ budgetType: 1 });
// BudgetCodeSchema.index({ budgetPeriod: 1 });
// BudgetCodeSchema.index({ active: 1 });

// // Virtual for remaining budget
// BudgetCodeSchema.virtual('remaining').get(function() {
//   return this.budget - this.used;
// });

// // Virtual for utilization percentage
// BudgetCodeSchema.virtual('utilizationPercentage').get(function() {
//   return this.budget > 0 ? Math.round((this.used / this.budget) * 100) : 0;
// });

// // Virtual for status based on utilization
// BudgetCodeSchema.virtual('status').get(function() {
//   const utilization = this.utilizationPercentage;
//   if (utilization >= 90) return 'critical';
//   if (utilization >= 75) return 'high';
//   if (utilization >= 50) return 'moderate';
//   return 'low';
// });

// // Method to check if budget is available for allocation
// BudgetCodeSchema.methods.canAllocate = function(amount) {
//   return this.active && (this.used + amount <= this.budget);
// };

// // Method to allocate budget to a requisition
// BudgetCodeSchema.methods.allocateBudget = function(requisitionId, amount) {
//   if (!this.canAllocate(amount)) {
//     throw new Error('Insufficient budget available for allocation');
//   }
  
//   this.allocations.push({
//     requisitionId,
//     allocatedAmount: amount,
//     allocationDate: new Date(),
//     status: 'allocated'
//   });
  
//   this.used += amount;
//   return this.save();
// };

// // Method to record actual spending
// BudgetCodeSchema.methods.recordSpending = function(requisitionId, actualAmount) {
//   const allocation = this.allocations.find(
//     alloc => alloc.requisitionId.equals(requisitionId) && alloc.status === 'allocated'
//   );
  
//   if (!allocation) {
//     throw new Error('No allocation found for this requisition');
//   }
  
//   // Update the allocation
//   allocation.actualSpent = actualAmount;
//   allocation.status = 'spent';
  
//   // Adjust used amount (could be more or less than allocated)
//   const difference = actualAmount - allocation.allocatedAmount;
//   this.used += difference;
  
//   return this.save();
// };

// // Method to return unused budget
// BudgetCodeSchema.methods.returnBudget = function(requisitionId, returnAmount) {
//   const allocation = this.allocations.find(
//     alloc => alloc.requisitionId.equals(requisitionId)
//   );
  
//   if (!allocation) {
//     throw new Error('No allocation found for this requisition');
//   }
  
//   allocation.status = 'returned';
//   this.used -= returnAmount;
  
//   return this.save();
// };

// // Method to update budget amount
// BudgetCodeSchema.methods.updateBudget = function(newBudget, reason, changedBy) {
//   this.budgetHistory.push({
//     previousBudget: this.budget,
//     newBudget: newBudget,
//     reason: reason,
//     changedBy: changedBy,
//     changeDate: new Date()
//   });
  
//   this.budget = newBudget;
//   return this.save();
// };

// // Static method to get available budget codes for a department
// BudgetCodeSchema.statics.getAvailableForDepartment = function(department) {
//   return this.find({
//     $or: [
//       { department: department },
//       { department: 'General' }
//     ],
//     active: true
//   }).sort({ utilizationRate: 1 }); // Sort by lowest utilization first
// };

// // Static method to get budget codes with low utilization
// BudgetCodeSchema.statics.getLowUtilization = function(threshold = 50) {
//   return this.aggregate([
//     {
//       $addFields: {
//         utilizationRate: {
//           $cond: {
//             if: { $eq: ["$budget", 0] },
//             then: 0,
//             else: { $multiply: [{ $divide: ["$used", "$budget"] }, 100] }
//           }
//         }
//       }
//     },
//     {
//       $match: {
//         active: true,
//         utilizationRate: { $lt: threshold }
//       }
//     },
//     {
//       $sort: { utilizationRate: 1 }
//     }
//   ]);
// };

// // Static method to get budget codes requiring attention
// BudgetCodeSchema.statics.getRequiringAttention = function() {
//   return this.aggregate([
//     {
//       $addFields: {
//         utilizationRate: {
//           $cond: {
//             if: { $eq: ["$budget", 0] },
//             then: 0,
//             else: { $multiply: [{ $divide: ["$used", "$budget"] }, 100] }
//           }
//         }
//       }
//     },
//     {
//       $match: {
//         active: true,
//         utilizationRate: { $gte: 75 }
//       }
//     },
//     {
//       $sort: { utilizationRate: -1 }
//     }
//   ]);
// };

// // Pre-save middleware to validate budget allocation
// BudgetCodeSchema.pre('save', function(next) {
//   if (this.used > this.budget) {
//     return next(new Error('Used budget cannot exceed total budget'));
//   }
  
//   // Set end date for period-based budgets
//   if (this.isNew && !this.endDate) {
//     const now = new Date();
//     switch (this.budgetPeriod) {
//       case 'monthly':
//         this.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
//         break;
//       case 'quarterly':
//         this.endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
//         break;
//       case 'yearly':
//         this.endDate = new Date(now.getFullYear() + 1, 0, 0);
//         break;
//       // Project budgets don't have automatic end dates
//     }
//   }
  
//   next();
// });

// module.exports = mongoose.model('BudgetCode', BudgetCodeSchema);









// const mongoose = require('mongoose');

// const BudgetCodeSchema = new mongoose.Schema({
//   code: {
//     type: String,
//     required: true,
//     unique: true,
//     uppercase: true,
//     trim: true,
//     match: [/^[A-Z0-9\-_]+$/, 'Budget code can only contain uppercase letters, numbers, hyphens, and underscores']
//   },
//   name: {
//     type: String,
//     required: true,
//     trim: true,
//     minlength: 3,
//     maxlength: 100
//   },
//   description: {
//     type: String,
//     trim: true,
//     maxlength: 500
//   },
//   budget: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   used: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   available: {
//     type: Number,
//     virtual: true,
//     get: function() {
//       return this.budget - this.used;
//     }
//   },
//   utilizationRate: {
//     type: Number,
//     virtual: true,
//     get: function() {
//       return this.budget > 0 ? (this.used / this.budget) * 100 : 0;
//     }
//   },
//   department: {
//     type: String,
//     required: true,
//     enum: [
//       'IT', 'Finance', 'HR', 'Operations', 'Marketing', 
//       'Project Alpha', 'Project Beta', 'Infrastructure',
//       'Business Development & Supply Chain', 'General'
//     ]
//   },
//   budgetType: {
//     type: String,
//     required: true,
//     enum: [
//       'departmental', 'project', 'capital', 'operational', 
//       'emergency', 'maintenance'
//     ]
//   },
//   budgetPeriod: {
//     type: String,
//     required: true,
//     enum: ['monthly', 'quarterly', 'yearly', 'project']
//   },
//   budgetOwner: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   active: {
//     type: Boolean,
//     default: true
//   },
//   startDate: {
//     type: Date,
//     default: Date.now
//   },
//   endDate: {
//     type: Date
//   },
//   approvedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   // Track budget allocations and spending
//   allocations: [{
//     requisitionId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'PurchaseRequisition',
//       required: true
//     },
//     allocatedAmount: {
//       type: Number,
//       required: true,
//       min: 0
//     },
//     actualSpent: {
//       type: Number,
//       default: 0,
//       min: 0
//     },
//     allocationDate: {
//       type: Date,
//       default: Date.now
//     },
//     status: {
//       type: String,
//       enum: ['allocated', 'spent', 'returned'],
//       default: 'allocated'
//     }
//   }],
//   // Budget history for tracking changes
//   budgetHistory: [{
//     previousBudget: Number,
//     newBudget: Number,
//     reason: String,
//     changedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     changeDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes for efficient querying
// BudgetCodeSchema.index({ code: 1 });
// BudgetCodeSchema.index({ department: 1, active: 1 });
// BudgetCodeSchema.index({ budgetType: 1 });
// BudgetCodeSchema.index({ budgetPeriod: 1 });
// BudgetCodeSchema.index({ active: 1 });

// // Virtual for remaining budget
// BudgetCodeSchema.virtual('remaining').get(function() {
//   return this.budget - this.used;
// });

// // Virtual for utilization percentage
// BudgetCodeSchema.virtual('utilizationPercentage').get(function() {
//   return this.budget > 0 ? Math.round((this.used / this.budget) * 100) : 0;
// });

// // Virtual for status based on utilization
// BudgetCodeSchema.virtual('status').get(function() {
//   const utilization = this.utilizationPercentage;
//   if (utilization >= 90) return 'critical';
//   if (utilization >= 75) return 'high';
//   if (utilization >= 50) return 'moderate';
//   return 'low';
// });

// // Method to check if budget is available for allocation
// BudgetCodeSchema.methods.canAllocate = function(amount) {
//   return this.active && (this.used + amount <= this.budget);
// };

// // Method to allocate budget to a requisition
// BudgetCodeSchema.methods.allocateBudget = function(requisitionId, amount) {
//   if (!this.canAllocate(amount)) {
//     throw new Error('Insufficient budget available for allocation');
//   }
  
//   this.allocations.push({
//     requisitionId,
//     allocatedAmount: amount,
//     allocationDate: new Date(),
//     status: 'allocated'
//   });
  
//   this.used += amount;
//   return this.save();
// };

// // Method to record actual spending
// BudgetCodeSchema.methods.recordSpending = function(requisitionId, actualAmount) {
//   const allocation = this.allocations.find(
//     alloc => alloc.requisitionId.equals(requisitionId) && alloc.status === 'allocated'
//   );
  
//   if (!allocation) {
//     throw new Error('No allocation found for this requisition');
//   }
  
//   // Update the allocation
//   allocation.actualSpent = actualAmount;
//   allocation.status = 'spent';
  
//   // Adjust used amount (could be more or less than allocated)
//   const difference = actualAmount - allocation.allocatedAmount;
//   this.used += difference;
  
//   return this.save();
// };

// // Method to return unused budget
// BudgetCodeSchema.methods.returnBudget = function(requisitionId, returnAmount) {
//   const allocation = this.allocations.find(
//     alloc => alloc.requisitionId.equals(requisitionId)
//   );
  
//   if (!allocation) {
//     throw new Error('No allocation found for this requisition');
//   }
  
//   allocation.status = 'returned';
//   this.used -= returnAmount;
  
//   return this.save();
// };

// // Method to update budget amount
// BudgetCodeSchema.methods.updateBudget = function(newBudget, reason, changedBy) {
//   this.budgetHistory.push({
//     previousBudget: this.budget,
//     newBudget: newBudget,
//     reason: reason,
//     changedBy: changedBy,
//     changeDate: new Date()
//   });
  
//   this.budget = newBudget;
//   return this.save();
// };

// // Static method to get available budget codes for a department
// BudgetCodeSchema.statics.getAvailableForDepartment = function(department) {
//   return this.find({
//     $or: [
//       { department: department },
//       { department: 'General' }
//     ],
//     active: true
//   }).sort({ utilizationRate: 1 }); // Sort by lowest utilization first
// };

// // Static method to get budget codes with low utilization
// BudgetCodeSchema.statics.getLowUtilization = function(threshold = 50) {
//   return this.aggregate([
//     {
//       $addFields: {
//         utilizationRate: {
//           $cond: {
//             if: { $eq: ["$budget", 0] },
//             then: 0,
//             else: { $multiply: [{ $divide: ["$used", "$budget"] }, 100] }
//           }
//         }
//       }
//     },
//     {
//       $match: {
//         active: true,
//         utilizationRate: { $lt: threshold }
//       }
//     },
//     {
//       $sort: { utilizationRate: 1 }
//     }
//   ]);
// };

// // Static method to get budget codes requiring attention
// BudgetCodeSchema.statics.getRequiringAttention = function() {
//   return this.aggregate([
//     {
//       $addFields: {
//         utilizationRate: {
//           $cond: {
//             if: { $eq: ["$budget", 0] },
//             then: 0,
//             else: { $multiply: [{ $divide: ["$used", "$budget"] }, 100] }
//           }
//         }
//       }
//     },
//     {
//       $match: {
//         active: true,
//         utilizationRate: { $gte: 75 }
//       }
//     },
//     {
//       $sort: { utilizationRate: -1 }
//     }
//   ]);
// };

// // Pre-save middleware to validate budget allocation
// BudgetCodeSchema.pre('save', function(next) {
//   if (this.used > this.budget) {
//     return next(new Error('Used budget cannot exceed total budget'));
//   }
  
//   // Set end date for period-based budgets
//   if (this.isNew && !this.endDate) {
//     const now = new Date();
//     switch (this.budgetPeriod) {
//       case 'monthly':
//         this.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
//         break;
//       case 'quarterly':
//         this.endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
//         break;
//       case 'yearly':
//         this.endDate = new Date(now.getFullYear() + 1, 0, 0);
//         break;
//       // Project budgets don't have automatic end dates
//     }
//   }
  
//   next();
// });

// module.exports = mongoose.model('BudgetCode', BudgetCodeSchema);