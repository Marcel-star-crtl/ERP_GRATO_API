const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const leaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Leave Classification
  leaveCategory: {
    type: String,
    enum: [
      'medical',        
      'vacation',       
      'personal',       
      'emergency',      
      'family',         
      'bereavement',    
      'study',          
      'maternity',      
      'paternity',      
      'compensatory',   
      'sabbatical',    
      'unpaid'          
    ],
    required: true
  },

  leaveType: {
    type: String,
    enum: [
      // Medical leaves
      'sick_leave',
      'medical_appointment', 
      'emergency_medical',
      'mental_health',
      'medical_procedure',
      'recovery_leave',
      'chronic_condition',
      
      // Vacation/Personal leaves
      'annual_leave',
      'personal_time_off',
      'floating_holiday',
      'birthday_leave',
      'wellness_day',
      
      // Family leaves
      'maternity_leave',
      'paternity_leave',
      'adoption_leave',
      'family_care',
      'child_sick_care',
      'elder_care',
      'parental_leave',
      
      // Emergency/Bereavement
      'emergency_leave',
      'bereavement_leave',
      'funeral_leave',
      'disaster_leave',
      
      // Study/Development
      'study_leave',
      'training_leave',
      'conference_leave',
      'examination_leave',
      
      // Special leaves
      // 'sabbatical_leave',
      // 'compensatory_time',
      // 'jury_duty',
      // 'military_leave',
      // 'volunteer_leave',
      // 'unpaid_personal_leave',
      
      // Other
      'other'
    ],
    required: true
  },

  // Leave Details
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalDays: {
    type: Number,
    required: true,
    min: 0.5
  },
  isPartialDay: {
    type: Boolean,
    default: false
  },
  partialStartTime: String,
  partialEndTime: String,

  // Priority and Urgency
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  priority: {
    type: String,
    enum: ['routine', 'important', 'urgent', 'critical'],
    default: 'routine'
  },

  // Leave Details
  reason: {
    type: String,
    required: true,
    minlength: 10
  },
  description: {
    type: String,
    maxlength: 1000
  },

  // Medical Information (for medical leaves)
  medicalInfo: {
    symptoms: String,
    doctorDetails: {
      name: String,
      hospital: String,
      contactNumber: String,
      address: String
    },
    treatmentReceived: String,
    diagnosisCode: String,
    expectedRecoveryDate: Date,
    isRecurring: {
      type: Boolean,
      default: false
    },
    medicalCertificate: {
      provided: {
        type: Boolean,
        default: false
      },
      fileName: String,
      url: String,
      publicId: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected', 'not_required'],
        default: 'pending'
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verificationDate: Date,
      uploadedAt: Date
    }
  },

  // Supporting Documents
  supportingDocuments: [{
    name: String,
    url: String,
    publicId: String,
    size: Number,
    mimetype: String,
    uploadedAt: Date,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    }
  }],

  // Emergency Contact
  emergencyContact: {
    name: String,
    phone: String,
    relationship: {
      type: String,
      enum: ['spouse', 'parent', 'sibling', 'child', 'friend', 'other']
    },
    address: String
  },

  // Work Coverage
  workCoverage: String,
  delegatedTo: [{
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    responsibilities: String,
    contactInfo: String
  }],
  returnToWorkPlan: String,
  additionalNotes: String,

  // Leave Status
  status: {
    type: String,
    enum: [
      'draft',
      'pending_supervisor',
      'pending_hr', 
      'pending_admin',
      'approved',
      'rejected',
      'cancelled',
      'completed',
      'in_progress',
      'extended',
      'partially_approved'
    ],
    default: 'draft'
  },

  // Approval Workflow
  approvalChain: [{
    level: Number,
    approver: {
      name: String,
      email: String,
      role: String,
      department: String,
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    status: {
      type: String,
      enum: ['pending', 'approve', 'reject', 'escalate', 'delegate'],
      default: 'pending'
    },
    decision: String,
    comments: String,
    assignedDate: Date,
    actionDate: Date,
    actionTime: String,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    delegatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Decision Records
  supervisorDecision: {
    decision: {
      type: String,
      enum: ['approve', 'reject', 'escalate', 'request_info']
    },
    comments: String,
    decisionDate: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    conditions: String
  },

  hrReview: {
    decision: {
      type: String,
      enum: ['approve', 'reject', 'conditional_approve', 'request_info']
    },
    comments: String,
    conditions: String,
    medicalCertificateRequired: {
      type: Boolean,
      default: false
    },
    extendedLeaveGranted: {
      type: Boolean,
      default: false
    },
    returnToWorkCertificateRequired: {
      type: Boolean,
      default: false
    },
    decisionDate: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewNotes: String
  },

  // Leave Balance Impact
  leaveBalance: {
    previousBalance: Number,
    daysDeducted: Number,
    remainingBalance: Number,
    balanceType: {
      type: String,
      enum: ['annual', 'sick', 'personal', 'emergency', 'unpaid'],
      default: 'annual'
    },
    balanceYear: Number,
    carryOverDays: Number
  },

  // Tracking Information
  submittedBy: String,
  submittedAt: Date,
  lastModified: Date,
  modificationHistory: [{
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modificationDate: Date,
    changes: String,
    reason: String
  }],

  // System Information
  leaveNumber: {
    type: String,
    unique: true
  },
  fiscalYear: Number,
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: String,
  parentLeaveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Leave'
  },

  // Integration fields
  payrollImpact: {
    isPaid: {
      type: Boolean,
      default: true
    },
    payrollCode: String,
    deductionAmount: Number,
    benefitsImpact: String
  },

  // Compliance and Policy
  policyCompliance: {
    meetsRequirements: {
      type: Boolean,
      default: true
    },
    exemptions: [String],
    policyVersion: String,
    complianceNotes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
leaveSchema.index({ employee: 1, createdAt: -1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ leaveCategory: 1, leaveType: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });
leaveSchema.index({ 'approvalChain.approver.email': 1 });
leaveSchema.index({ fiscalYear: 1 });
leaveSchema.index({ leaveNumber: 1 });

// Virtual for display ID
leaveSchema.virtual('displayId').get(function() {
  const categoryCode = {
    'medical': 'MED',
    'vacation': 'VAC', 
    'personal': 'PTO',
    'emergency': 'EMG',
    'family': 'FAM',
    'bereavement': 'BER',
    'study': 'STU',
    'maternity': 'MAT',
    'paternity': 'PAT',
    'compensatory': 'CMP',
    'sabbatical': 'SAB',
    'unpaid': 'UNP'
  };
  
  const code = categoryCode[this.leaveCategory] || 'LEA';
  return `${code}-${this._id.toString().slice(-6).toUpperCase()}`;
});

// Virtual for leave duration in business days
leaveSchema.virtual('businessDays').get(function() {
  // Simple calculation - could be enhanced with holiday calendar
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  let businessDays = 0;
  
  while (start <= end) {
    const dayOfWeek = start.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
      businessDays++;
    }
    start.setDate(start.getDate() + 1);
  }
  
  return this.isPartialDay ? 0.5 : businessDays;
});

// Method to get leave type display name
leaveSchema.methods.getLeaveTypeDisplay = function() {
  const typeDisplayNames = {
    // Medical
    'sick_leave': 'Sick Leave',
    'medical_appointment': 'Medical Appointment',
    'emergency_medical': 'Emergency Medical Leave',
    'mental_health': 'Mental Health Leave',
    'medical_procedure': 'Medical Procedure',
    'recovery_leave': 'Recovery Leave',
    'chronic_condition': 'Chronic Condition Management',
    
    // Vacation/Personal
    'annual_leave': 'Annual Leave',
    'personal_time_off': 'Personal Time Off',
    'floating_holiday': 'Floating Holiday',
    'birthday_leave': 'Birthday Leave',
    'wellness_day': 'Wellness Day',
    
    // Family
    'maternity_leave': 'Maternity Leave',
    'paternity_leave': 'Paternity Leave',
    'adoption_leave': 'Adoption Leave',
    'family_care': 'Family Care Leave',
    'child_sick_care': 'Child Sick Care',
    'elder_care': 'Elder Care Leave',
    'parental_leave': 'Parental Leave',
    
    // Emergency/Bereavement
    'emergency_leave': 'Emergency Leave',
    'bereavement_leave': 'Bereavement Leave',
    'funeral_leave': 'Funeral Leave',
    'disaster_leave': 'Disaster Leave',
    
    // Study/Development
    'study_leave': 'Study Leave',
    'training_leave': 'Training Leave',
    'conference_leave': 'Conference Leave',
    'examination_leave': 'Examination Leave',
    
    // Special
    'sabbatical_leave': 'Sabbatical Leave',
    'compensatory_time': 'Compensatory Time',
    'jury_duty': 'Jury Duty',
    'military_leave': 'Military Leave',
    'volunteer_leave': 'Volunteer Leave',
    'unpaid_personal_leave': 'Unpaid Personal Leave'
  };
  
  return typeDisplayNames[this.leaveType] || this.leaveType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Method to get leave category display name
leaveSchema.methods.getLeavenByCategoryDisplay = function() {
  const categoryDisplayNames = {
    'medical': 'Medical Leave',
    'vacation': 'Vacation Leave',
    'personal': 'Personal Leave',
    'emergency': 'Emergency Leave',
    'family': 'Family Leave',
    'bereavement': 'Bereavement Leave',
    'study': 'Study Leave',
    'maternity': 'Maternity Leave',
    'paternity': 'Paternity Leave',
    'compensatory': 'Compensatory Time',
    'sabbatical': 'Sabbatical Leave',
    'unpaid': 'Unpaid Leave'
  };
  
  return categoryDisplayNames[this.leaveCategory] || this.leaveCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Static method to calculate all leave balances for an employee
leaveSchema.statics.calculateAllLeaveBalances = async function(employeeId) {
  const leaveCategories = ['vacation', 'medical', 'personal', 'emergency', 'family', 'bereavement', 'study', 'maternity', 'paternity', 'compensatory', 'sabbatical', 'unpaid'];
  const balances = {};
  
  for (const category of leaveCategories) {
    balances[category] = await this.calculateLeaveBalance(employeeId, category);
  }
  
  return balances;
};

// Static method to calculate leave balance for different leave types
leaveSchema.statics.calculateLeaveBalance = async function(employeeId, leaveCategory = 'vacation') {
  const currentYear = new Date().getFullYear();
  
  // Default balances based on leave category
  const defaultBalances = {
    'vacation': 21,
    'medical': 10,
    'personal': 5,
    'emergency': 3,
    'family': 12,
    'bereavement': 5,
    'study': 10
  };

  const totalDays = defaultBalances[leaveCategory] || 21;

  const usedLeaves = await this.find({
    employee: employeeId,
    leaveCategory: leaveCategory,
    status: { $in: ['approved', 'completed'] },
    fiscalYear: currentYear
  });

  const pendingLeaves = await this.find({
    employee: employeeId,
    leaveCategory: leaveCategory,
    status: { $in: ['pending_supervisor', 'pending_hr', 'pending_admin'] },
    fiscalYear: currentYear
  });

  const usedDays = usedLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);
  const pendingDays = pendingLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);

  return {
    category: leaveCategory,
    totalDays,
    usedDays,
    pendingDays,
    remainingDays: totalDays - usedDays - pendingDays,
    fiscalYear: currentYear
  };
};

// Add pagination plugin
leaveSchema.plugin(mongoosePaginate);

// Pre-save middleware to generate leave number
leaveSchema.pre('save', async function(next) {
  if (this.isNew) {
    const currentYear = new Date().getFullYear();
    const categoryCode = {
      'medical': 'MED',
      'vacation': 'VAC',
      'personal': 'PTO',
      'emergency': 'EMG',
      'family': 'FAM',
      'bereavement': 'BER',
      'study': 'STU',
      'maternity': 'MAT',
      'paternity': 'PAT',
      'compensatory': 'CMP',
      'sabbatical': 'SAB',
      'unpaid': 'UNP'
    };
    
    const code = categoryCode[this.leaveCategory] || 'LEA';
    const count = await this.constructor.countDocuments({
      leaveCategory: this.leaveCategory,
      fiscalYear: currentYear
    });
    
    this.leaveNumber = `${code}${currentYear}${String(count + 1).padStart(4, '0')}`;
    this.fiscalYear = currentYear;
  }
  
  this.lastModified = new Date();
  next();
});

module.exports = mongoose.model('Leave', leaveSchema);



