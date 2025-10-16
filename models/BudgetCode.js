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




