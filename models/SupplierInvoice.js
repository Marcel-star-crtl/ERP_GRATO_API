const mongoose = require('mongoose');

const supplierApprovalStepSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: true
  },
  approver: {
    name: String,
    email: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: String,
    department: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  decision: {
    type: String,
    enum: ['approved', 'rejected']
  },
  comments: {
    type: String,
    trim: true
  },
  actionDate: Date,
  actionTime: String,
  activatedDate: Date,
  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: Date
}, {
  timestamps: true
});

const supplierInvoiceSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  },
  
  // Supplier details cached for historical records
  supplierDetails: {
    companyName: String,
    contactName: String,
    email: String,
    supplierType: String,
    businessRegistrationNumber: String
  },
  
  // Invoice information
  invoiceNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  
  poNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^PO-\w{2}\d{8,12}-\d+$/.test(v);
      },
      message: 'PO number format should be: PO-XX########-X (e.g., PO-NG010000000-1)'
    }
  },
  
  invoiceAmount: {
    type: Number,
    default: 0,
    min: 0,
    required: function() {
      return this.approvalStatus !== 'pending_finance_assignment';
    }
  },
  
  currency: {
    type: String,
    default: 'XAF',
    enum: ['XAF', 'USD', 'EUR', 'GBP']
  },
  
  invoiceDate: {
    type: Date,
    default: Date.now,
    // Will be required after finance processes the invoice
    required: function() {
      return this.approvalStatus !== 'pending_finance_assignment';
    }
  },
  
  dueDate: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    },
    // Will be required after finance processes the invoice
    required: function() {
      return this.approvalStatus !== 'pending_finance_assignment';
    }
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: function() {
      return `Invoice ${this.invoiceNumber} for PO ${this.poNumber}`;
    },
    // Will be required after finance processes the invoice
    required: function() {
      return this.approvalStatus !== 'pending_finance_assignment';
    }
  },
  
  // Service/Product details
  serviceCategory: {
    type: String,
    enum: ['HSE', 'Refurbishment', 'Project', 'Operations', 'Diesel', 'Supply Chain', 'HR/Admin', 'General'],
    default: 'General',
    // Will be required after finance processes the invoice
    required: function() {
      return this.approvalStatus !== 'pending_finance_assignment';
    }
  },
  
  lineItems: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number,
    category: String
  }],
  
  uploadedDate: {
    type: Date,
    default: Date.now
  },

  uploadedTime: {
    type: String,
    default: function() {
      return new Date().toTimeString().split(' ')[0];
    }
  },
  
  // Files stored in Cloudinary
  invoiceFile: {
    publicId: String,
    url: String,
    format: String,
    resourceType: String,
    bytes: Number,
    originalName: String
  },
  
  poFile: {
    publicId: String,
    url: String,
    format: String,
    resourceType: String,
    bytes: Number,
    originalName: String
  },
  
  supportingDocuments: [{
    publicId: String,
    url: String,
    format: String,
    resourceType: String,
    bytes: Number,
    originalName: String,
    documentType: String // Contract, Delivery Note, etc.
  }],
  
  // Approval workflow
  approvalStatus: {
    type: String,
    enum: [
      'pending_finance_assignment',
      'pending_department_head_approval',
      'pending_head_of_business_approval', 
      'approved', 
      'rejected', 
      'pending_finance_processing',
      'processed',
      'paid'
    ],
    default: 'pending_finance_assignment'
  },

  // Department assignment by finance
  // assignedDepartment: {
  //   type: String,
  //   enum: ['HSE', 'Refurbishment', 'Project', 'Operations', 'Diesel', 'Supply Chain', 'HR/Admin'],
  //   trim: true
  // },
  assignedDepartment: {
    type: String,
    enum: [
      'HSE', 
      'Refurbishment', 
      'Project', 
      'Operations', 
      'Diesel', 
      'Supply Chain', 
      'HR/Admin',  // FIXED: Changed from 'HR & Admin' to 'HR/Admin' to match approval chain
      'Technical',
      'Business Development & Supply Chain',
      'Finance'
    ],
    trim: true
  },

  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  assignmentDate: Date,
  assignmentTime: String,

  // Sequential approval chain based on service category
  approvalChain: [supplierApprovalStepSchema],

  currentApprovalLevel: {
    type: Number,
    default: 0
  },

  // Finance review
  financeReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewDate: Date,
    reviewTime: String,
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'details_updated', 'assigned', 'processed', 'paid'],
      default: 'submitted'
    },
    finalComments: String,
    paymentDate: Date,
    paymentReference: String,
    paymentAmount: Number,
    paymentMethod: String,
    detailsUpdated: {
      type: Boolean,
      default: false
    },
    detailsUpdatedDate: Date
  },
  
  // Payment tracking
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'overdue', 'disputed'],
    default: 'pending'
  },
  
  paymentDetails: {
    amountPaid: Number,
    paymentDate: Date,
    paymentMethod: String,
    transactionReference: String,
    bankReference: String,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Additional tracking
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  tags: [String],
  
  internalNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Track if supplier provided minimal info initially
  initialSubmission: {
    type: Boolean,
    default: true // True for invoices submitted with minimal info
  },
  
  // Track what details were provided by supplier vs added by finance
  supplierProvidedFields: {
    invoiceNumber: { type: Boolean, default: true },
    poNumber: { type: Boolean, default: true },
    invoiceAmount: { type: Boolean, default: false },
    invoiceDate: { type: Boolean, default: false },
    dueDate: { type: Boolean, default: false },
    description: { type: Boolean, default: false },
    serviceCategory: { type: Boolean, default: false }
  },

  // OPTIONAL CONTRACT LINK
  linkedContract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  },
  
  // Track if manually linked by admin
  contractLinkMethod: {
    type: String,
    enum: ['automatic', 'manual', 'none'],
    default: 'none'
  },
  
  metadata: {
    ipAddress: String,
    userAgent: String,
    uploadSource: {
      type: String,
      default: 'supplier_portal'
    },
    totalProcessingTime: Number,
    escalationCount: Number,
    financeProcessingTime: Number,
    submissionToAssignmentTime: Number
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
supplierInvoiceSchema.index({ supplier: 1, uploadedDate: -1 });
supplierInvoiceSchema.index({ invoiceNumber: 1, supplier: 1 }, { unique: true });
supplierInvoiceSchema.index({ poNumber: 1 });
supplierInvoiceSchema.index({ approvalStatus: 1, uploadedDate: -1 });
supplierInvoiceSchema.index({ assignedDepartment: 1, approvalStatus: 1 });
supplierInvoiceSchema.index({ serviceCategory: 1 });
supplierInvoiceSchema.index({ paymentStatus: 1, dueDate: 1 });
supplierInvoiceSchema.index({ 'approvalChain.approver.email': 1, 'approvalChain.status': 1 });
supplierInvoiceSchema.index({ currentApprovalLevel: 1, approvalStatus: 1 });
supplierInvoiceSchema.index({ initialSubmission: 1, approvalStatus: 1 });

// Virtual for days until due
supplierInvoiceSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  const today = new Date();
  const diffTime = this.dueDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for current approval step
supplierInvoiceSchema.virtual('currentApprovalStep').get(function() {
  if (!this.approvalChain || !Array.isArray(this.approvalChain)) return null;
  return this.approvalChain.find(step => 
    step.level === this.currentApprovalLevel && step.status === 'pending'
  );
});

// Virtual for approval progress
supplierInvoiceSchema.virtual('approvalProgress').get(function() {
  if (!this.approvalChain || !Array.isArray(this.approvalChain) || this.approvalChain.length === 0) return 0;
  const approvedSteps = this.approvalChain.filter(step => step.status === 'approved').length;
  return Math.round((approvedSteps / this.approvalChain.length) * 100);
});

// Virtual for submission readiness
supplierInvoiceSchema.virtual('isReadyForAssignment').get(function() {
  return this.approvalStatus === 'pending_finance_assignment' && 
         this.invoiceAmount > 0 && 
         this.serviceCategory && 
         this.serviceCategory !== 'General' &&
         this.description && 
         this.description !== `Invoice ${this.invoiceNumber} for PO ${this.poNumber}`;
});

// Virtual to check if invoice has minimum required info for approval chain
supplierInvoiceSchema.virtual('hasMinimumInfo').get(function() {
  return this.invoiceAmount > 0 && 
         this.serviceCategory && 
         this.serviceCategory !== 'General' &&
         this.description && 
         this.description !== `Invoice ${this.invoiceNumber} for PO ${this.poNumber}`;
});

// Method for finance to update details before or during assignment
supplierInvoiceSchema.methods.updateFinanceDetails = function(details, financeUserId) {
  const {
    invoiceAmount,
    currency,
    invoiceDate,
    dueDate,
    description,
    serviceCategory,
    priority,
    lineItems
  } = details;

  // Update fields and track what was updated
  if (invoiceAmount !== undefined && invoiceAmount > 0) {
    this.invoiceAmount = parseFloat(invoiceAmount);
    this.supplierProvidedFields.invoiceAmount = false;
  }
  
  if (currency) {
    this.currency = currency;
  }
  
  if (invoiceDate) {
    this.invoiceDate = new Date(invoiceDate);
    this.supplierProvidedFields.invoiceDate = false;
  }
  
  if (dueDate) {
    this.dueDate = new Date(dueDate);
    this.supplierProvidedFields.dueDate = false;
  }
  
  if (description && description.trim()) {
    this.description = description.trim();
    this.supplierProvidedFields.description = false;
  }
  
  if (serviceCategory && serviceCategory !== 'General') {
    this.serviceCategory = serviceCategory;
    this.supplierProvidedFields.serviceCategory = false;
  }
  
  if (priority) {
    this.priority = priority;
  }
  
  if (lineItems) {
    this.lineItems = Array.isArray(lineItems) ? lineItems : [];
  }

  // Update finance review
  this.financeReview = {
    ...this.financeReview,
    reviewedBy: financeUserId,
    reviewDate: new Date(),
    reviewTime: new Date().toTimeString().split(' ')[0],
    status: 'details_updated',
    detailsUpdated: true,
    detailsUpdatedDate: new Date()
  };

  console.log(`Finance updated details for supplier invoice ${this.invoiceNumber}`);
  return this;
};

// Method to process and assign in one step (optional - if finance wants to update details during assignment)
supplierInvoiceSchema.methods.processAndAssign = function(department, assignedByUserId, updateDetails = null) {
  // Update details if provided
  if (updateDetails) {
    this.updateFinanceDetails(updateDetails, assignedByUserId);
  }
  
  // Then assign to department
  this.assignToDepartment(department, assignedByUserId);
  
  return this;
};

// Method to get processing recommendations for finance
supplierInvoiceSchema.methods.getFinanceRecommendations = function() {
  const recommendations = [];
  
  if (this.invoiceAmount <= 0) {
    recommendations.push('Set invoice amount');
  }
  
  if (!this.serviceCategory || this.serviceCategory === 'General') {
    recommendations.push('Specify service category');
  }
  
  if (!this.description || this.description === `Invoice ${this.invoiceNumber} for PO ${this.poNumber}`) {
    recommendations.push('Add detailed description');
  }
  
  if (!this.dueDate || this.daysUntilDue > 45) {
    recommendations.push('Verify due date');
  }
  
  if (this.lineItems.length === 0) {
    recommendations.push('Consider adding line items for clarity');
  }
  
  return recommendations;
};

const mapDepartmentName = (department) => {
  const departmentMapping = {
    'HR & Admin': 'HR/Admin',
    'HR/Admin': 'HR/Admin',
    'Business Development': 'Business Development & Supply Chain',
    'Business Dev': 'Business Development & Supply Chain'
  };
  
  return departmentMapping[department] || department;
};

supplierInvoiceSchema.methods.assignToDepartment = function(department, assignedByUserId) {
  const { getSupplierApprovalChain } = require('../config/supplierApprovalChain');
  
  if (this.approvalStatus !== 'pending_finance_assignment') {
    throw new Error('Invoice has already been assigned or processed');
  }
  
  // FIXED: Map department name to match enum values
  const mappedDepartment = mapDepartmentName(department);
  
  this.assignedDepartment = mappedDepartment;
  this.assignedBy = assignedByUserId;
  this.assignmentDate = new Date();
  this.assignmentTime = new Date().toTimeString().split(' ')[0];
  this.approvalStatus = 'pending_department_head_approval'; // Updated for new workflow
  
  // NEW WORKFLOW: Get simplified approval chain - Department Head → Head of Business only
  const chain = getSupplierApprovalChain(department, this.serviceCategory);
  this.approvalChain = chain.map(step => ({
    level: step.level,
    approver: {
      name: step.approver,
      email: step.email,
      role: step.role,
      department: step.department
    },
    status: 'pending',
    activatedDate: step.level === 1 ? new Date() : null
  }));

  this.currentApprovalLevel = this.approvalChain.length > 0 ? 1 : 0;
  
  // Update finance review status
  this.financeReview = {
    ...this.financeReview,
    reviewedBy: assignedByUserId,
    reviewDate: new Date(),
    reviewTime: new Date().toTimeString().split(' ')[0],
    status: 'assigned'
  };

  if (this.metadata) {
    this.metadata.submissionToAssignmentTime = 
      (this.assignmentDate - this.uploadedDate) / (1000 * 60 * 60 * 24); // days
  }
  
  this.initialSubmission = false;
  
  console.log(`Supplier Invoice ${this.invoiceNumber} assigned to ${mappedDepartment}. First approver: ${this.approvalChain[0]?.approver.name}`);
};

// Method to process approval step (sequential)
supplierInvoiceSchema.methods.processApprovalStep = function(approverEmail, decision, comments, userId) {
  const currentStep = this.approvalChain.find(step => 
    step.level === this.currentApprovalLevel && 
    step.approver.email === approverEmail && 
    step.status === 'pending'
  );

  if (!currentStep) {
    throw new Error(`You are not authorized to approve at this level. Current level: ${this.currentApprovalLevel}`);
  }

  currentStep.status = decision === 'approved' ? 'approved' : 'rejected';
  currentStep.decision = decision;
  currentStep.comments = comments;
  currentStep.actionDate = new Date();
  currentStep.actionTime = new Date().toTimeString().split(' ')[0];
  currentStep.approver.userId = userId;

  if (decision === 'rejected') {
    this.approvalStatus = 'rejected';
    this.currentApprovalLevel = 0;
  } else {
    const nextLevel = this.currentApprovalLevel + 1;
    const nextStep = this.approvalChain.find(step => step.level === nextLevel);
    
    if (nextStep) {
      // Move to next approval level
      this.currentApprovalLevel = nextLevel;
      nextStep.activatedDate = new Date();
      nextStep.notificationSent = false;
      
      // Update status based on current level
      if (this.currentApprovalLevel === 1) {
        this.approvalStatus = 'pending_department_head_approval';
      } else if (this.currentApprovalLevel === 2) {
        this.approvalStatus = 'pending_head_of_business_approval';
      }
    } else {
      // All approvals complete - ready for finance processing
      this.approvalStatus = 'pending_finance_processing';
      this.currentApprovalLevel = 0;
    }
  }

  return currentStep;
};

// Method to get current active approver
supplierInvoiceSchema.methods.getCurrentApprover = function() {
  if (this.currentApprovalLevel === 0 || !this.approvalChain || !Array.isArray(this.approvalChain)) {
    return null;
  }
  return this.approvalChain.find(step => step.level === this.currentApprovalLevel);
};

// Method to check if user can approve
supplierInvoiceSchema.methods.canUserApprove = function(userEmail) {
  const currentStep = this.getCurrentApprover();
  return currentStep && currentStep.approver && currentStep.approver.email === userEmail;
};

// Method to get approval history
supplierInvoiceSchema.methods.getApprovalHistory = function() {
  if (!this.approvalChain || !Array.isArray(this.approvalChain)) return [];
  return this.approvalChain
    .filter(step => step.status !== 'pending')
    .sort((a, b) => a.level - b.level);
};

// Method to get processing status for display
supplierInvoiceSchema.methods.getProcessingStatus = function() {
  if (this.approvalStatus === 'pending_finance_assignment') {
    if (this.initialSubmission) {
      return 'Awaiting Finance Review';
    } else {
      return 'Ready for Department Assignment';
    }
  }
  return this.approvalStatus;
};

// Method to send notification to current approver
supplierInvoiceSchema.methods.notifyCurrentApprover = async function() {
  const currentStep = this.getCurrentApprover();
  if (!currentStep || currentStep.notificationSent) return;
  
  const { sendEmail } = require('../services/emailService');
  
  try {
    await sendEmail({
      to: currentStep.approver.email,
      subject: `Supplier Invoice Approval Required - ${this.invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #333; margin-top: 0;">Supplier Invoice Approval Required</h2>
            <p style="color: #555;">Dear ${currentStep.approver.name},</p>
            <p>A supplier invoice requires your approval.</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Invoice Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Supplier:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${this.supplierDetails.companyName}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Contact:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${this.supplierDetails.contactName}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Invoice Number:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${this.invoiceNumber}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>PO Number:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${this.poNumber}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${this.currency} ${this.invoiceAmount.toLocaleString()}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Service Category:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${this.serviceCategory}</td></tr>
                <tr><td style="padding: 8px 0;"><strong>Approval Level:</strong></td><td style="padding: 8px 0;"><span style="background-color: #ffc107; color: #333; padding: 4px 8px; border-radius: 4px;">Level ${currentStep.level}</span></td></tr>
              </table>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p><strong>Description:</strong></p>
              <p style="font-style: italic;">${this.description}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/supervisor/supplier-invoice/${this._id}" 
                 style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Review Supplier Invoice
              </a>
            </div>
          </div>
        </div>
      `
    });
    
    currentStep.notificationSent = true;
    currentStep.notificationSentAt = new Date();
    await this.save();
    
  } catch (error) {
    console.error(`Failed to send supplier invoice notification:`, error);
  }
};

// Static method to get pending invoices for approver
supplierInvoiceSchema.statics.getPendingForApprover = function(approverEmail) {
  return this.find({
    'approvalChain.approver.email': approverEmail,
    'approvalChain.status': 'pending',
    approvalStatus: { $in: ['pending_department_head_approval', 'pending_head_of_business_approval'] },
    $expr: {
      $let: {
        vars: {
          currentStep: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$approvalChain',
                  cond: { $eq: ['$$this.level', '$currentApprovalLevel'] }
                }
              },
              0
            ]
          }
        },
        in: { $eq: ['$$currentStep.approver.email', approverEmail] }
      }
    }
  }).populate('supplier', 'supplierDetails.companyName supplierDetails.contactName email supplierDetails.supplierType')
    .sort({ assignmentDate: -1 });
};

// Static method to get invoices needing finance processing (includes new pending_finance_processing status)
supplierInvoiceSchema.statics.getPendingFinanceProcessing = function() {
  return this.find({
    $or: [
      { approvalStatus: 'pending_finance_assignment', initialSubmission: true },
      { approvalStatus: 'pending_finance_processing' }
    ]
  }).populate('supplier', 'supplierDetails email')
    .sort({ uploadedDate: 1 }); // Oldest first
};

// Method to delete files from Cloudinary
supplierInvoiceSchema.methods.deleteCloudinaryFiles = async function() {
  const { cloudinary } = require('../config/cloudinary');
  const deletionPromises = [];
  
  if (this.invoiceFile && this.invoiceFile.publicId) {
    deletionPromises.push(
      cloudinary.uploader.destroy(this.invoiceFile.publicId)
        .catch(err => console.error('Failed to delete invoice file:', err))
    );
  }
  
  if (this.poFile && this.poFile.publicId) {
    deletionPromises.push(
      cloudinary.uploader.destroy(this.poFile.publicId)
        .catch(err => console.error('Failed to delete PO file:', err))
    );
  }
  
  // Delete supporting documents
  this.supportingDocuments.forEach(doc => {
    if (doc.publicId) {
      deletionPromises.push(
        cloudinary.uploader.destroy(doc.publicId)
          .catch(err => console.error('Failed to delete supporting document:', err))
      );
    }
  });
  
  if (deletionPromises.length > 0) {
    await Promise.allSettled(deletionPromises);
  }
};

// Add method to link to contract
supplierInvoiceSchema.methods.linkToContract = async function(contractId, method = 'manual') {
  const Contract = mongoose.model('Contract');
  const contract = await Contract.findById(contractId);
  
  if (!contract) {
    throw new Error('Contract not found');
  }
  
  // Verify contract belongs to same supplier
  if (contract.supplier.toString() !== this.supplier.toString()) {
    throw new Error('Contract does not belong to this supplier');
  }
  
  this.linkedContract = contractId;
  this.contractLinkMethod = method;
  await this.save();
  
  // Add invoice to contract's linked invoices
  await contract.linkInvoice(this._id);
  
  console.log(`Invoice ${this.invoiceNumber} linked to contract ${contract.contractNumber}`);
};

// Pre-remove middleware
supplierInvoiceSchema.pre('remove', async function(next) {
  try {
    await this.deleteCloudinaryFiles();
    next();
  } catch (error) {
    next(error);
  }
});

// Post-save middleware for notifications
supplierInvoiceSchema.post('save', async function() {
  if ((this.approvalStatus === 'pending_department_head_approval' || 
       this.approvalStatus === 'pending_head_of_business_approval') && 
      this.currentApprovalLevel > 0 && 
      this.approvalChain.length > 0) {
    
    const currentStep = this.getCurrentApprover();
    if (currentStep && !currentStep.notificationSent) {
      setTimeout(() => {
        this.notifyCurrentApprover().catch(err => 
          console.error('Failed to send supplier invoice notification:', err)
        );
      }, 1000);
    }
  }
});

module.exports = mongoose.model('SupplierInvoice', supplierInvoiceSchema);


