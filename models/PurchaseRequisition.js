// models/PurchaseRequisition.js
const mongoose = require('mongoose');

const PurchaseRequisitionSchema = new mongoose.Schema({
  requisitionNumber: {
    type: String,
    required: true,
    unique: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  itemCategory: {
    type: String,
    enum: ['IT', 'Office Supplies', 'Hardware', 'all', 'Other'],
    default: 'all'
  },
  budgetXAF: {
    type: Number,
    min: 0
  },
  
  // ✅ NEW: Budget code selected by employee at submission
  budgetCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BudgetCode',
    required: true,
    index: true
  },
  
  // ✅ NEW: Snapshot of budget code info at submission time
  budgetCodeInfo: {
    code: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    department: String,
    budgetType: String,
    availableAtSubmission: {
      type: Number,
      required: true,
      min: 0
    },
    submittedAmount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  
  budgetHolder: String,
  urgency: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  deliveryLocation: {
    type: String,
    required: true
  },
  expectedDate: {
    type: Date,
    required: true
  },
  justificationOfPurchase: {
    type: String,
    required: true,
    minlength: 20
  },
  justificationOfPreferredSupplier: String,

  // Project reference (optional)
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },

  // Supplier information
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  preferredSupplier: {
    type: String
  },

  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    code: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    subcategory: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    measuringUnit: {
      type: String,
      required: true
    },
    estimatedPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    projectName: String
  }],

  attachments: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    localPath: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  status: {
    type: String,
    enum: [
      'draft',
      'pending_supervisor',
      'pending_finance_verification',
      'pending_supply_chain_review',
      'pending_buyer_assignment',
      'pending_head_approval',
      'approved',
      'partially_disbursed',  
      'fully_disbursed',
      'rejected',
      'supply_chain_approved',
      'supply_chain_rejected',
      'in_procurement',
      'procurement_complete',
      'delivered',
      'justification_pending_supervisor',
      'justification_pending_finance',
      'justification_rejected',
      'completed'
    ],
    default: 'pending_supervisor'
  },

  approvalChain: [{
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

  // ✅ UPDATED: Finance verification (verification only, no code assignment)
  financeVerification: {
    budgetAvailable: Boolean,
    verifiedBudget: Number,
    budgetCodeVerified: String, // For reference in emails/logs
    budgetCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BudgetCode'
    },
    availableBudgetAtVerification: Number,
    comments: String,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationDate: Date,
    decision: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    // ✅ REMOVED: No longer needed in finance verification
    // assignedBudget, budgetCode, budgetAllocation, costCenter, 
    // expectedCompletionDate, requiresAdditionalApproval
  },

  // Supply chain review
  supplyChainReview: {
    decision: {
      type: String,
      enum: ['pending', 'approve', 'reject'],
      default: 'pending'
    },
    sourcingType: {
      type: String,
      enum: ['direct_purchase', 'quotation_required', 'tender_process', 'framework_agreement']
    },
    purchaseTypeAssigned: {
      type: String,
      enum: ['opex', 'capex', 'standard', 'emergency']
    },
    assignedBuyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    buyerAssignmentDate: Date,
    buyerAssignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Budget assignment tracking (for supply chain budget assignment if needed)
    estimatedCost: Number,
    budgetAssignedBySupplyChain: {
      type: Boolean,
      default: false
    },
    assignedBudget: {
      type: Number,
      min: 0
    },
    previousBudget: {
      type: Number,
      min: 0
    },
    budgetAssignmentReason: String,
    budgetAssignedAt: Date,
    
    comments: String,
    decisionDate: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Head approval
  headApproval: {
    decision: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    comments: String,
    decisionDate: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    businessDecisions: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },

  // Payment method
  paymentMethod: {
    type: String,
    enum: ['bank', 'cash'],
    default: 'cash'
  },

  // Purchase type
  purchaseType: {
    type: String,
    enum: ['opex', 'capex', 'standard', 'emergency'],
    default: 'standard'
  },

  // Petty cash form (if payment method is cash)
  pettyCashForm: {
    generated: {
      type: Boolean,
      default: false
    },
    formNumber: String,
    generatedDate: Date,
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending_disbursement', 'disbursed', 'receipts_submitted', 'completed'],
      default: 'pending_disbursement'
    },
    changeReturned: {
      type: Number,
      default: 0
    },
    receipts: [{
      name: String,
      url: String,
      publicId: String,
      localPath: String,
      uploadedAt: Date,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    downloadHistory: [{
      downloadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      downloadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Procurement details
  procurementDetails: {
    procurementDate: Date,
    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    vendors: [{
      name: String,
      quotationReceived: Boolean,
      amount: Number
    }],
    selectedVendor: String,
    finalCost: Number,
    deliveryDate: Date,
    deliveryStatus: {
      type: String,
      enum: ['pending', 'in_transit', 'delivered', 'delayed'],
      default: 'pending'
    }
  },

  // ✅ Disbursement tracking
  disbursements: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    disbursedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: String,
    disbursementNumber: {
      type: Number,
      required: true
    }
  }],
  
  totalDisbursed: {
    type: Number,
    default: 0,
    min: 0
  },
  
  remainingBalance: {
    type: Number,
    min: 0
  },

  justification: {
    actualExpenses: [{
      description: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      category: {
        type: String,
        required: true
      },
      date: {
        type: Date,
        default: Date.now
      }
    }],
    totalSpent: {
      type: Number,
      min: 0
    },
    changeReturned: {
      type: Number,
      default: 0,
      min: 0
    },
    justificationSummary: String,
    receipts: [{
      name: String,
      publicId: String,
      url: String,
      localPath: String,
      size: Number,
      mimetype: String,
      uploadedAt: Date,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    submittedDate: Date,
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending_supervisor', 'pending_finance', 'approved', 'rejected'],
      default: 'pending_supervisor'
    },
    supervisorReview: {
      decision: {
        type: String,
        enum: ['approved', 'rejected']
      },
      comments: String,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reviewedDate: Date
    },
    financeReview: {
      decision: {
        type: String,
        enum: ['approved', 'rejected']
      },
      comments: String,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reviewedDate: Date
    }
  },

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

// Indexes
PurchaseRequisitionSchema.index({ employee: 1, status: 1 });
PurchaseRequisitionSchema.index({ requisitionNumber: 1 });
PurchaseRequisitionSchema.index({ 'approvalChain.approver.email': 1 });
PurchaseRequisitionSchema.index({ status: 1, createdAt: -1 });
PurchaseRequisitionSchema.index({ 'supplyChainReview.assignedBuyer': 1 });
PurchaseRequisitionSchema.index({ project: 1 });
PurchaseRequisitionSchema.index({ supplierId: 1 });
PurchaseRequisitionSchema.index({ budgetCode: 1 }); // ✅ NEW: Budget code index
PurchaseRequisitionSchema.index({ 'budgetCodeInfo.code': 1 }); // ✅ NEW: Budget code info index
PurchaseRequisitionSchema.index({ 'financeVerification.decision': 1 }); // ✅ NEW: Finance decision index

// ✅ NEW: Virtual to check if finance has verified
PurchaseRequisitionSchema.virtual('isFinanceVerified').get(function() {
  return this.financeVerification?.decision === 'approved';
});

// ✅ NEW: Virtual to get budget code status at submission
PurchaseRequisitionSchema.virtual('budgetStatusAtSubmission').get(function() {
  if (!this.budgetCodeInfo) return null;
  
  const utilizationRate = this.budgetCodeInfo.availableAtSubmission > 0
    ? Math.round((this.budgetCodeInfo.submittedAmount / this.budgetCodeInfo.availableAtSubmission) * 100)
    : 0;
  
  return {
    code: this.budgetCodeInfo.code,
    name: this.budgetCodeInfo.name,
    available: this.budgetCodeInfo.availableAtSubmission,
    requested: this.budgetCodeInfo.submittedAmount,
    remainingAfter: this.budgetCodeInfo.availableAtSubmission - this.budgetCodeInfo.submittedAmount,
    utilizationRate: utilizationRate
  };
});

// ✅ Virtual to check if budget was assigned by Supply Chain
PurchaseRequisitionSchema.virtual('hasBudgetAssignment').get(function() {
  return this.supplyChainReview?.budgetAssignedBySupplyChain || false;
});

// ✅ Virtual to get budget assignment details
PurchaseRequisitionSchema.virtual('budgetAssignmentInfo').get(function() {
  if (!this.supplyChainReview?.budgetAssignedBySupplyChain) {
    return {
      assigned: false,
      source: 'employee'
    };
  }

  return {
    assigned: true,
    source: 'supply_chain',
    assignedBudget: this.supplyChainReview.assignedBudget,
    previousBudget: this.supplyChainReview.previousBudget,
    assignedAt: this.supplyChainReview.budgetAssignedAt,
    reason: this.supplyChainReview.budgetAssignmentReason
  };
});

// ✅ Method to get final budget (assigned or original)
PurchaseRequisitionSchema.methods.getFinalBudget = function() {
  if (this.supplyChainReview?.budgetAssignedBySupplyChain && this.supplyChainReview.assignedBudget) {
    return this.supplyChainReview.assignedBudget;
  }
  return this.budgetXAF || 0;
};

// ✅ NEW: Method to validate budget is still available
PurchaseRequisitionSchema.methods.validateBudgetAvailability = async function() {
  const BudgetCode = require('./BudgetCode');
  const budgetCode = await BudgetCode.findById(this.budgetCode);
  
  if (!budgetCode) {
    return {
      valid: false,
      message: 'Budget code no longer exists'
    };
  }
  
  if (!budgetCode.active || budgetCode.status !== 'active') {
    return {
      valid: false,
      message: 'Budget code is no longer active'
    };
  }
  
  const available = budgetCode.budget - budgetCode.used;
  const required = this.budgetXAF || 0;
  
  if (available < required) {
    return {
      valid: false,
      message: `Insufficient budget. Available: XAF ${available.toLocaleString()}, Required: XAF ${required.toLocaleString()}`,
      available,
      required
    };
  }
  
  return {
    valid: true,
    available,
    required,
    remainingAfter: available - required
  };
};

// ✅ Method to check if budget needs assignment
PurchaseRequisitionSchema.methods.needsBudgetAssignment = function() {
  return !this.budgetXAF || this.budgetXAF === 0;
};

// ✅ Pre-save middleware to sync budget
PurchaseRequisitionSchema.pre('save', function(next) {
  // If Supply Chain assigned a budget, update the main budgetXAF field
  if (this.supplyChainReview?.budgetAssignedBySupplyChain && 
      this.supplyChainReview.assignedBudget) {
    this.budgetXAF = this.supplyChainReview.assignedBudget;
  }
  
  this.updatedAt = new Date();
  next();
});

// Virtual for display ID
PurchaseRequisitionSchema.virtual('displayId').get(function() {
  return `REQ-${this.requisitionNumber}`;
});

// Method to generate petty cash form number
PurchaseRequisitionSchema.methods.generatePettyCashFormNumber = async function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Count how many petty cash forms generated this month
  const count = await this.constructor.countDocuments({
    'pettyCashForm.generated': true,
    'pettyCashForm.generatedDate': {
      $gte: new Date(year, date.getMonth(), 1),
      $lt: new Date(year, date.getMonth() + 1, 1)
    }
  });
  
  const formNumber = `PCF-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  
  this.pettyCashForm = {
    ...this.pettyCashForm,
    generated: true,
    formNumber: formNumber,
    generatedDate: new Date(),
    status: 'pending_disbursement'
  };
  
  return formNumber;
};

// Method to get current approver
PurchaseRequisitionSchema.methods.getCurrentApprover = function() {
  if (!this.approvalChain || this.approvalChain.length === 0) return null;
  return this.approvalChain.find(step => step.status === 'pending');
};

// Method to check if user can approve
PurchaseRequisitionSchema.methods.canUserApprove = function(userEmail) {
  const currentStep = this.getCurrentApprover();
  if (!currentStep) return false;
  
  return currentStep.approver.email.toLowerCase() === userEmail.toLowerCase();
};

module.exports = mongoose.model('PurchaseRequisition', PurchaseRequisitionSchema);

