const mongoose = require('mongoose');

const BudgetCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9\-_]+$/, 'Budget code can only contain uppercase letters, numbers, hyphens, and underscores']
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  budget: {
    type: Number,
    required: true,
    min: 0
  },
  used: {
    type: Number,
    default: 0,
    min: 0
  },
  available: {
    type: Number,
    virtual: true,
    get: function() {
      return this.budget - this.used;
    }
  },
  utilizationRate: {
    type: Number,
    virtual: true,
    get: function() {
      return this.budget > 0 ? (this.used / this.budget) * 100 : 0;
    }
  },
  department: {
    type: String,
    required: true,
    trim: true
    // Removed enum restriction to allow both departments and project IDs
  },
  budgetType: {
    type: String,
    required: true,
    enum: [
      'departmental', 'project', 'capital', 'operational', 
      'emergency', 'maintenance'
    ]
  },
  budgetPeriod: {
    type: String,
    required: true,
    enum: ['monthly', 'quarterly', 'yearly', 'project']
  },
  budgetOwner: {
    type: String,
    required: true,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Track budget allocations and spending
  allocations: [{
    requisitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseRequisition',
      required: true
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
    allocationDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['allocated', 'spent', 'returned'],
      default: 'allocated'
    }
  }],
  // Budget history for tracking changes
  budgetHistory: [{
    previousBudget: Number,
    newBudget: Number,
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
BudgetCodeSchema.index({ code: 1 });
BudgetCodeSchema.index({ department: 1, active: 1 });
BudgetCodeSchema.index({ budgetType: 1 });
BudgetCodeSchema.index({ budgetPeriod: 1 });
BudgetCodeSchema.index({ active: 1 });

// Virtual for remaining budget
BudgetCodeSchema.virtual('remaining').get(function() {
  return this.budget - this.used;
});

// Virtual for utilization percentage
BudgetCodeSchema.virtual('utilizationPercentage').get(function() {
  return this.budget > 0 ? Math.round((this.used / this.budget) * 100) : 0;
});

// Virtual for status based on utilization
BudgetCodeSchema.virtual('status').get(function() {
  const utilization = this.utilizationPercentage;
  if (utilization >= 90) return 'critical';
  if (utilization >= 75) return 'high';
  if (utilization >= 50) return 'moderate';
  return 'low';
});

// Method to check if budget is available for allocation
BudgetCodeSchema.methods.canAllocate = function(amount) {
  return this.active && (this.used + amount <= this.budget);
};

// Method to allocate budget to a requisition
BudgetCodeSchema.methods.allocateBudget = function(requisitionId, amount) {
  if (!this.canAllocate(amount)) {
    throw new Error('Insufficient budget available for allocation');
  }
  
  this.allocations.push({
    requisitionId,
    allocatedAmount: amount,
    allocationDate: new Date(),
    status: 'allocated'
  });
  
  this.used += amount;
  return this.save();
};

// Method to record actual spending
BudgetCodeSchema.methods.recordSpending = function(requisitionId, actualAmount) {
  const allocation = this.allocations.find(
    alloc => alloc.requisitionId.equals(requisitionId) && alloc.status === 'allocated'
  );
  
  if (!allocation) {
    throw new Error('No allocation found for this requisition');
  }
  
  // Update the allocation
  allocation.actualSpent = actualAmount;
  allocation.status = 'spent';
  
  // Adjust used amount (could be more or less than allocated)
  const difference = actualAmount - allocation.allocatedAmount;
  this.used += difference;
  
  return this.save();
};

// Method to return unused budget
BudgetCodeSchema.methods.returnBudget = function(requisitionId, returnAmount) {
  const allocation = this.allocations.find(
    alloc => alloc.requisitionId.equals(requisitionId)
  );
  
  if (!allocation) {
    throw new Error('No allocation found for this requisition');
  }
  
  allocation.status = 'returned';
  this.used -= returnAmount;
  
  return this.save();
};

// Method to update budget amount
BudgetCodeSchema.methods.updateBudget = function(newBudget, reason, changedBy) {
  this.budgetHistory.push({
    previousBudget: this.budget,
    newBudget: newBudget,
    reason: reason,
    changedBy: changedBy,
    changeDate: new Date()
  });
  
  this.budget = newBudget;
  return this.save();
};

// Static method to get available budget codes for a department
BudgetCodeSchema.statics.getAvailableForDepartment = function(department) {
  return this.find({
    $or: [
      { department: department },
      { department: 'General' }
    ],
    active: true
  }).sort({ utilizationRate: 1 }); // Sort by lowest utilization first
};

// Static method to get budget codes with low utilization
BudgetCodeSchema.statics.getLowUtilization = function(threshold = 50) {
  return this.aggregate([
    {
      $addFields: {
        utilizationRate: {
          $cond: {
            if: { $eq: ["$budget", 0] },
            then: 0,
            else: { $multiply: [{ $divide: ["$used", "$budget"] }, 100] }
          }
        }
      }
    },
    {
      $match: {
        active: true,
        utilizationRate: { $lt: threshold }
      }
    },
    {
      $sort: { utilizationRate: 1 }
    }
  ]);
};

// Static method to get budget codes requiring attention
BudgetCodeSchema.statics.getRequiringAttention = function() {
  return this.aggregate([
    {
      $addFields: {
        utilizationRate: {
          $cond: {
            if: { $eq: ["$budget", 0] },
            then: 0,
            else: { $multiply: [{ $divide: ["$used", "$budget"] }, 100] }
          }
        }
      }
    },
    {
      $match: {
        active: true,
        utilizationRate: { $gte: 75 }
      }
    },
    {
      $sort: { utilizationRate: -1 }
    }
  ]);
};

// Pre-save middleware to validate budget allocation
BudgetCodeSchema.pre('save', function(next) {
  if (this.used > this.budget) {
    return next(new Error('Used budget cannot exceed total budget'));
  }
  
  // Set end date for period-based budgets
  if (this.isNew && !this.endDate) {
    const now = new Date();
    switch (this.budgetPeriod) {
      case 'monthly':
        this.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarterly':
        this.endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
        break;
      case 'yearly':
        this.endDate = new Date(now.getFullYear() + 1, 0, 0);
        break;
      // Project budgets don't have automatic end dates
    }
  }
  
  next();
});

module.exports = mongoose.model('BudgetCode', BudgetCodeSchema);









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