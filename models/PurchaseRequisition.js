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

  // ✅ CRITICAL: Updated attachments schema (matches petty cash pattern)
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
    localPath: { // ✅ ADDED: Store local file path
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
      'rejected',
      'supply_chain_approved',
      'supply_chain_rejected',
      'in_procurement',
      'procurement_complete',
      'delivered'
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

  // Finance verification
  financeVerification: {
    budgetAvailable: Boolean,
    assignedBudget: Number,
    budgetCode: String,
    budgetAllocation: String,
    costCenter: String,
    comments: String,
    expectedCompletionDate: Date,
    requiresAdditionalApproval: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationDate: Date,
    decision: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
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
    
    // ✅ Budget assignment tracking
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
      localPath: String, // ✅ ADDED: Store local file path
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

// ✅ Virtual to check if budget was assigned by Supply Chain
PurchaseRequisitionSchema.virtual('hasBudgetAssignment').get(function() {
  return this.supplyChainReview?.budgetAssignedBySupplyChain || false;
});

// ✅ Virtual to get budget assignment details
PurchaseRequisitionSchema.virtual('budgetAssignmentInfo').get(function() {
  if (!this.supplyChainReview?.budgetAssignedBySupplyChain) {
    return {
      assigned: false,
      source: 'original'
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









// const mongoose = require('mongoose');

// const PurchaseRequisitionSchema = new mongoose.Schema({
//   employee: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   requisitionNumber: {
//     type: String,
//     unique: true,
//     required: true
//   },
//   title: {
//     type: String,
//     required: true,
//     minlength: 5
//   },
//   department: {
//     type: String,
//     required: true
//   },
//   itemCategory: {
//     type: String,
//     enum: [
//       'all',
//       'Trainings and Certifiations',
//       'IT Accessories',
//       'Office Supplies', 
//       'Equipment',
//       'Consumables',
//       'Software',
//       'Hardware',
//       'Furniture',
//       'Safety Equipment',
//       'Maintenance Supplies',
//       'Other'
//     ],
//     required: true
//   },
//   budgetXAF: {
//     type: Number,
//     min: 0
//   },
//   budgetHolder: {
//     type: String,
//   },
//   urgency: {
//     type: String,
//     enum: ['Low', 'Medium', 'High'],
//     required: true
//   },
//   deliveryLocation: {
//     type: String,
//     required: true
//   },
//   expectedDate: {
//     type: Date,
//     required: true
//   },
//   justificationOfPurchase: {
//     type: String,
//     required: true,
//     minlength: 20
//   },
//   justificationOfPreferredSupplier: String,

//   // // NEW: Purchase Type Field
//   // purchaseType: {
//   //   type: String,
//   //   enum: ['standard', 'non_standard', 'emergency', 'framework', 'capital'],
//   //   default: 'standard'
//   // },

//   purchaseType: {
//     type: String,
//     enum: ['opex', 'capex', 'standard', 'emergency'], // ✅ UPDATED enum values
//     default: 'standard'
//   },

//   // Items to be purchased
//   items: [{
//     // NEW: Add itemId reference to database items
//     itemId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Item',
//       required: true
//     },
//     // Keep existing fields for redundancy/performance
//     code: {
//       type: String,
//       required: true
//     },
//     description: {
//       type: String,
//       required: true
//     },
//     category: String,
//     subcategory: String,
//     quantity: {
//       type: Number,
//       required: true,
//       min: 1
//     },
//     measuringUnit: {
//       type: String,
//       required: true,
//       enum: ['Pieces', 'Sets', 'Boxes', 'Packs', 'Units', 'Kg', 'Litres', 'Meters', 'Pairs', 'Each']
//     },
//     estimatedPrice: {
//       type: Number,
//       min: 0
//     },
//     projectName: String
//   }],

//   // Enhanced Approval Chain
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
//       'draft',
//       'pending_supervisor',
//       'pending_finance_verification',
//       'pending_supply_chain_review',
//       'pending_buyer_assignment',
//       'pending_head_approval',
//       'approved',
//       'rejected',
//       'supply_chain_rejected', // NEW: Added for supply chain specific rejection
//       'in_procurement',
//       'procurement_complete',
//       'delivered'
//     ],
//     default: 'pending_supervisor'
//   },

//   // Finance Verification Details
//   financeVerification: {
//     budgetAvailable: {
//       type: Boolean,
//       default: null
//     },
//     assignedBudget: {
//       type: Number,
//       min: 0
//     },
//     budgetCode: {
//       type: String,
//       trim: true
//     },
//     comments: String,
//     verifiedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     verificationDate: Date,
//     decision: {
//       type: String,
//       enum: ['approved', 'rejected', 'pending'],
//       default: 'pending'
//     }
//   },

//   // // Reference to generated petty cash form
//   // pettyCashForm: {
//   //   formId: {
//   //     type: mongoose.Schema.Types.ObjectId,
//   //     ref: 'PettyCashForm'
//   //   },
//   //   generated: {
//   //     type: Boolean,
//   //     default: false
//   //   },
//   //   generatedDate: Date,
//   //   generatedBy: {
//   //     type: mongoose.Schema.Types.ObjectId,
//   //     ref: 'User'
//   //   }
//   // },


//   // In your PurchaseRequisition schema
//   pettyCashForm: {
//     generated: {
//       type: Boolean,
//       default: false
//     },
//     formNumber: String,
//     generatedDate: Date,
//     generatedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     status: {
//       type: String,
//       enum: ['pending_disbursement', 'disbursed', 'reconciled', 'cancelled'],
//       default: 'pending_disbursement'
//     },
//     amount: Number,
//     paymentMethod: String,
//     disbursementDate: Date,
//     disbursedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     receipts: [{
//       description: String,
//       amount: Number,
//       receiptNumber: String,
//       attachmentUrl: String
//     }],
//     changeReturned: {
//       type: Number,
//       default: 0
//     }
//   },

//   paymentMethod: {
//     type: String,
//     enum: ['bank', 'cash'],
//     default: 'cash',
//     required: function() {
//       // Only required after finance verification
//       return this.status !== 'draft' && 
//              this.status !== 'pending_supervisor' && 
//              this.status !== 'pending_finance_verification';
//     }
//   },

//   // Enhanced Supply Chain Review with Buyer Assignment
//   supplyChainReview: {
//     assignedOfficer: String,
//     estimatedCost: Number,

//     purchaseTypeAssigned: {
//       type: String,
//       enum: ['opex', 'capex', 'standard', 'emergency'], 
//       required: false
//     },

//     // Sourcing and Buyer Assignment
//     sourcingType: {
//       type: String,
//       enum: ['direct_purchase', 'quotation_required', 'tender_process', 'framework_agreement'],
//       default: 'direct_purchase'
//     },
//     assignedBuyer: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     buyerAssignmentDate: Date,
//     buyerAssignedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },

//     decision: {
//       type: String,
//       enum: ['approve', 'reject', 'pending'],
//       default: 'pending'
//     },
//     comments: String,
//     decisionDate: Date,
//     decidedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   },

//   // Final Head Approval (Head of Business Dev & Supply Chain) - ENHANCED
//   headApproval: {
//     decision: {
//       type: String,
//       enum: ['approved', 'rejected', 'pending'],
//       default: 'pending'
//     },
//     comments: String,
//     decisionDate: Date,
//     decidedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     // NEW: Business decisions made by head of business
//     businessDecisions: {
//       sourcingType: {
//         type: String,
//         enum: ['direct_purchase', 'competitive_bidding', 'framework_agreement', 'tender_process']
//       },
//       purchaseType: {
//         type: String,
//         enum: ['opex', 'capex', 'standard', 'emergency']
//       },
//       assignedBuyer: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       }
//     }
//   },

//   // Procurement Details (Enhanced)
//   procurementDetails: {
//     assignedOfficer: String,
//     vendors: [{
//       name: String,
//       contactInfo: String,
//       quotedPrice: Number
//     }],
//     selectedVendor: String,
//     finalCost: Number,
//     procurementDate: Date,
//     deliveryDate: Date,
//     deliveryStatus: {
//       type: String,
//       enum: ['pending', 'partial', 'complete'],
//       default: 'pending'
//     },
//     procurementMethod: {
//       type: String,
//       enum: ['direct_purchase', 'quotation', 'tender', 'framework']
//     }
//   },

//   // Attachments
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

// // Enhanced indexes
// PurchaseRequisitionSchema.index({ employee: 1, status: 1 });
// PurchaseRequisitionSchema.index({ 'approvalChain.approver.email': 1, 'approvalChain.status': 1 });
// PurchaseRequisitionSchema.index({ status: 1, createdAt: -1 });
// PurchaseRequisitionSchema.index({ 'financeVerification.verifiedBy': 1 });
// PurchaseRequisitionSchema.index({ 'supplyChainReview.assignedBuyer': 1 });
// PurchaseRequisitionSchema.index({ purchaseType: 1 }); // NEW: Index for purchase type

// // Virtual for display ID
// PurchaseRequisitionSchema.virtual('displayId').get(function() {
//   return this.requisitionNumber || `REQ-${this._id.toString().slice(-6).toUpperCase()}`;
// });

// // Method to get current approval step
// PurchaseRequisitionSchema.methods.getCurrentApprovalStep = function() {
//   if (!this.approvalChain || this.approvalChain.length === 0) return null;

//   return this.approvalChain.find(step => step.status === 'pending');
// };

// // Enhanced method to get current stage description
// PurchaseRequisitionSchema.methods.getCurrentStage = function() {
//   const stageMap = {
//     'draft': 'Draft - Not Submitted',
//     'pending_supervisor': 'Pending Supervisor Approval',
//     'pending_finance_verification': 'Pending Finance Budget Verification',
//     'pending_supply_chain_review': 'Pending Supply Chain Review',
//     'pending_buyer_assignment': 'Pending Buyer Assignment',
//     'pending_head_approval': 'Pending Head of Supply Chain Approval',
//     'approved': 'Approved - Ready for Procurement',
//     'rejected': 'Rejected',
//     'supply_chain_rejected': 'Rejected by Supply Chain',
//     'in_procurement': 'In Procurement Process',
//     'procurement_complete': 'Procurement Complete',
//     'delivered': 'Delivered'
//   };

//   return stageMap[this.status] || 'Unknown Status';
// };

// // Add to PurchaseRequisitionSchema methods
// // PurchaseRequisitionSchema.methods.generatePettyCashFormNumber = async function() {
// //   const year = new Date().getFullYear();
// //   const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
// //   // Count existing petty cash forms this month
// //   const count = await this.constructor.countDocuments({
// //     'pettyCashForm.generated': true,
// //     'pettyCashForm.generatedDate': {
// //       $gte: new Date(year, new Date().getMonth(), 1),
// //       $lt: new Date(year, new Date().getMonth() + 1, 1)
// //     }
// //   });
  
// //   const formNumber = `PCF-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  
// //   this.pettyCashForm = {
// //     generated: true,
// //     formNumber: formNumber,
// //     generatedDate: new Date(),
// //     generatedBy: this.headApproval?.decidedBy,
// //     status: 'pending_disbursement',
// //     amount: this.supplyChainReview?.estimatedCost || this.budgetXAF,
// //     paymentMethod: 'cash'
// //   };
  
// //   return formNumber;
// // };


// PurchaseRequisitionSchema.methods.generatePettyCashFormNumber = async function() {
//   const year = new Date().getFullYear();
//   const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
//   // Count existing petty cash forms this month
//   const count = await this.constructor.countDocuments({
//     'pettyCashForm.generated': true,
//     'pettyCashForm.generatedDate': {
//       $gte: new Date(year, new Date().getMonth(), 1),
//       $lt: new Date(year, new Date().getMonth() + 1, 1)
//     }
//   });
  
//   const formNumber = `PCF-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  
//   this.pettyCashForm = {
//     generated: true,
//     formNumber: formNumber,
//     generatedDate: new Date(),
//     generatedBy: this.headApproval?.decidedBy,
//     status: 'pending_disbursement',
//     amount: this.supplyChainReview?.estimatedCost || this.budgetXAF,
//     paymentMethod: 'cash'
//   };
  
//   return formNumber;
// };

// // Method to check if finance can verify
// PurchaseRequisitionSchema.methods.canFinanceVerify = function() {
//   return this.status === 'pending_finance_verification';
// };

// // Method to check if supply chain coordinator can assign buyer
// PurchaseRequisitionSchema.methods.canAssignBuyer = function() {
//   return this.status === 'pending_buyer_assignment';
// };

// // Method to check if head can give final approval
// PurchaseRequisitionSchema.methods.canHeadApprove = function() {
//   return this.status === 'pending_head_approval';
// };

// // NEW: Method to get purchase type description
// PurchaseRequisitionSchema.methods.getPurchaseTypeDescription = function() {
//   const typeMap = {
//     'standard': 'Standard Purchase - Regular procurement process',
//     'non_standard': 'Non-Standard Purchase - Specialized items requiring custom procurement',
//     'emergency': 'Emergency Purchase - Urgent procurement with expedited process',
//     'framework': 'Framework Agreement - Using existing contract terms',
//     'capital': 'Capital Equipment - High-value capital expenditure'
//   };

//   return typeMap[this.purchaseType] || 'Standard Purchase';
// };

// module.exports = mongoose.model('PurchaseRequisition', PurchaseRequisitionSchema);



