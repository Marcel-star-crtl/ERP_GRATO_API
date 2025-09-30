const mongoose = require('mongoose');

const approvalStepSchema = new mongoose.Schema({
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
  actionTime: {
    type: String, // Store time as HH:MM:SS format
  },
  // Track when this step becomes active (for sequential processing)
  activatedDate: {
    type: Date
  },
  // Email notification tracking
  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: Date
}, {
  timestamps: true
});

const invoiceSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    required: [true, 'PO number is required'],
    uppercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^PO-\w{2}\d{10}-\d+$/.test(v);
      },
      message: 'PO number format should be: PO-XX0000000000-X (e.g., PO-NG010000000-1)'
    }
  },
  
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    trim: true
  },
  
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Employee details (cached for historical records)
  employeeDetails: {
    name: String,
    email: String,
    department: String,
    position: String
  },
  
  uploadedDate: {
    type: Date,
    default: Date.now
  },

  uploadedTime: {
    type: String,
    default: function() {
      return new Date().toTimeString().split(' ')[0]; // HH:MM:SS
    }
  },
  
  // PO File stored in Cloudinary
  poFile: {
    publicId: String,
    url: String,
    format: String,
    resourceType: String,
    bytes: Number,
    originalName: String
  },
  
  // Invoice File stored in Cloudinary
  invoiceFile: {
    publicId: String,
    url: String,
    format: String,
    resourceType: String,
    bytes: Number,
    originalName: String
  },
  
  // Overall approval status
  approvalStatus: {
    type: String,
    enum: ['pending_finance_assignment', 'pending_department_approval', 'approved', 'rejected', 'processed'],
    default: 'pending_finance_assignment'
  },

  // Department assignment by finance
  assignedDepartment: {
    type: String,
    trim: true
  },

  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  assignmentDate: Date,

  assignmentTime: String,

  // Sequential approval chain
  approvalChain: [approvalStepSchema],

  // Current active approval level (only this person can approve)
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
      enum: ['assigned', 'processed'],
      default: 'assigned'
    },
    finalComments: String
  },
  
  // Legacy fields for backward compatibility
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  reviewDate: Date,
  
  rejectionComments: {
    type: String,
    trim: true
  },
  
  // Additional tracking fields
  metadata: {
    ipAddress: String,
    userAgent: String,
    uploadSource: {
      type: String,
      default: 'web'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to prevent duplicate PO/Invoice combinations per employee
invoiceSchema.index({ 
  poNumber: 1, 
  invoiceNumber: 1, 
  employee: 1 
}, { 
  unique: true,
  name: 'unique_po_invoice_employee'
});

// Indexes for efficient queries
invoiceSchema.index({ employee: 1, uploadedDate: -1 });
invoiceSchema.index({ approvalStatus: 1, uploadedDate: -1 });
invoiceSchema.index({ assignedDepartment: 1, approvalStatus: 1 });
invoiceSchema.index({ poNumber: 1 });
invoiceSchema.index({ 'approvalChain.approver.email': 1, 'approvalChain.status': 1 });
invoiceSchema.index({ currentApprovalLevel: 1, approvalStatus: 1 });

// Virtual for formatted upload date and time
invoiceSchema.virtual('formattedUploadDateTime').get(function() {
  if (!this.uploadedDate) return null;
  const date = this.uploadedDate.toLocaleDateString('en-GB');
  const time = this.uploadedTime || this.uploadedDate.toTimeString().split(' ')[0];
  return `${date} at ${time}`;
});

// Virtual for current approval step (only the active one)
// invoiceSchema.virtual('currentApprovalStep').get(function() {
//   return this.approvalChain.find(step => step.level === this.currentApprovalLevel && step.status === 'pending');
// });
invoiceSchema.virtual('currentApprovalStep').get(function() {
  if (!this.approvalChain || !Array.isArray(this.approvalChain)) return null;
  return this.approvalChain.find(step => 
    step.level === this.currentApprovalLevel && step.status === 'pending'
  );
});

// Virtual for approval progress
// invoiceSchema.virtual('approvalProgress').get(function() {
//   if (this.approvalChain.length === 0) return 0;
//   const approvedSteps = this.approvalChain.filter(step => step.status === 'approved').length;
//   return Math.round((approvedSteps / this.approvalChain.length) * 100);
// });

invoiceSchema.virtual('approvalProgress').get(function() {
  if (!this.approvalChain || !Array.isArray(this.approvalChain) || this.approvalChain.length === 0) return 0;
  const approvedSteps = this.approvalChain.filter(step => step.status === 'approved').length;
  return Math.round((approvedSteps / this.approvalChain.length) * 100);
});

// Virtual for status display
invoiceSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'pending_finance_assignment': 'Pending Finance Assignment',
    'pending_department_approval': 'Pending Department Approval',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'processed': 'Processed'
  };
  return statusMap[this.approvalStatus] || this.approvalStatus;
});

// Method to assign department and create approval chain
invoiceSchema.methods.assignToDepartment = function(department, assignedByUserId) {
  const { getApprovalChain } = require('../config/departmentStructure');
  
  this.assignedDepartment = department;
  this.assignedBy = assignedByUserId;
  this.assignmentDate = new Date();
  this.assignmentTime = new Date().toTimeString().split(' ')[0];
  this.approvalStatus = 'pending_department_approval';
  
  // Create approval chain based on employee's position and hierarchy
  const employeeName = this.employeeDetails?.name || 'Unknown Employee';
  
  console.log(`Creating approval chain for: "${employeeName}" in department: "${department}"`);
  
  const chain = getApprovalChain(employeeName, department);
  
  // Check if approval chain was successfully created
  if (!chain || !Array.isArray(chain) || chain.length === 0) {
    console.warn(`No approval chain found for employee "${employeeName}" in department "${department}". Creating default chain.`);
    
    // Create a default approval chain with department head and president
    const { DEPARTMENT_STRUCTURE } = require('../config/departmentStructure');
    const defaultChain = [];
    
    // Add department head if exists
    if (DEPARTMENT_STRUCTURE[department] && DEPARTMENT_STRUCTURE[department].head) {
      defaultChain.push({
        level: 1,
        approver: DEPARTMENT_STRUCTURE[department].head,
        email: DEPARTMENT_STRUCTURE[department].headEmail,
        role: 'Department Head',
        department: department
      });
    }
    
    // Add president as final approver
    if (DEPARTMENT_STRUCTURE['Executive'] && DEPARTMENT_STRUCTURE['Executive'].head) {
      defaultChain.push({
        level: defaultChain.length + 1,
        approver: DEPARTMENT_STRUCTURE['Executive'].head,
        email: DEPARTMENT_STRUCTURE['Executive'].headEmail,
        role: 'President',
        department: 'Executive'
      });
    }
    
    this.approvalChain = defaultChain.map(step => ({
      level: step.level,
      approver: {
        name: step.approver,
        email: step.email,
        role: step.role,
        department: step.department
      },
      status: 'pending',
      // Only the first step is initially activated
      activatedDate: step.level === 1 ? new Date() : null
    }));
    
  } else {
    // Use the generated approval chain
    this.approvalChain = chain.map(step => ({
      level: step.level,
      approver: {
        name: step.approver,
        email: step.email,
        role: step.role,
        department: step.department
      },
      status: 'pending',
      // Only the first step is initially activated
      activatedDate: step.level === 1 ? new Date() : null
    }));
  }

  // Set current approval level to 1 if we have an approval chain, otherwise 0
  this.currentApprovalLevel = this.approvalChain.length > 0 ? 1 : 0;
  
  const firstApprover = this.approvalChain.length > 0 ? this.approvalChain[0].approver.name : 'None';
  console.log(`Invoice ${this.poNumber} assigned to ${department}. Approval chain length: ${this.approvalChain.length}. First approver: ${firstApprover}`);
};

// Method to process approval step (sequential)
invoiceSchema.methods.processApprovalStep = function(approverEmail, decision, comments, userId) {
  // Find the current active step
  const currentStep = this.approvalChain.find(step => 
    step.level === this.currentApprovalLevel && 
    step.approver.email === approverEmail && 
    step.status === 'pending'
  );

  if (!currentStep) {
    throw new Error(`You are not authorized to approve at this level. Current level: ${this.currentApprovalLevel}`);
  }

  // Update the current step
  currentStep.status = decision === 'approved' ? 'approved' : 'rejected';
  currentStep.decision = decision;
  currentStep.comments = comments;
  currentStep.actionDate = new Date();
  currentStep.actionTime = new Date().toTimeString().split(' ')[0];
  currentStep.approver.userId = userId;

  if (decision === 'rejected') {
    // If rejected, mark entire invoice as rejected
    this.approvalStatus = 'rejected';
    this.rejectionComments = comments;
    this.currentApprovalLevel = 0; // Reset level
    
    console.log(`Invoice ${this.poNumber} REJECTED by ${currentStep.approver.name} at level ${currentStep.level}`);
  } else {
    // If approved, move to next level
    const nextLevel = this.currentApprovalLevel + 1;
    const nextStep = this.approvalChain.find(step => step.level === nextLevel);
    
    if (nextStep) {
      // Activate next step
      this.currentApprovalLevel = nextLevel;
      nextStep.activatedDate = new Date();
      nextStep.notificationSent = false; // Reset notification flag
      
      console.log(`Invoice ${this.poNumber} approved by ${currentStep.approver.name}. Moving to level ${nextLevel}: ${nextStep.approver.name}`);
    } else {
      // All steps completed - fully approved
      this.approvalStatus = 'approved';
      this.currentApprovalLevel = 0; // Reset level
      
      console.log(`Invoice ${this.poNumber} FULLY APPROVED. All approval steps completed.`);
    }
  }

  return currentStep;
};

// Method to get current active approver (only person who can approve right now)
// invoiceSchema.methods.getCurrentApprover = function() {
//   if (this.currentApprovalLevel === 0) return null;
//   return this.approvalChain.find(step => step.level === this.currentApprovalLevel);
// };

invoiceSchema.methods.getCurrentApprover = function() {
  if (this.currentApprovalLevel === 0 || !this.approvalChain || !Array.isArray(this.approvalChain)) {
    return null;
  }
  return this.approvalChain.find(step => step.level === this.currentApprovalLevel);
};

// Method to get next approver (for information purposes)
// invoiceSchema.methods.getNextApprover = function() {
//   const nextLevel = this.currentApprovalLevel + 1;
//   return this.approvalChain.find(step => step.level === nextLevel);
// };
invoiceSchema.methods.getNextApprover = function() {
  if (!this.approvalChain || !Array.isArray(this.approvalChain)) return null;
  const nextLevel = this.currentApprovalLevel + 1;
  return this.approvalChain.find(step => step.level === nextLevel);
};

// Method to check if user can approve at current level
// invoiceSchema.methods.canUserApprove = function(userEmail) {
//   const currentStep = this.getCurrentApprover();
//   return currentStep && currentStep.approver.email === userEmail;
// };
invoiceSchema.methods.canUserApprove = function(userEmail) {
  const currentStep = this.getCurrentApprover();
  return currentStep && currentStep.approver && currentStep.approver.email === userEmail;
};

// Method to get approval history (completed steps only)
// invoiceSchema.methods.getApprovalHistory = function() {
//   return this.approvalChain
//     .filter(step => step.status !== 'pending')
//     .sort((a, b) => a.level - b.level);
// };

invoiceSchema.methods.getApprovalHistory = function() {
  if (!this.approvalChain || !Array.isArray(this.approvalChain)) return [];
  return this.approvalChain
    .filter(step => step.status !== 'pending')
    .sort((a, b) => a.level - b.level);
};

// Method to get pending steps (for display purposes)
invoiceSchema.methods.getPendingSteps = function() {
  if (!this.approvalChain || !Array.isArray(this.approvalChain)) return [];
  return this.approvalChain
    .filter(step => step.status === 'pending')
    .sort((a, b) => a.level - b.level);
};

// Static method to get invoices pending approval for a specific user (current level only)
invoiceSchema.statics.getPendingForApprover = function(approverEmail) {
  return this.find({
    'approvalChain.approver.email': approverEmail,
    'approvalChain.status': 'pending',
    approvalStatus: 'pending_department_approval',
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
  }).populate('employee', 'fullName email department')
    .sort({ assignmentDate: -1 });
};

// Static method to get all invoices for a department supervisor (including upcoming ones)
invoiceSchema.statics.getForSupervisor = function(supervisorEmail) {
  return this.find({
    'approvalChain.approver.email': supervisorEmail,
    approvalStatus: { $in: ['pending_department_approval', 'approved', 'rejected'] }
  }).populate('employee', 'fullName email department')
    .sort({ assignmentDate: -1 });
};

// Method to send notification to current approver
invoiceSchema.methods.notifyCurrentApprover = async function() {
  const currentStep = this.getCurrentApprover();
  if (!currentStep || currentStep.notificationSent) return;
  
  const { sendEmail } = require('../services/emailService');
  
  try {
    await sendEmail({
      to: currentStep.approver.email,
      subject: `🔔 Invoice Approval Required - ${this.poNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #333; margin-top: 0;">🔔 Invoice Approval Required</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear ${currentStep.approver.name},
            </p>
            <p style="color: #555; line-height: 1.6;">
              An invoice is now ready for your approval. You are the current approver in the chain.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">Invoice Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${this.employeeDetails.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>PO Number:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${this.poNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Invoice Number:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${this.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Your Role:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${currentStep.approver.role}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Approval Level:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #ffc107; color: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Level ${currentStep.level}</span></td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/supervisor/invoice/${this._id}" 
                 style="display: inline-block; background-color: #28a745; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px;">
                👀 Review & Process Invoice
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Finance Management System.
            </p>
          </div>
        </div>
      `
    });
    
    // Mark notification as sent
    currentStep.notificationSent = true;
    currentStep.notificationSentAt = new Date();
    await this.save();
    
    console.log(`Notification sent to ${currentStep.approver.email} for invoice ${this.poNumber}`);
  } catch (error) {
    console.error(`Failed to send notification for invoice ${this.poNumber}:`, error);
  }
};

// Method to get approval chain with status indicators
invoiceSchema.methods.getApprovalChainStatus = function() {
  if (!this.approvalChain || !Array.isArray(this.approvalChain)) return [];
  return this.approvalChain.map(step => ({
    ...step.toObject(),
    isActive: step.level === this.currentApprovalLevel,
    isCompleted: step.status !== 'pending',
    isPending: step.status === 'pending' && step.level === this.currentApprovalLevel,
    isWaiting: step.status === 'pending' && step.level > this.currentApprovalLevel
  }));
};

// Method to delete files from Cloudinary
invoiceSchema.methods.deleteCloudinaryFiles = async function() {
  const { cloudinary } = require('../config/cloudinary');
  const deletionPromises = [];
  
  if (this.poFile && this.poFile.publicId) {
    deletionPromises.push(
      cloudinary.uploader.destroy(this.poFile.publicId)
        .catch(err => console.error('Failed to delete PO file:', err))
    );
  }
  
  if (this.invoiceFile && this.invoiceFile.publicId) {
    deletionPromises.push(
      cloudinary.uploader.destroy(this.invoiceFile.publicId)
        .catch(err => console.error('Failed to delete invoice file:', err))
    );
  }
  
  if (deletionPromises.length > 0) {
    await Promise.allSettled(deletionPromises);
  }
};

// Pre-remove middleware to clean up Cloudinary files
invoiceSchema.pre('remove', async function(next) {
  try {
    await this.deleteCloudinaryFiles();
    next();
  } catch (error) {
    console.error('Error deleting Cloudinary files:', error);
    next(error);
  }
});

// Post-save middleware to send notifications
invoiceSchema.post('save', async function() {
  // Only send notification if approval chain exists and we have a current approver
  if (this.approvalStatus === 'pending_department_approval' && 
      this.currentApprovalLevel > 0 && 
      this.approvalChain.length > 0) {
    
    const currentStep = this.getCurrentApprover();
    if (currentStep && !currentStep.notificationSent) {
      // Use setTimeout to avoid blocking the save operation
      setTimeout(() => {
        this.notifyCurrentApprover().catch(err => 
          console.error('Failed to send notification:', err)
        );
      }, 1000);
    }
  }
});

// Handle duplicate key errors
invoiceSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    if (error.keyPattern && error.keyPattern.poNumber && error.keyPattern.invoiceNumber) {
      next(new Error('An invoice with this PO number and invoice number already exists for this employee'));
    } else {
      next(new Error('Duplicate entry detected'));
    }
  } else {
    next(error);
  }
});

module.exports = mongoose.model('Invoice', invoiceSchema);


