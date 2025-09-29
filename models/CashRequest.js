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
  
  // New: Approval Chain (similar to invoices)
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
      'pending_finance', 
      'approved', 
      'denied', 
      'disbursed', 
      'justification_pending_supervisor',
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

// Virtual for request ID display
CashRequestSchema.virtual('displayId').get(function() {
  return `REQ-${this._id.toString().slice(-6).toUpperCase()}`;
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
    'pending_finance': 'Pending Finance Approval',
    'approved': 'Approved - Awaiting Disbursement',
    'denied': 'Denied',
    'disbursed': 'Disbursed - Awaiting Justification',
    'justification_pending_supervisor': 'Justification - Pending Supervisor Approval',
    'justification_pending_finance': 'Justification - Pending Finance Approval',
    'justification_rejected': 'Justification Rejected',
    'completed': 'Completed'
  };
  
  return stageMap[this.status] || 'Unknown Status';
};

// Method to get current stage with approver details
CashRequestSchema.methods.getCurrentStageDetails = function() {
  const currentStep = this.getCurrentApprovalStep();
  
  if (currentStep) {
    return {
      stage: this.getCurrentStage(),
      level: currentStep.level,
      approver: currentStep.approver,
      waitingTime: this.getWaitingTime(currentStep.assignedDate)
    };
  }
  
  return {
    stage: this.getCurrentStage(),
    level: null,
    approver: null,
    waitingTime: null
  };
};

// Helper method to calculate waiting time
CashRequestSchema.methods.getWaitingTime = function(assignedDate) {
  if (!assignedDate) return null;
  
  const now = new Date();
  const assigned = new Date(assignedDate);
  const diffTime = Math.abs(now - assigned);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    days: diffDays,
    text: `${diffDays} day${diffDays !== 1 ? 's' : ''}`
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


