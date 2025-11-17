const mongoose = require('mongoose');

const QuarterlyKPISchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quarter: {
    type: String,
    required: true,
    match: /^Q[1-4]-\d{4}$/
  },
  year: {
    type: Number,
    required: true
  },
  kpis: [{
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    weight: {
      type: Number,
      required: true,
      min: 1,
      max: 100
    },
    targetValue: {
      type: String,
      required: true,
      trim: true
    },
    measurableOutcome: {
      type: String,
      required: true,
      trim: true
    },
    // NEW: Track achievement progress
    achievement: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String
  }],
  totalWeight: {
    type: Number,
    required: true,
    default: 0
  },
  approvalStatus: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft'
  },
  submittedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  supervisor: {
    name: String,
    email: String,
    department: String
  }
}, {
  timestamps: true
});

// Indexes
QuarterlyKPISchema.index({ employee: 1, quarter: 1 }, { unique: true });
QuarterlyKPISchema.index({ approvalStatus: 1 });
QuarterlyKPISchema.index({ 'supervisor.email': 1 });

// Virtual for overall achievement
QuarterlyKPISchema.virtual('overallAchievement').get(function() {
  if (!this.kpis || this.kpis.length === 0) return 0;

  const totalWeight = this.kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedAchievement = this.kpis.reduce((sum, kpi) => {
    return sum + ((kpi.achievement || 0) * kpi.weight / 100);
  }, 0);

  return Math.round(weightedAchievement);
});

// Calculate total weight before saving
QuarterlyKPISchema.pre('save', function(next) {
  this.totalWeight = this.kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
  next();
});

// Methods
QuarterlyKPISchema.methods.submitForApproval = function() {
  if (this.totalWeight !== 100) {
    throw new Error('Total KPI weight must equal 100%');
  }
  if (this.kpis.length < 3) {
    throw new Error('Minimum 3 KPIs required');
  }
  this.approvalStatus = 'pending';
  this.submittedAt = new Date();
  this.kpis.forEach(kpi => {
    if (kpi.status === 'pending') {
      kpi.status = 'pending';
    }
  });
};

QuarterlyKPISchema.methods.approve = function(userId) {
  this.approvalStatus = 'approved';
  this.approvedBy = userId;
  this.approvedAt = new Date();
  this.kpis.forEach(kpi => {
    if (kpi.status === 'pending') {
      kpi.status = 'approved';
      kpi.approvedBy = userId;
      kpi.approvedAt = new Date();
    }
  });
};

QuarterlyKPISchema.methods.reject = function(userId, reason) {
  this.approvalStatus = 'rejected';
  this.approvedBy = userId;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
};

module.exports = mongoose.model('QuarterlyKPI', QuarterlyKPISchema);



