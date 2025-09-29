const mongoose = require('mongoose');

const IncidentReportSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportNumber: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: true,
    minlength: 5
  },
  department: {
    type: String,
    required: true
  },
  incidentType: {
    type: String,
    enum: [
      'injury',
      'near_miss',
      'equipment',
      'environmental',
      'security',
      'fire',
      'other'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    required: true
  },
  description: {
    type: String,
    required: true,
    minlength: 20
  },

  // Location and Time Information
  location: {
    type: String,
    required: true
  },
  specificLocation: {
    type: String,
    required: true
  },
  incidentDate: {
    type: Date,
    required: true
  },
  incidentTime: {
    type: String,
    required: true
  },
  reportedDate: {
    type: Date,
    default: Date.now
  },

  // Environmental conditions
  weatherConditions: String,
  lightingConditions: String,

  // People involved
  injuriesReported: {
    type: Boolean,
    default: false
  },
  peopleInvolved: [String],
  witnesses: [String],

  // Injury details (if applicable)
  injuryDetails: {
    bodyPartsAffected: [String],
    injuryType: [String],
    medicalAttentionRequired: {
      type: String,
      enum: ['none', 'first_aid', 'medical_center', 'hospital', 'doctor']
    },
    medicalProvider: String,
    hospitalName: String,
    treatmentReceived: String,
    workRestrictions: {
      type: String,
      enum: ['none', 'light_duty', 'time_off', 'other']
    }
  },

  // Equipment/Property details (if applicable)
  equipmentDetails: {
    equipmentInvolved: String,
    equipmentCondition: String,
    damageDescription: String,
    estimatedCost: Number
  },

  // Environmental details (if applicable)
  environmentalDetails: {
    substanceInvolved: String,
    quantityReleased: String,
    containmentMeasures: String,
    environmentalImpact: String
  },

  // Immediate actions
  immediateActions: {
    type: String,
    required: true
  },
  emergencyServicesContacted: {
    type: Boolean,
    default: false
  },
  supervisorNotified: {
    type: Boolean,
    default: false
  },
  supervisorName: String,
  notificationTime: String,

  // Contributing factors and analysis
  contributingFactors: String,
  rootCause: String,
  preventiveMeasures: String,

  // Additional information
  additionalComments: String,
  followUpRequired: {
    type: Boolean,
    default: false
  },

  // Attachments
  attachments: [{
    name: String,
    url: String,
    publicId: String,
    size: Number,
    mimetype: String
  }],

  // Approval Chain (similar to purchase requisitions)
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
      'pending_hr_review',
      'under_investigation',
      'investigation_complete',
      'resolved',
      'rejected'
    ],
    default: 'pending_supervisor'
  },

  // Supervisor Review
  supervisorReview: {
    decision: {
      type: String,
      enum: ['approved', 'rejected', 'escalated']
    },
    comments: String,
    actionsTaken: String,
    decisionDate: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    followUpRequired: Boolean,
    followUpDate: Date,
    escalationReason: String
  },

  // HR Review
  hrReview: {
    assignedOfficer: String,
    investigationRequired: {
      type: Boolean,
      default: false
    },
    investigationAssignedTo: String,
    decision: {
      type: String,
      enum: ['resolved', 'escalated', 'requires_action']
    },
    comments: String,
    actionsTaken: String,
    decisionDate: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    corrective_actions: [String],
    preventive_actions: [String]
  },

  // Investigation Details (if required)
  investigation: {
    required: {
      type: Boolean,
      default: false
    },
    assignedTo: String,
    investigator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    startDate: Date,
    completionDate: Date,
    findings: String,
    recommendations: [String],
    status: {
      type: String,
      enum: ['not_required', 'assigned', 'in_progress', 'completed'],
      default: 'not_required'
    }
  },

  // Follow-up Actions
  followUpActions: [{
    action: String,
    assignedTo: String,
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    completedDate: Date,
    notes: String
  }],

  // Risk Assessment
  riskAssessment: {
    probability: {
      type: String,
      enum: ['very_low', 'low', 'medium', 'high', 'very_high']
    },
    consequence: {
      type: String,
      enum: ['insignificant', 'minor', 'moderate', 'major', 'catastrophic']
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'extreme']
    },
    controlMeasures: [String]
  },

  // Reporter information
  reportedBy: {
    employeeId: String,
    fullName: String,
    department: String,
    email: String,
    phone: String
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
IncidentReportSchema.index({ employee: 1, status: 1 });
IncidentReportSchema.index({ 'approvalChain.approver.email': 1, 'approvalChain.status': 1 });
IncidentReportSchema.index({ status: 1, createdAt: -1 });
IncidentReportSchema.index({ incidentType: 1 });
IncidentReportSchema.index({ severity: 1 });
IncidentReportSchema.index({ department: 1 });
IncidentReportSchema.index({ incidentDate: 1 });
IncidentReportSchema.index({ 'hrReview.assignedOfficer': 1 });

// Virtual for display ID
IncidentReportSchema.virtual('displayId').get(function() {
  return this.reportNumber || `INC-${this._id.toString().slice(-6).toUpperCase()}`;
});

// Method to get current approval step
IncidentReportSchema.methods.getCurrentApprovalStep = function() {
  if (!this.approvalChain || this.approvalChain.length === 0) return null;
  return this.approvalChain.find(step => step.status === 'pending');
};

// Method to get next approver
IncidentReportSchema.methods.getNextApprover = function() {
  const currentStep = this.getCurrentApprovalStep();
  return currentStep ? currentStep.approver : null;
};

// Method to check if user can approve request
IncidentReportSchema.methods.canUserApprove = function(userEmail) {
  const currentStep = this.getCurrentApprovalStep();
  return currentStep && currentStep.approver.email === userEmail;
};

// Method to get approval progress percentage
IncidentReportSchema.methods.getApprovalProgress = function() {
  if (!this.approvalChain || this.approvalChain.length === 0) return 0;
  const approvedSteps = this.approvalChain.filter(step => step.status === 'approved').length;
  return Math.round((approvedSteps / this.approvalChain.length) * 100);
};

// Method to get current stage description
IncidentReportSchema.methods.getCurrentStage = function() {
  const stageMap = {
    'pending_supervisor': 'Pending Supervisor Review',
    'pending_hr_review': 'Pending HR Review',
    'under_investigation': 'Under Investigation',
    'investigation_complete': 'Investigation Complete',
    'resolved': 'Resolved',
    'rejected': 'Rejected'
  };
  return stageMap[this.status] || 'Unknown Status';
};

// Method to check if incident requires investigation
IncidentReportSchema.methods.requiresInvestigation = function() {
  return this.severity === 'critical' || 
         this.severity === 'high' || 
         this.injuriesReported || 
         this.incidentType === 'security' ||
         this.incidentType === 'environmental';
};

// Method to calculate risk level
IncidentReportSchema.methods.calculateRiskLevel = function() {
  if (!this.riskAssessment?.probability || !this.riskAssessment?.consequence) {
    return 'medium';
  }

  const riskMatrix = {
    'very_low': { 'insignificant': 'low', 'minor': 'low', 'moderate': 'low', 'major': 'medium', 'catastrophic': 'medium' },
    'low': { 'insignificant': 'low', 'minor': 'low', 'moderate': 'medium', 'major': 'medium', 'catastrophic': 'high' },
    'medium': { 'insignificant': 'low', 'minor': 'medium', 'moderate': 'medium', 'major': 'high', 'catastrophic': 'high' },
    'high': { 'insignificant': 'medium', 'minor': 'medium', 'moderate': 'high', 'major': 'high', 'catastrophic': 'extreme' },
    'very_high': { 'insignificant': 'medium', 'minor': 'high', 'moderate': 'high', 'major': 'extreme', 'catastrophic': 'extreme' }
  };

  return riskMatrix[this.riskAssessment.probability]?.[this.riskAssessment.consequence] || 'medium';
};

// Pre-save middleware to update timestamps and generate report number
IncidentReportSchema.pre('save', async function(next) {
  try {
    console.log('Pre-save middleware executing for:', this._id);
    console.log('Current reportNumber:', this.reportNumber);
    
    // Update timestamp
    this.updatedAt = new Date();

    // Generate report number if not exists
    if (!this.reportNumber) {
      console.log('Generating new report number...');
      
      // Generate unique report number with retry logic
      let reportNumber;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        
        // Format: INC20241219-1430-1234
        reportNumber = `INC${year}${month}${day}-${hours}${minutes}-${random}`;
        
        console.log('Attempting report number:', reportNumber);
        
        // Check if this report number already exists
        const existingReport = await this.constructor.findOne({ 
          reportNumber: reportNumber,
          _id: { $ne: this._id } // Exclude current document if updating
        });
        
        if (!existingReport) {
          console.log('Unique report number generated:', reportNumber);
          this.reportNumber = reportNumber;
          break;
        }
        
        attempts++;
        console.log(`Report number ${reportNumber} already exists, retry ${attempts}/${maxAttempts}`);
        
        // Add small delay to avoid rapid-fire duplicates
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      if (attempts >= maxAttempts) {
        const error = new Error('Failed to generate unique report number after multiple attempts');
        console.error('Report number generation failed:', error.message);
        return next(error);
      }
      
      console.log('Final report number set:', this.reportNumber);
    }

    // Auto-calculate risk level if assessment exists
    if (this.riskAssessment?.probability && this.riskAssessment?.consequence) {
      this.riskAssessment.riskLevel = this.calculateRiskLevel();
      console.log('Risk level calculated:', this.riskAssessment.riskLevel);
    }

    console.log('Pre-save middleware completed successfully');
    next();
  } catch (error) {
    console.error('Pre-save middleware error:', error);
    next(error);
  }
});


// Pre-update middleware to update timestamps
IncidentReportSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

module.exports = mongoose.model('IncidentReport', IncidentReportSchema);



