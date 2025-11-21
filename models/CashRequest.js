const mongoose = require('mongoose');

const CashRequestSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestType: {
    type: String,
    enum: [
      'travel', 
      'office-supplies', 
      'client-entertainment', 
      'emergency', 
      'project-materials', 
      'training', 
      'expense',
      'accommodation',      
      'perdiem',           
      'utility',   
      'internet',          
      'staff-transportation', 
      'staff-entertainment',  
      'toll-gates',        
      'office-items',      
      'other'
    ],
    required: true
  },
  requestMode: {
    type: String,
    enum: ['advance', 'reimbursement'],
    default: 'advance',
    required: true
  },
  amountRequested: {
    type: Number,
    required: true,
    min: [0, 'Amount must be greater than 0'],
    validate: {
      validator: function(value) {
        if (this.requestMode === 'reimbursement') {
          return value <= 100000;
        }
        return value > 0 && value <= 999999999;
      },
      message: function(props) {
        if (props.instance.requestMode === 'reimbursement') {
          return `Reimbursement amount cannot exceed XAF 100,000. Requested: XAF ${props.value.toLocaleString()}`;
        }
        return `Amount must be between XAF 1 and XAF 999,999,999. Requested: XAF ${props.value.toLocaleString()}`;
      }
    }
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

  // ===== FIXED: Approval Chain Schema =====
  approvalChain: [{
    level: {
      type: Number,
      required: true
    },
    approver: {
      name: { 
        type: String, 
        required: [true, 'Approver name is required'],
        trim: true
      },
      email: { 
        type: String, 
        required: [true, 'Approver email is required'],
        trim: true,
        lowercase: true,
        validate: {
          validator: function(v) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
          },
          message: props => `${props.value} is not a valid email address!`
        }
      },
      role: { 
        type: String, 
        required: [true, 'Approver role is required'],
        trim: true
      },
      department: { 
        type: String, 
        required: [true, 'Approver department is required'],
        trim: true
      }
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    comments: {
      type: String,
      default: ''
    },
    actionDate: Date,
    actionTime: String,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedDate: {
      type: Date,
      default: null
    }
  }],

  justificationApprovalChain: [{
    level: {
      type: Number,
      required: true
    },
    approver: {
      name: { 
        type: String, 
        required: true,
        trim: true
      },
      email: { 
        type: String, 
        required: true,
        trim: true,
        lowercase: true
      },
      role: { 
        type: String, 
        required: true,
        trim: true
      },
      department: { 
        type: String, 
        required: true,
        trim: true
      }
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
      default: null
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
      'justification_pending_head_of_business',
      'justification_pending_finance',
      'justification_rejected_supervisor',
      'justification_rejected_departmental_head',
      'justification_rejected_head_of_business',
      'justification_rejected_finance',
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

  // // Justification workflow
  // justification: {
  //   amountSpent: {
  //     type: Number,
  //     min: 0
  //   },
  //   balanceReturned: {
  //     type: Number,
  //     min: 0
  //   },
  //   details: String,
  //   documents: [{
  //     name: String,
  //     url: String,
  //     publicId: String,
  //     size: Number,
  //     mimetype: String
  //   }],
  //   justificationDate: Date
  // },

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
      localPath: String, // ✅ Add this field
      size: Number,
      mimetype: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    justificationDate: Date,
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // ✅ Add itemized breakdown
    itemizedBreakdown: [{
      description: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      category: String
    }]
  },

  justificationApproval: {
    submittedDate: Date,
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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

  itemizedBreakdown: [{
    description: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    category: String 
  }],

  pdfDownloadHistory: [{
    downloadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    downloadedAt: {
      type: Date,
      default: Date.now
    },
    filename: String
  }],

  // Reimbursement-specific details
  reimbursementDetails: {
    amountSpent: {
      type: Number,
      min: 0
    },
    receiptDocuments: [{
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
    itemizedBreakdown: [{
      description: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      category: String,
      receiptReference: String
    }],
    submittedDate: {
      type: Date,
      default: Date.now
    },
    receiptVerified: {
      type: Boolean,
      default: false
    }
  },

  editHistory: [{
    editedAt: {
      type: Date,
      default: Date.now
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changes: {
      type: mongoose.Schema.Types.Mixed, // Stores what was changed
      default: {}
    },
    reason: {
      type: String, // Why was it edited
      default: ''
    },
    previousStatus: String, // Status before edit
    editNumber: Number // 1st edit, 2nd edit, etc.
  }],

  isEdited: {
    type: Boolean,
    default: false
  },

  totalEdits: {
    type: Number,
    default: 0
  },

  originalValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

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
  if (!currentStep) return false;
  
  const stepEmail = String(currentStep.approver.email || '').toLowerCase().trim();
  const checkEmail = String(userEmail || '').toLowerCase().trim();
  
  return stepEmail === checkEmail;
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

// Pre-save validation for reimbursement requests
CashRequestSchema.pre('save', function(next) {
  if (this.requestMode === 'reimbursement') {
    // Enforce 100,000 limit
    if (this.amountRequested > 100000) {
      return next(new Error('Reimbursement amount cannot exceed XAF 100,000'));
    }

    // Receipts are mandatory
    if (!this.reimbursementDetails?.receiptDocuments || 
        this.reimbursementDetails.receiptDocuments.length === 0) {
      return next(new Error('Receipt documents are mandatory for reimbursement requests'));
    }

    // Itemized breakdown required
    if (!this.reimbursementDetails?.itemizedBreakdown || 
        this.reimbursementDetails.itemizedBreakdown.length === 0) {
      return next(new Error('Itemized breakdown is required for reimbursement requests'));
    }
  }
  next();
});

// Static method: Check monthly reimbursement limit (5 per employee)
CashRequestSchema.statics.checkMonthlyReimbursementLimit = async function(employeeId) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await this.countDocuments({
    employee: employeeId,
    requestMode: 'reimbursement',
    createdAt: { $gte: startOfMonth },
    status: { $ne: 'denied' }
  });

  return {
    count,
    limit: 5,
    remaining: Math.max(0, 5 - count),
    canSubmit: count < 5
  };
};

// Pre-update middleware to update timestamps
CashRequestSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

module.exports = mongoose.model('CashRequest', CashRequestSchema);




