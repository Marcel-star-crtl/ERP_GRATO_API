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

  department: {
    type: String,
    required: true,
    enum: [
      'General',
      'IT',
      'HR',
      'Finance',
      'Operations',
      'Sales',
      'Engineering',
      'Business Development & Supply Chain',
      'Admin',
      'Other'
    ]
  },
  
  budgetType: {
    type: String,
    enum: ['OPEX', 'CAPEX', 'PROJECT', 'OPERATIONAL'],
    default: 'OPERATIONAL'
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
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    allocatedDate: {
      type: Date,
      default: Date.now
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['allocated', 'released', 'spent'],
      default: 'allocated'
    }
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

  fiscalYear: {
    type: Number,
    required: true,
    default: () => new Date().getFullYear()
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

// Virtual for budget status indicator (renamed from 'status' to avoid conflict)
budgetCodeSchema.virtual('utilizationStatus').get(function() {
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
budgetCodeSchema.index({ fiscalYear: 1 });

// INSTANCE METHODS

// Method: Check if budget can be allocated
budgetCodeSchema.methods.canAllocate = function(amount) {
  if (!this.active) {
    return false;
  }
  return this.remaining >= amount;
};

// Method: Allocate budget to a requisition
budgetCodeSchema.methods.allocateBudget = async function(requisitionId, amount, userId = null) {
  if (!this.canAllocate(amount)) {
    throw new Error(`Insufficient budget. Available: ${this.remaining}, Required: ${amount}`);
  }

  // Add allocation record with ALL required fields
  this.allocations.push({
    requisitionId: requisitionId,
    amount: amount, // ✅ REQUIRED FIELD
    allocatedBy: userId,
    allocatedDate: new Date(),
    status: 'allocated'
  });

  // Update used amount
  this.used += amount;

  await this.save();
  return this;
};

// Method: Release allocated budget (e.g., if requisition is cancelled)
budgetCodeSchema.methods.releaseBudget = async function(requisitionId) {
  const allocation = this.allocations.find(
    a => a.requisitionId.toString() === requisitionId.toString() && a.status === 'allocated'
  );

  if (!allocation) {
    throw new Error('No active allocation found for this requisition');
  }

  // Update allocation status
  allocation.status = 'released';

  // Decrease used amount
  this.used -= allocation.amount;

  await this.save();
  return this;
};

// Method: Mark allocation as spent
budgetCodeSchema.methods.markAsSpent = async function(requisitionId) {
  const allocation = this.allocations.find(
    a => a.requisitionId.toString() === requisitionId.toString() && a.status === 'allocated'
  );

  if (!allocation) {
    throw new Error('No active allocation found for this requisition');
  }

  // Update allocation status
  allocation.status = 'spent';

  await this.save();
  return this;
};

// Method: Update budget amount
budgetCodeSchema.methods.updateBudget = async function(newAmount, reason, userId) {
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
};

// STATIC METHODS

// Static: Get budget codes with availability for a department
budgetCodeSchema.statics.getAvailableForDepartment = function(department, minAvailable = 0) {
  return this.find({
    department: { $in: [department, 'General'] },
    active: true,
    $expr: { $gte: [{ $subtract: ['$budget', '$used'] }, minAvailable] }
  }).sort({ utilizationPercentage: 1 });
};

// Static: Get budget summary for fiscal year
budgetCodeSchema.statics.getFiscalYearSummary = async function(fiscalYear = new Date().getFullYear()) {
  const summary = await this.aggregate([
    {
      $match: {
        fiscalYear: fiscalYear,
        active: true
      }
    },
    {
      $group: {
        _id: '$department',
        totalBudget: { $sum: '$budget' },
        totalUsed: { $sum: '$used' },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        department: '$_id',
        totalBudget: 1,
        totalUsed: 1,
        remaining: { $subtract: ['$totalBudget', '$totalUsed'] },
        utilizationRate: {
          $multiply: [
            { $divide: ['$totalUsed', '$totalBudget'] },
            100
          ]
        },
        count: 1
      }
    },
    {
      $sort: { utilizationRate: -1 }
    }
  ]);

  return summary;
};

// Static: Get budget codes requiring attention (high utilization)
budgetCodeSchema.statics.getRequiringAttention = async function(threshold = 75) {
  const codes = await this.find({ active: true });
  
  return codes.filter(code => {
    const utilization = (code.used / code.budget) * 100;
    return utilization >= threshold;
  });
};

// Static: Get utilization summary
budgetCodeSchema.statics.getUtilizationSummary = async function() {
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
};

// PRE-SAVE MIDDLEWARE

// Pre-save middleware to validate dates and amounts
budgetCodeSchema.pre('save', function(next) {
  // Validate dates
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    return next(new Error('End date cannot be before start date'));
  }
  
  // Validate used amount doesn't exceed budget
  if (this.used > this.budget) {
    return next(new Error('Used amount cannot exceed budget'));
  }
  
  // Ensure allocations have required amount field
  if (this.allocations && this.allocations.length > 0) {
    for (let i = 0; i < this.allocations.length; i++) {
      const allocation = this.allocations[i];
      
      // Check if amount exists and is valid
      if (allocation.amount === undefined || allocation.amount === null) {
        return next(new Error(`Allocation at index ${i} is missing required field: amount`));
      }
      
      // Ensure amount is a number
      if (typeof allocation.amount !== 'number' || isNaN(allocation.amount)) {
        return next(new Error(`Allocation at index ${i} has invalid amount: must be a number`));
      }
      
      // Ensure amount is not negative
      if (allocation.amount < 0) {
        return next(new Error(`Allocation at index ${i} has negative amount`));
      }
    }
  }
  
  next();
});

// Pre-update middleware
budgetCodeSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  if (update.used && update.budget) {
    if (update.used > update.budget) {
      return next(new Error('Used amount cannot exceed budget'));
    }
  }

  next();
});

// Create and export model
const BudgetCode = mongoose.model('BudgetCode', budgetCodeSchema);

module.exports = BudgetCode;