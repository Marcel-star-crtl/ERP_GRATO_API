// models/Contract.js - Updated with Supplier Reference

const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  dueDate: Date,
  completionDate: Date,
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'overdue'],
    default: 'pending'
  },
  responsibleParty: {
    type: String,
    enum: ['supplier', 'client', 'both']
  },
  notes: String
}, { timestamps: true });

const amendmentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Price Adjustment', 'Scope Change', 'Term Extension', 'Performance Modification', 'Compliance Update', 'General Amendment'],
    required: true
  },
  description: { type: String, required: true },
  effectiveDate: { type: Date, required: true },
  financialImpact: {
    amount: Number,
    type: {
      type: String,
      enum: ['increase', 'decrease', 'neutral']
    }
  },
  documents: [{
    name: String,
    url: String,
    publicId: String,
    uploadedAt: Date
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalDate: Date,
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected'],
    default: 'draft'
  }
}, { timestamps: true });

const ContractSchema = new mongoose.Schema({
  contractNumber: {
    type: String,
    unique: true,
    default: function() {
      return 'CNT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }
  },
  
  // UNIFIED SUPPLIER REFERENCE
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Basic Information
  title: { type: String, required: true },
  description: String,
  type: {
    type: String,
    enum: ['Supply Agreement', 'Service Agreement', 'Framework Agreement', 'Purchase Order', 'Maintenance Contract', 'Consulting Agreement', 'Lease Agreement', 'Other'],
    required: true
  },
  category: {
    type: String,
    enum: ['IT Equipment', 'Office Supplies', 'Professional Services', 'Maintenance', 'Construction', 'Energy & Environment', 'Transportation', 'Healthcare', 'Other'],
    required: true
  },
  
  // Contract Period
  dates: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    signedDate: Date,
    effectiveDate: Date
  },
  
  // Financial Details
  financials: {
    totalValue: { type: Number, required: true },
    currency: { type: String, default: 'XAF' },
    paymentTerms: String,
    deliveryTerms: String,
    priceAdjustmentClause: String
  },
  
  // Linked Invoices
  linkedInvoices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierInvoice'
  }],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'active', 'expiring_soon', 'expired', 'terminated', 'renewed', 'suspended'],
    default: 'draft'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  
  // Management
  management: {
    contractManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: String,
    reviewCycle: String // e.g., 'Monthly', 'Quarterly', 'Annual'
  },
  
  // Renewal
  renewal: {
    isRenewable: { type: Boolean, default: false },
    autoRenewal: { type: Boolean, default: false },
    renewalNoticePeriod: Number, // days
    renewalHistory: [{
      renewalDate: Date,
      previousEndDate: Date,
      newEndDate: Date,
      renewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
  },
  
  // Terms & Conditions
  terms: {
    terminationClause: String,
    penaltyClause: String,
    warrantyTerms: String,
    confidentialityTerms: String,
    disputeResolution: String
  },
  
  // Performance Tracking
  performance: {
    kpis: [{
      metric: String,
      target: String,
      actual: String,
      status: String
    }],
    lastReviewDate: Date,
    nextReviewDate: Date
  },
  
  // Milestones
  milestones: [milestoneSchema],
  
  // Amendments
  amendments: [amendmentSchema],
  
  // Documents
  documents: [{
    name: String,
    type: String,
    url: String,
    publicId: String,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Notes
  internalNotes: String,
  
  // Audit Trail
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ContractSchema.index({ supplier: 1, status: 1 });
ContractSchema.index({ contractNumber: 1 });
ContractSchema.index({ 'dates.endDate': 1, status: 1 });

// Virtual for days until expiry
ContractSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.dates.endDate) return null;
  const today = new Date();
  const diffTime = this.dates.endDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for invoice totals
ContractSchema.virtual('invoiceTotals').get(function() {
  // This will be populated when needed
  return null;
});

// Methods
ContractSchema.methods.getInvoiceTotal = async function() {
  const SupplierInvoice = mongoose.model('SupplierInvoice');
  const invoices = await SupplierInvoice.find({
    _id: { $in: this.linkedInvoices }
  });
  
  return invoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0);
};

ContractSchema.methods.getRemainingValue = async function() {
  const invoiced = await this.getInvoiceTotal();
  return this.financials.totalValue - invoiced;
};

ContractSchema.methods.linkInvoice = async function(invoiceId) {
  if (!this.linkedInvoices.includes(invoiceId)) {
    this.linkedInvoices.push(invoiceId);
    await this.save();
  }
};

ContractSchema.methods.unlinkInvoice = async function(invoiceId) {
  this.linkedInvoices = this.linkedInvoices.filter(id => id.toString() !== invoiceId.toString());
  await this.save();
};

// Check if contract is expiring soon (30 days)
ContractSchema.methods.checkExpiryStatus = function() {
  const daysLeft = this.daysUntilExpiry;
  if (daysLeft <= 0) {
    this.status = 'expired';
  } else if (daysLeft <= 30 && this.status === 'active') {
    this.status = 'expiring_soon';
  }
};

// Pre-save middleware
ContractSchema.pre('save', function(next) {
  this.checkExpiryStatus();
  next();
});

// Static method to trigger performance evaluation on completion
ContractSchema.statics.triggerPerformanceEvaluation = async function(contractId) {
  const contract = await this.findById(contractId).populate('supplier');
  if (!contract) return;
  
  // Create performance evaluation
  const SupplierPerformance = mongoose.model('SupplierPerformance');
  
  const evaluation = new SupplierPerformance({
    supplier: contract.supplier._id,
    supplierName: contract.supplier.supplierDetails.companyName,
    evaluationPeriod: {
      startDate: contract.dates.startDate,
      endDate: contract.dates.endDate
    },
    status: 'draft',
    remarks: `Auto-generated evaluation for contract ${contract.contractNumber}`,
    // Default values - admin should complete
    onTimeDeliveryRate: 0,
    qualityRating: 0,
    costCompliance: 0,
    responsivenessRating: 0
  });
  
  await evaluation.save();
  console.log(`Performance evaluation created for contract ${contract.contractNumber}`);
};

// Post-save middleware to check for completion
ContractSchema.post('save', async function(doc) {
  if (doc.status === 'expired' || doc.status === 'terminated') {
    // Check if performance evaluation already exists
    const SupplierPerformance = mongoose.model('SupplierPerformance');
    const existingEval = await SupplierPerformance.findOne({
      supplier: doc.supplier,
      'evaluationPeriod.startDate': doc.dates.startDate,
      'evaluationPeriod.endDate': doc.dates.endDate
    });
    
    if (!existingEval) {
      await mongoose.model('Contract').triggerPerformanceEvaluation(doc._id);
    }
  }
});

module.exports = mongoose.model('Contract', ContractSchema);










// const mongoose = require('mongoose');

// const ContractSchema = new mongoose.Schema({
//   contractNumber: {
//     type: String,
//     unique: true,
//     required: true
//   },
//   title: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     required: true
//   },
  
//   type: {
//     type: String,
//     enum: [
//       'Supply Agreement',
//       'Service Agreement', 
//       'Framework Agreement',
//       'Purchase Order',
//       'Maintenance Contract',
//       'Consulting Agreement',
//       'Lease Agreement',
//       'Other'
//     ],
//     required: true
//   },
//   category: {
//     type: String,
//     enum: [
//       'IT Equipment',
//       'Office Supplies',
//       'Professional Services',
//       'Maintenance',
//       'Construction',
//       'Energy & Environment',
//       'Transportation',
//       'Healthcare',
//       'Other'
//     ],
//     required: true
//   },
  
//   // Supplier Information
//   supplier: {
//     supplierId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true
//     },
//     supplierName: {
//       type: String,
//       required: true
//     },
//     contactPerson: String,
//     contactEmail: String,
//     contactPhone: String
//   },
  
//   // Financial Details
//   financials: {
//     totalValue: {
//       type: Number,
//       required: true,
//       min: 0
//     },
//     currency: {
//       type: String,
//       default: 'XAF',
//       enum: ['XAF', 'USD', 'EUR', 'GBP']
//     },
//     paymentTerms: {
//       type: String,
//       enum: ['15 days NET', '30 days NET', '45 days NET', '60 days NET', 'Cash on Delivery', 'Advance Payment'],
//       required: true
//     },
//     deliveryTerms: {
//       type: String,
//       required: true
//     },
//     taxRate: {
//       type: Number,
//       default: 19.25,
//       min: 0,
//       max: 100
//     }
//   },
  
//   // Contract Dates and Duration
//   dates: {
//     creationDate: {
//       type: Date,
//       default: Date.now
//     },
//     startDate: {
//       type: Date,
//       required: true
//     },
//     endDate: {
//       type: Date,
//       required: true
//     },
//     signedDate: Date,
//     approvedDate: Date,
//     lastModified: {
//       type: Date,
//       default: Date.now
//     }
//   },
  
//   // Status and Priority
//   status: {
//     type: String,
//     enum: [
//       'draft',
//       'pending_approval',
//       'approved',
//       'active',
//       'expiring_soon',
//       'expired',
//       'terminated',
//       'suspended',
//       'renewed',
//       'cancelled'
//     ],
//     default: 'draft',
//     required: true
//   },
//   priority: {
//     type: String,
//     enum: ['Low', 'Medium', 'High', 'Critical'],
//     default: 'Medium'
//   },
  
//   // Renewal Information
//   renewal: {
//     isRenewable: {
//       type: Boolean,
//       default: false
//     },
//     autoRenewal: {
//       type: Boolean,
//       default: false
//     },
//     renewalPeriod: {
//       type: Number, // in months
//       default: 12
//     },
//     renewalNotificationDays: {
//       type: Number,
//       default: 30
//     },
//     renewalHistory: [{
//       renewalDate: Date,
//       previousEndDate: Date,
//       newEndDate: Date,
//       renewedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       },
//       notes: String,
//       createdAt: {
//         type: Date,
//         default: Date.now
//       }
//     }]
//   },
  
//   // Contract Management
//   management: {
//     contractManager: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true
//     },
//     department: {
//       type: String,
//       enum: ['IT', 'Admin', 'Operations', 'Finance', 'HR', 'HSE', 'Supply Chain'],
//       required: true
//     },
//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true
//     },
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     lastModifiedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   },
  
//   // Contract Performance and Compliance
//   performance: {
//     deliveryRating: {
//       type: Number,
//       min: 1,
//       max: 5,
//       default: 3
//     },
//     qualityRating: {
//       type: Number,
//       min: 1,
//       max: 5,
//       default: 3
//     },
//     serviceRating: {
//       type: Number,
//       min: 1,
//       max: 5,
//       default: 3
//     },
//     complianceScore: {
//       type: Number,
//       min: 0,
//       max: 100,
//       default: 85
//     },
//     lastReviewDate: Date,
//     nextReviewDate: Date,
//     performanceNotes: String
//   },
  
//   // Risk Assessment
//   risk: {
//     level: {
//       type: String,
//       enum: ['Low', 'Medium', 'High', 'Critical'],
//       default: 'Medium'
//     },
//     factors: [String],
//     lastAssessment: Date,
//     assessedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     mitigationPlan: String
//   },
  
//   // Contract Milestones
//   milestones: [{
//     name: {
//       type: String,
//       required: true
//     },
//     description: String,
//     dueDate: {
//       type: Date,
//       required: true
//     },
//     completedDate: Date,
//     status: {
//       type: String,
//       enum: ['pending', 'in_progress', 'completed', 'overdue', 'cancelled'],
//       default: 'pending'
//     },
//     responsibleParty: {
//       type: String,
//       enum: ['supplier', 'client', 'both']
//     },
//     notes: String,
//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
  
//   // Contract Amendments
//   amendments: [{
//     amendmentNumber: {
//       type: String,
//       required: true
//     },
//     type: {
//       type: String,
//       enum: [
//         'Price Adjustment',
//         'Scope Change',
//         'Term Extension',
//         'Performance Modification',
//         'Compliance Update',
//         'General Amendment'
//       ],
//       required: true
//     },
//     description: {
//       type: String,
//       required: true
//     },
//     effectiveDate: {
//       type: Date,
//       required: true
//     },
//     financialImpact: {
//       amount: Number,
//       type: {
//         type: String,
//         enum: ['increase', 'decrease', 'neutral']
//       }
//     },
//     status: {
//       type: String,
//       enum: ['draft', 'pending_approval', 'approved', 'rejected', 'active'],
//       default: 'draft'
//     },
//     requestedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true
//     },
//     approvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     documents: [{
//       filename: String,
//       originalName: String,
//       url: String,
//       publicId: String,
//       uploadDate: {
//         type: Date,
//         default: Date.now
//       }
//     }],
//     createdAt: {
//       type: Date,
//       default: Date.now
//     }
//   }],
  
//   // Contract Documents
//   documents: [{
//     name: {
//       type: String,
//       required: true
//     },
//     type: {
//       type: String,
//       enum: [
//         'master_agreement',
//         'sla',
//         'amendment',
//         'addendum',
//         'certificate',
//         'specification',
//         'other'
//       ],
//       required: true
//     },
//     filename: String,
//     originalName: String,
//     mimetype: String,
//     size: Number,
//     url: String,
//     publicId: String,
//     version: {
//       type: Number,
//       default: 1
//     },
//     isActive: {
//       type: Boolean,
//       default: true
//     },
//     uploadDate: {
//       type: Date,
//       default: Date.now
//     },
//     uploadedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
  
//   // Notifications and Alerts
//   notifications: [{
//     type: {
//       type: String,
//       enum: [
//         'renewal_due',
//         'expiry_warning',
//         'milestone_due',
//         'performance_issue',
//         'compliance_alert',
//         'amendment_required'
//       ],
//       required: true
//     },
//     message: {
//       type: String,
//       required: true
//     },
//     severity: {
//       type: String,
//       enum: ['info', 'warning', 'error', 'critical'],
//       default: 'info'
//     },
//     isActive: {
//       type: Boolean,
//       default: true
//     },
//     createdDate: {
//       type: Date,
//       default: Date.now
//     },
//     acknowledgedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     acknowledgedDate: Date
//   }],
  
//   // Communication and Notes
//   communications: [{
//     type: {
//       type: String,
//       enum: ['email', 'phone', 'meeting', 'review', 'amendment', 'renewal', 'other']
//     },
//     subject: String,
//     summary: {
//       type: String,
//       required: true
//     },
//     date: {
//       type: Date,
//       default: Date.now
//     },
//     participants: [String],
//     followUpRequired: Boolean,
//     followUpDate: Date,
//     recordedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
  
//   // Internal Notes
//   internalNotes: {
//     type: String
//   },
  
//   // Compliance and Legal
//   compliance: {
//     status: {
//       type: String,
//       enum: ['compliant', 'under_review', 'non_compliant', 'pending'],
//       default: 'pending'
//     },
//     lastAuditDate: Date,
//     nextAuditDate: Date,
//     certifications: [String],
//     legalReviewRequired: {
//       type: Boolean,
//       default: false
//     },
//     legalReviewedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     legalReviewDate: Date
//   },
  
//   // Archive Information
//   archiveInfo: {
//     isArchived: {
//       type: Boolean,
//       default: false
//     },
//     archivedDate: Date,
//     archivedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     archiveReason: String
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes for better query performance
// ContractSchema.index({ contractNumber: 1 });
// ContractSchema.index({ status: 1 });
// ContractSchema.index({ 'supplier.supplierId': 1 });
// ContractSchema.index({ 'dates.endDate': 1 });
// ContractSchema.index({ 'dates.startDate': 1 });
// ContractSchema.index({ 'management.department': 1 });
// ContractSchema.index({ 'management.contractManager': 1 });
// ContractSchema.index({ category: 1 });
// ContractSchema.index({ type: 1 });
// ContractSchema.index({ priority: 1 });

// // Virtual for contract duration in days
// ContractSchema.virtual('durationInDays').get(function() {
//   const start = new Date(this.dates.startDate);
//   const end = new Date(this.dates.endDate);
//   return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
// });

// // Virtual for days until expiry
// ContractSchema.virtual('daysUntilExpiry').get(function() {
//   const today = new Date();
//   const endDate = new Date(this.dates.endDate);
//   return Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
// });

// // Virtual for contract age
// ContractSchema.virtual('contractAge').get(function() {
//   const today = new Date();
//   const startDate = new Date(this.dates.startDate);
//   return Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
// });

// // Virtual for completion percentage
// ContractSchema.virtual('completionPercentage').get(function() {
//   const totalDuration = this.durationInDays;
//   const ageInDays = this.contractAge;
  
//   if (totalDuration <= 0) return 0;
//   if (ageInDays <= 0) return 0;
//   if (ageInDays >= totalDuration) return 100;
  
//   return Math.round((ageInDays / totalDuration) * 100);
// });

// // Method to check if contract is expiring soon
// ContractSchema.methods.isExpiringSoon = function(days = 30) {
//   return this.daysUntilExpiry <= days && this.daysUntilExpiry > 0;
// };

// // Method to update contract status based on dates
// ContractSchema.methods.updateStatusBasedOnDates = function() {
//   const today = new Date();
//   const startDate = new Date(this.dates.startDate);
//   const endDate = new Date(this.dates.endDate);
  
//   if (today < startDate && this.status === 'approved') {
//     this.status = 'approved';
//   } else if (today >= startDate && today <= endDate && this.status !== 'suspended' && this.status !== 'terminated') {
//     if (this.isExpiringSoon()) {
//       this.status = 'expiring_soon';
//     } else {
//       this.status = 'active';
//     }
//   } else if (today > endDate) {
//     this.status = 'expired';
//   }
  
//   return this;
// };

// // Method to add milestone
// ContractSchema.methods.addMilestone = function(milestoneData, userId) {
//   this.milestones.push({
//     ...milestoneData,
//     createdBy: userId
//   });
//   return this.save();
// };

// // Method to update milestone status
// ContractSchema.methods.updateMilestoneStatus = function(milestoneId, status, completedDate = null) {
//   const milestone = this.milestones.id(milestoneId);
//   if (milestone) {
//     milestone.status = status;
//     if (status === 'completed' && completedDate) {
//       milestone.completedDate = completedDate;
//     }
//   }
//   return this.save();
// };

// // Method to add amendment
// ContractSchema.methods.addAmendment = function(amendmentData, userId) {
//   const amendmentNumber = `AMD-${this.contractNumber}-${String(this.amendments.length + 1).padStart(3, '0')}`;
  
//   this.amendments.push({
//     ...amendmentData,
//     amendmentNumber,
//     requestedBy: userId
//   });
  
//   return this.save();
// };

// // Method to add communication record
// ContractSchema.methods.addCommunication = function(communicationData, userId) {
//   this.communications.push({
//     ...communicationData,
//     recordedBy: userId
//   });
  
//   // Keep only last 50 communications
//   if (this.communications.length > 50) {
//     this.communications = this.communications.slice(-50);
//   }
  
//   return this.save();
// };

// // Method to add notification
// ContractSchema.methods.addNotification = function(type, message, severity = 'info') {
//   // Remove any existing active notifications of the same type
//   this.notifications = this.notifications.filter(n => n.type !== type || !n.isActive);
  
//   this.notifications.push({
//     type,
//     message,
//     severity,
//     isActive: true
//   });
  
//   return this.save();
// };

// // Method to calculate risk score
// ContractSchema.methods.calculateRiskScore = function() {
//   let riskScore = 0;
  
//   // Financial risk (contract value)
//   if (this.financials.totalValue > 50000000) riskScore += 3; // High value
//   else if (this.financials.totalValue > 20000000) riskScore += 2;
//   else riskScore += 1;
  
//   // Duration risk
//   const duration = this.durationInDays;
//   if (duration > 730) riskScore += 3; // > 2 years
//   else if (duration > 365) riskScore += 2; // > 1 year
//   else riskScore += 1;
  
//   // Performance risk
//   const avgRating = (this.performance.deliveryRating + this.performance.qualityRating + this.performance.serviceRating) / 3;
//   if (avgRating < 3) riskScore += 3;
//   else if (avgRating < 4) riskScore += 2;
//   else riskScore += 1;
  
//   // Compliance risk
//   if (this.performance.complianceScore < 70) riskScore += 3;
//   else if (this.performance.complianceScore < 85) riskScore += 2;
//   else riskScore += 1;
  
//   // Determine risk level
//   if (riskScore >= 10) return 'Critical';
//   else if (riskScore >= 8) return 'High';
//   else if (riskScore >= 5) return 'Medium';
//   else return 'Low';
// };

// // Method to generate renewal notification
// ContractSchema.methods.generateRenewalNotification = function() {
//   const daysUntilExpiry = this.daysUntilExpiry;
  
//   if (this.renewal.isRenewable && daysUntilExpiry <= this.renewal.renewalNotificationDays && daysUntilExpiry > 0) {
//     const message = `Contract renewal due in ${daysUntilExpiry} days. Please initiate renewal process.`;
//     this.addNotification('renewal_due', message, 'warning');
//   }
// };

// // Static method to get expiring contracts
// ContractSchema.statics.getExpiringContracts = function(days = 30) {
//   const cutoffDate = new Date();
//   cutoffDate.setDate(cutoffDate.getDate() + days);
  
//   return this.find({
//     'dates.endDate': { $lte: cutoffDate, $gt: new Date() },
//     status: { $in: ['active', 'expiring_soon'] }
//   }).populate('management.contractManager', 'fullName email')
//     .populate('supplier.supplierId', 'fullName email');
// };

// // Static method to get contracts by status
// ContractSchema.statics.getContractsByStatus = function(status) {
//   return this.find({ status })
//     .populate('management.contractManager', 'fullName email')
//     .populate('supplier.supplierId', 'fullName email')
//     .sort({ 'dates.endDate': 1 });
// };

// // Pre-save middleware to update status and generate notifications
// ContractSchema.pre('save', function(next) {
//   // Update status based on dates
//   this.updateStatusBasedOnDates();
  
//   // Update last modified date
//   this.dates.lastModified = new Date();
  
//   // Generate renewal notifications
//   this.generateRenewalNotification();
  
//   // Update risk level
//   this.risk.level = this.calculateRiskScore();
  
//   next();
// });

// // Pre-save middleware to generate contract number if not exists
// ContractSchema.pre('save', function(next) {
//   if (!this.contractNumber) {
//     const year = new Date().getFullYear();
//     const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
//     this.contractNumber = `CON-${year}-${randomSuffix}`;
//   }
//   next();
// });

// module.exports = mongoose.models.Contract || mongoose.model('Contract', ContractSchema);