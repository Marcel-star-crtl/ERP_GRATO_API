const mongoose = require('mongoose');

const CashRequestSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestType: {
    type: String,
    enum: ['travel', 'office-supplies', 'client-entertainment', 'emergency', 'project-materials', 'training', 'other'],
    required: true
  },
  amountRequested: {
    type: Number,
    required: true,
    min: 0
  },
  amountApproved: {
    type: Number,
    min: 0
  },
  purpose: {
    type: String,
    required: true,
    minlength: 10
  },
  businessJustification: {
    type: String,
    required: true,
    minlength: 20
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    required: true
  },
  requiredDate: {
    type: Date,
    required: true
  },
  projectCode: String,

  // PROJECT AND BUDGET INTEGRATION
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },

  budgetAllocation: {
    budgetCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BudgetCode'
    },
    budgetCode: {
      type: String
    },
    allocatedAmount: {
      type: Number,
      min: 0
    },
    actualSpent: {
      type: Number,
      min: 0,
      default: 0
    },
    balanceReturned: {
      type: Number,
      min: 0,
      default: 0
    },
    allocationStatus: {
      type: String,
      enum: ['pending', 'allocated', 'spent', 'refunded'],
      default: 'pending'
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date
    }
  },

  // Approval Chain
  approvalChain: [{
    level: {
      type: Number,
      required: true
    },
    approver: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      role: { type: String, required: true },
      department: { type: String, required: true }
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    comments: String,
    actionDate: Date,
    actionTime: String,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedDate: {
      type: Date,
      default: Date.now
    }
  }],

  status: {
    type: String,
    enum: [
      'pending_supervisor',           
      'pending_departmental_head',     
      'pending_head_of_business',     
      'pending_finance',              
      'approved',                     
      'denied',                       
      'disbursed',                    
      'justification_pending_supervisor',     
      'justification_pending_departmental_head', 
      'justification_pending_finance',        
      'justification_rejected',               
      'completed'                            
    ],
    default: 'pending_supervisor'
  },

  // Legacy fields maintained for backward compatibility
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  supervisorDecision: {
    decision: String,
    comments: String,
    decisionDate: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  financeDecision: {
    decision: String,
    comments: String,
    decisionDate: Date
  },
  financeOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  disbursementDetails: {
    date: Date,
    amount: Number,
    disbursedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Justification workflow
  justification: {
    amountSpent: {
      type: Number,
      min: 0
    },
    balanceReturned: {
      type: Number,
      min: 0
    },
    details: String,
    documents: [{
      name: String,
      url: String,
      publicId: String,
      size: Number,
      mimetype: String
    }],
    justificationDate: Date
  },

  // Justification approval workflow
  justificationApproval: {
    supervisorDecision: {
      decision: {
        type: String,
        enum: ['approve', 'reject']
      },
      comments: String,
      decisionDate: Date,
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    financeDecision: {
      decision: {
        type: String,
        enum: ['approve', 'reject']
      },
      comments: String,
      decisionDate: Date,
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  },

  // Attachments for initial request
  attachments: [{
    name: String,
    url: String,
    publicId: String,
    size: Number,
    mimetype: String
  }],

  // Audit trail
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
CashRequestSchema.index({ employee: 1, status: 1 });
CashRequestSchema.index({ 'approvalChain.approver.email': 1, 'approvalChain.status': 1 });
CashRequestSchema.index({ status: 1, createdAt: -1 });
CashRequestSchema.index({ 'justification.justificationDate': -1 });
CashRequestSchema.index({ 'approvalChain.level': 1 });
CashRequestSchema.index({ projectId: 1 });
CashRequestSchema.index({ 'budgetAllocation.budgetCodeId': 1 });
CashRequestSchema.index({ 'budgetAllocation.allocationStatus': 1 });

// Virtual for request ID display
CashRequestSchema.virtual('displayId').get(function() {
  return `REQ-${this._id.toString().slice(-6).toUpperCase()}`;
});

// Virtual for budget utilization
CashRequestSchema.virtual('budgetUtilization').get(function() {
  if (!this.budgetAllocation || !this.budgetAllocation.allocatedAmount) return null;
  
  const spent = this.budgetAllocation.actualSpent || 0;
  const allocated = this.budgetAllocation.allocatedAmount;
  
  return {
    allocated: allocated,
    spent: spent,
    returned: this.budgetAllocation.balanceReturned || 0,
    utilizationPercentage: allocated > 0 ? ((spent / allocated) * 100).toFixed(2) : 0
  };
});

// Method to get current approval step
CashRequestSchema.methods.getCurrentApprovalStep = function() {
  if (!this.approvalChain || this.approvalChain.length === 0) return null;
  return this.approvalChain.find(step => step.status === 'pending');
};

// Method to get next approver
CashRequestSchema.methods.getNextApprover = function() {
  const currentStep = this.getCurrentApprovalStep();
  return currentStep ? currentStep.approver : null;
};

// Method to check if user can approve request
CashRequestSchema.methods.canUserApprove = function(userEmail) {
  const currentStep = this.getCurrentApprovalStep();
  return currentStep && currentStep.approver.email === userEmail;
};

// Method to get approval progress percentage
CashRequestSchema.methods.getApprovalProgress = function() {
  if (!this.approvalChain || this.approvalChain.length === 0) return 0;
  const approvedSteps = this.approvalChain.filter(step => step.status === 'approved').length;
  return Math.round((approvedSteps / this.approvalChain.length) * 100);
};

// Method to check if request can be justified
CashRequestSchema.methods.canSubmitJustification = function() {
  return this.status === 'disbursed';
};

// Method to check if justification can be approved by supervisor
CashRequestSchema.methods.canSupervisorApproveJustification = function() {
  return this.status === 'justification_pending_supervisor';
};

// Method to check if justification can be approved by finance
CashRequestSchema.methods.canFinanceApproveJustification = function() {
  return this.status === 'justification_pending_finance';
};

// Method to get current stage description
CashRequestSchema.methods.getCurrentStage = function() {
  const stageMap = {
    'pending_supervisor': 'Pending Supervisor Approval',
    'pending_departmental_head': 'Pending Departmental Head Approval',
    'pending_head_of_business': 'Pending Head of Business Approval', 
    'pending_finance': 'Pending Finance Approval',
    'approved': 'Approved - Awaiting Disbursement',
    'denied': 'Denied',
    'disbursed': 'Disbursed - Awaiting Justification',
    'justification_pending_supervisor': 'Justification - Pending Supervisor Approval',
    'justification_pending_departmental_head': 'Justification - Pending Departmental Head Approval',
    'justification_pending_finance': 'Justification - Pending Finance Approval',
    'justification_rejected': 'Justification Rejected',
    'completed': 'Completed'
  };
  return stageMap[this.status] || 'Unknown Status';
};

// Method to get budget allocation info
CashRequestSchema.methods.getBudgetInfo = function() {
  if (!this.budgetAllocation) return null;
  
  return {
    budgetCode: this.budgetAllocation.budgetCode,
    allocated: this.budgetAllocation.allocatedAmount,
    spent: this.budgetAllocation.actualSpent || 0,
    returned: this.budgetAllocation.balanceReturned || 0,
    status: this.budgetAllocation.allocationStatus,
    assignedBy: this.budgetAllocation.assignedBy,
    assignedAt: this.budgetAllocation.assignedAt
  };
};

// Pre-save middleware to update timestamps
CashRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-populate supervisor field from first approval chain entry for backward compatibility
  if (this.approvalChain && this.approvalChain.length > 0 && !this.supervisor) {
    const firstApprover = this.approvalChain[0];
    // You might want to populate this with actual User ObjectId if needed
  }
  
  next();
});

// Pre-update middleware to update timestamps
CashRequestSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

module.exports = mongoose.model('CashRequest', CashRequestSchema);











// const mongoose = require('mongoose');

// const CashRequestSchema = new mongoose.Schema({
//   employee: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   requestType: {
//     type: String,
//     enum: ['travel', 'office-supplies', 'client-entertainment', 'emergency', 'project-materials', 'training', 'other'],
//     required: true
//   },
//   amountRequested: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   amountApproved: {
//     type: Number,
//     min: 0
//   },
//   purpose: {
//     type: String,
//     required: true,
//     minlength: 10
//   },
//   businessJustification: {
//     type: String,
//     required: true,
//     minlength: 20
//   },
//   urgency: {
//     type: String,
//     enum: ['low', 'medium', 'high', 'urgent'],
//     required: true
//   },
//   requiredDate: {
//     type: Date,
//     required: true
//   },
//   projectCode: String,
  
//   // NEW: Project and Budget Integration
//   projectId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Project',
//     default: null
//   },
//   budgetCodeId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'BudgetCode',
//     default: null
//   },
//   budgetAssignedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     default: null
//   },
//   budgetAssignedDate: {
//     type: Date,
//     default: null
//   },
  
//   // Approval Chain (similar to invoices)
//   approvalChain: [{
//     level: {
//       type: Number,
//       required: true
//     },
//     approver: {
//       name: { type: String, required: true },
//       email: { type: String, required: true },
//       role: { type: String, required: true },
//       department: { type: String, required: true }
//     },
//     status: {
//       type: String,
//       enum: ['pending', 'approved', 'rejected'],
//       default: 'pending'
//     },
//     comments: String,
//     actionDate: Date,
//     actionTime: String,
//     decidedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     assignedDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],

//   status: {
//     type: String,
//     enum: [
//       'pending_supervisor',           
//       'pending_departmental_head',     
//       'pending_head_of_business',     
//       'pending_finance',              
//       'approved',                     
//       'denied',                       
//       'disbursed',                    
//       'justification_pending_supervisor',     
//       'justification_pending_departmental_head', 
//       'justification_pending_finance',        
//       'justification_rejected',               
//       'completed'                            
//     ],
//     default: 'pending_supervisor'
//   },

//   // Legacy fields maintained for backward compatibility
//   supervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   supervisorDecision: {
//     decision: String,
//     comments: String,
//     decisionDate: Date,
//     decidedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   },
//   financeDecision: {
//     decision: String,
//     comments: String,
//     decisionDate: Date
//   },
//   financeOfficer: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },

//   disbursementDetails: {
//     date: Date,
//     amount: Number,
//     disbursedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   },

//   // Justification workflow
//   justification: {
//     amountSpent: {
//       type: Number,
//       min: 0
//     },
//     balanceReturned: {
//       type: Number,
//       min: 0
//     },
//     details: String,
//     documents: [{
//       name: String,
//       url: String,
//       publicId: String,
//       size: Number,
//       mimetype: String
//     }],
//     justificationDate: Date
//   },

//   // Justification approval workflow
//   justificationApproval: {
//     supervisorDecision: {
//       decision: {
//         type: String,
//         enum: ['approve', 'reject']
//       },
//       comments: String,
//       decisionDate: Date,
//       decidedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       }
//     },
//     financeDecision: {
//       decision: {
//         type: String,
//         enum: ['approve', 'reject']
//       },
//       comments: String,
//       decisionDate: Date,
//       decidedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       }
//     }
//   },

//   // Attachments for initial request
//   attachments: [{
//     name: String,
//     url: String,
//     publicId: String,
//     size: Number,
//     mimetype: String
//   }],

//   // Audit trail
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// }, { 
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes for better query performance
// CashRequestSchema.index({ employee: 1, status: 1 });
// CashRequestSchema.index({ 'approvalChain.approver.email': 1, 'approvalChain.status': 1 });
// CashRequestSchema.index({ status: 1, createdAt: -1 });
// CashRequestSchema.index({ 'justification.justificationDate': -1 });
// CashRequestSchema.index({ 'approvalChain.level': 1 });
// CashRequestSchema.index({ projectId: 1 });
// CashRequestSchema.index({ budgetCodeId: 1 });

// // Virtual for request ID display
// CashRequestSchema.virtual('displayId').get(function() {
//   return `REQ-${this._id.toString().slice(-6).toUpperCase()}`;
// });

// // Virtual to check if budget needs assignment
// CashRequestSchema.virtual('needsBudgetAssignment').get(function() {
//   return !this.budgetCodeId && !this.projectId;
// });

// // Method to get current approval step
// CashRequestSchema.methods.getCurrentApprovalStep = function() {
//   if (!this.approvalChain || this.approvalChain.length === 0) return null;
  
//   return this.approvalChain.find(step => step.status === 'pending');
// };

// // Method to get next approver
// CashRequestSchema.methods.getNextApprover = function() {
//   const currentStep = this.getCurrentApprovalStep();
//   return currentStep ? currentStep.approver : null;
// };

// // Method to check if user can approve request
// CashRequestSchema.methods.canUserApprove = function(userEmail) {
//   const currentStep = this.getCurrentApprovalStep();
//   return currentStep && currentStep.approver.email === userEmail;
// };

// // Method to get approval progress percentage
// CashRequestSchema.methods.getApprovalProgress = function() {
//   if (!this.approvalChain || this.approvalChain.length === 0) return 0;
  
//   const approvedSteps = this.approvalChain.filter(step => step.status === 'approved').length;
//   return Math.round((approvedSteps / this.approvalChain.length) * 100);
// };

// // Method to check if request can be justified
// CashRequestSchema.methods.canSubmitJustification = function() {
//   return this.status === 'disbursed';
// };

// // Method to check if justification can be approved by supervisor
// CashRequestSchema.methods.canSupervisorApproveJustification = function() {
//   return this.status === 'justification_pending_supervisor';
// };

// // Method to check if justification can be approved by finance
// CashRequestSchema.methods.canFinanceApproveJustification = function() {
//   return this.status === 'justification_pending_finance';
// };

// // Method to get current stage description
// CashRequestSchema.methods.getCurrentStage = function() {
//   const stageMap = {
//     'pending_supervisor': 'Pending Supervisor Approval',
//     'pending_departmental_head': 'Pending Departmental Head Approval',
//     'pending_head_of_business': 'Pending Head of Business Approval', 
//     'pending_finance': 'Pending Finance Approval',
//     'approved': 'Approved - Awaiting Disbursement',
//     'denied': 'Denied',
//     'disbursed': 'Disbursed - Awaiting Justification',
//     'justification_pending_supervisor': 'Justification - Pending Supervisor Approval',
//     'justification_pending_departmental_head': 'Justification - Pending Departmental Head Approval',
//     'justification_pending_finance': 'Justification - Pending Finance Approval',
//     'justification_rejected': 'Justification Rejected',
//     'completed': 'Completed'
//   };
  
//   return stageMap[this.status] || 'Unknown Status';
// };

// // Method to get budget info summary
// CashRequestSchema.methods.getBudgetSummary = function() {
//   return {
//     hasProject: !!this.projectId,
//     hasBudgetCode: !!this.budgetCodeId,
//     needsAssignment: this.needsBudgetAssignment,
//     assignedBy: this.budgetAssignedBy,
//     assignedDate: this.budgetAssignedDate
//   };
// };

// // Pre-save middleware to update timestamps
// CashRequestSchema.pre('save', function(next) {
//   this.updatedAt = new Date();
  
//   // Track budget assignment
//   if (this.isModified('budgetCodeId') && this.budgetCodeId && !this.budgetAssignedDate) {
//     this.budgetAssignedDate = new Date();
//   }
  
//   next();
// });

// // Pre-update middleware
// CashRequestSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
//   this.set({ updatedAt: new Date() });
//   next();
// });

// // Static method to get requests needing budget assignment
// CashRequestSchema.statics.getNeedingBudgetAssignment = function() {
//   return this.find({
//     status: 'pending_finance',
//     budgetCodeId: null,
//     projectId: null
//   })
//   .populate('employee', 'fullName email department')
//   .sort({ createdAt: -1 });
// };

// module.exports = mongoose.model('CashRequest', CashRequestSchema)











// const mongoose = require('mongoose');

// const CashRequestSchema = new mongoose.Schema({
//   employee: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   requestType: {
//     type: String,
//     enum: ['travel', 'office-supplies', 'client-entertainment', 'emergency', 'project-materials', 'training', 'other'],
//     required: true
//   },
//   amountRequested: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   amountApproved: {
//     type: Number,
//     min: 0
//   },
//   purpose: {
//     type: String,
//     required: true,
//     minlength: 10
//   },
//   businessJustification: {
//     type: String,
//     required: true,
//     minlength: 20
//   },
//   urgency: {
//     type: String,
//     enum: ['low', 'medium', 'high', 'urgent'],
//     required: true
//   },
//   requiredDate: {
//     type: Date,
//     required: true
//   },
//   projectCode: String,
  
//   // New: Approval Chain (similar to invoices)
//   approvalChain: [{
//     level: {
//       type: Number,
//       required: true
//     },
//     approver: {
//       name: { type: String, required: true },
//       email: { type: String, required: true },
//       role: { type: String, required: true },
//       department: { type: String, required: true }
//     },
//     status: {
//       type: String,
//       enum: ['pending', 'approved', 'rejected'],
//       default: 'pending'
//     },
//     comments: String,
//     actionDate: Date,
//     actionTime: String,
//     decidedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     assignedDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],

//   status: {
//     type: String,
//     enum: [
//       'pending_supervisor',           
//       'pending_departmental_head',     
//       'pending_head_of_business',     
//       'pending_finance',              
//       'approved',                     
//       'denied',                       
//       'disbursed',                    
//       'justification_pending_supervisor',     
//       'justification_pending_departmental_head', 
//       'justification_pending_finance',        
//       'justification_rejected',               
//       'completed'                            
//     ],
//     default: 'pending_supervisor'
//   },

//   // Legacy fields maintained for backward compatibility
//   supervisor: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   supervisorDecision: {
//     decision: String,
//     comments: String,
//     decisionDate: Date,
//     decidedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   },
//   financeDecision: {
//     decision: String,
//     comments: String,
//     decisionDate: Date
//   },
//   financeOfficer: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },

//   disbursementDetails: {
//     date: Date,
//     amount: Number,
//     disbursedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   },

//   // Justification workflow
//   justification: {
//     amountSpent: {
//       type: Number,
//       min: 0
//     },
//     balanceReturned: {
//       type: Number,
//       min: 0
//     },
//     details: String,
//     documents: [{
//       name: String,
//       url: String,
//       publicId: String,
//       size: Number,
//       mimetype: String
//     }],
//     justificationDate: Date
//   },

//   // Justification approval workflow
//   justificationApproval: {
//     supervisorDecision: {
//       decision: {
//         type: String,
//         enum: ['approve', 'reject']
//       },
//       comments: String,
//       decisionDate: Date,
//       decidedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       }
//     },
//     financeDecision: {
//       decision: {
//         type: String,
//         enum: ['approve', 'reject']
//       },
//       comments: String,
//       decisionDate: Date,
//       decidedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       }
//     }
//   },

//   // Attachments for initial request
//   attachments: [{
//     name: String,
//     url: String,
//     publicId: String,
//     size: Number,
//     mimetype: String
//   }],

//   // Audit trail
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// }, { 
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes for better query performance
// CashRequestSchema.index({ employee: 1, status: 1 });
// CashRequestSchema.index({ 'approvalChain.approver.email': 1, 'approvalChain.status': 1 });
// CashRequestSchema.index({ status: 1, createdAt: -1 });
// CashRequestSchema.index({ 'justification.justificationDate': -1 });
// CashRequestSchema.index({ 'approvalChain.level': 1 });

// // Virtual for request ID display
// CashRequestSchema.virtual('displayId').get(function() {
//   return `REQ-${this._id.toString().slice(-6).toUpperCase()}`;
// });

// // Method to get current approval step
// CashRequestSchema.methods.getCurrentApprovalStep = function() {
//   if (!this.approvalChain || this.approvalChain.length === 0) return null;
  
//   return this.approvalChain.find(step => step.status === 'pending');
// };

// // Method to get next approver
// CashRequestSchema.methods.getNextApprover = function() {
//   const currentStep = this.getCurrentApprovalStep();
//   return currentStep ? currentStep.approver : null;
// };

// // Method to check if user can approve request
// CashRequestSchema.methods.canUserApprove = function(userEmail) {
//   const currentStep = this.getCurrentApprovalStep();
//   return currentStep && currentStep.approver.email === userEmail;
// };

// // Method to get approval progress percentage
// CashRequestSchema.methods.getApprovalProgress = function() {
//   if (!this.approvalChain || this.approvalChain.length === 0) return 0;
  
//   const approvedSteps = this.approvalChain.filter(step => step.status === 'approved').length;
//   return Math.round((approvedSteps / this.approvalChain.length) * 100);
// };

// // Method to check if request can be justified
// CashRequestSchema.methods.canSubmitJustification = function() {
//   return this.status === 'disbursed';
// };

// // Method to check if justification can be approved by supervisor
// CashRequestSchema.methods.canSupervisorApproveJustification = function() {
//   return this.status === 'justification_pending_supervisor';
// };

// // Method to check if justification can be approved by finance
// CashRequestSchema.methods.canFinanceApproveJustification = function() {
//   return this.status === 'justification_pending_finance';
// };

// // Method to get current stage description
// CashRequestSchema.methods.getCurrentStage = function() {
//   const stageMap = {
//     'pending_supervisor': 'Pending Supervisor Approval',
//     'pending_departmental_head': 'Pending Departmental Head Approval',
//     'pending_head_of_business': 'Pending Head of Business Approval', 
//     'pending_finance': 'Pending Finance Approval',
//     'approved': 'Approved - Awaiting Disbursement',
//     'denied': 'Denied',
//     'disbursed': 'Disbursed - Awaiting Justification',
//     'justification_pending_supervisor': 'Justification - Pending Supervisor Approval',
//     'justification_pending_departmental_head': 'Justification - Pending Departmental Head Approval',
//     'justification_pending_finance': 'Justification - Pending Finance Approval',
//     'justification_rejected': 'Justification Rejected',
//     'completed': 'Completed'
//   };
  
//   return stageMap[this.status] || 'Unknown Status';
// };

// // Method to get current stage with approver details
// CashRequestSchema.methods.getCurrentStageDetails = function() {
//   const currentStep = this.getCurrentApprovalStep();
  
//   if (currentStep) {
//     return {
//       stage: this.getCurrentStage(),
//       level: currentStep.level,
//       approver: currentStep.approver,
//       waitingTime: this.getWaitingTime(currentStep.assignedDate)
//     };
//   }
  
//   return {
//     stage: this.getCurrentStage(),
//     level: null,
//     approver: null,
//     waitingTime: null
//   };
// };

// // Helper method to calculate waiting time
// CashRequestSchema.methods.getWaitingTime = function(assignedDate) {
//   if (!assignedDate) return null;
  
//   const now = new Date();
//   const assigned = new Date(assignedDate);
//   const diffTime = Math.abs(now - assigned);
//   const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
//   return {
//     days: diffDays,
//     text: `${diffDays} day${diffDays !== 1 ? 's' : ''}`
//   };
// };

// // Pre-save middleware to update timestamps
// CashRequestSchema.pre('save', function(next) {
//   this.updatedAt = new Date();
  
//   // Auto-populate supervisor field from first approval chain entry for backward compatibility
//   if (this.approvalChain && this.approvalChain.length > 0 && !this.supervisor) {
//     const firstApprover = this.approvalChain[0];
//     // You might want to populate this with actual User ObjectId if needed
//   }
  
//   next();
// });

// // Pre-update middleware to update timestamps
// CashRequestSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
//   this.set({ updatedAt: new Date() });
//   next();
// });

// module.exports = mongoose.model('CashRequest', CashRequestSchema);


