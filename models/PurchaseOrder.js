const mongoose = require('mongoose');

const PurchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    unique: true,
    required: true
  },
  requisitionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseRequisition'
  },

  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier', 
    required: false // Allow null for external suppliers
  },

  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'XAF'
  },

  status: {
    type: String,
    enum: [
      'draft',
      'pending_approval',
      'approved',
      'sent_to_supplier',
      'acknowledged',
      'in_production',
      'ready_for_shipment',
      'in_transit',
      'delivered',
      'completed',
      'cancelled',
      'on_hold'
    ],
    default: 'draft'
  },

  // Timeline
  creationDate: {
    type: Date,
    default: Date.now
  },
  approvalDate: Date,
  sentDate: Date,
  acknowledgedDate: Date,
  expectedDeliveryDate: {
    type: Date,
    required: true
  },
  actualDeliveryDate: Date,

  // Terms and Conditions
  paymentTerms: {
    type: String,
    required: true,
    enum: ['15 days', '30 days', '45 days', '60 days', 'Cash on delivery', 'Advance payment']
  },
  deliveryTerms: String,
  deliveryAddress: {
    type: String,
    required: true
  },

  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: false
    },

    itemCode: String,

    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },

    // Optional item details
    specifications: String,
    partNumber: String,
    category: String,
    unitOfMeasure: String,

    isFromDatabase: {
      type: Boolean,
      default: false
    }
  }],

  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  currentStage: {
    type: String,
    enum: [
      'created',
      'supplier_acknowledgment',
      'in_production',
      'in_transit',
      'completed'
    ],
    default: 'created'
  },

  // Activities Log
  activities: [{
    type: {
      type: String,
      enum: ['created', 'sent', 'acknowledged', 'updated', 'shipped', 'delivered', 'cancelled'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    user: String
  }],

  // Delivery Tracking
  deliveryTracking: {
    status: {
      type: String,
      enum: ['pending', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered'],
      default: 'pending'
    },
    trackingNumber: String,
    carrier: String,
    estimatedDelivery: Date,
    deliveredDate: Date,
    updates: [{
      status: String,
      description: String,
      location: String,
      timestamp: Date
    }]
  },

  // Approval Workflow
  approvalRequired: {
    type: Boolean,
    default: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalComments: String,

  // Additional Information
  notes: String,
  internalNotes: String,
  specialInstructions: String,
  termsAndConditions: String,

  // File attachments
  attachments: [{
    name: String,
    url: String,
    publicId: String,
    size: Number,
    mimetype: String
  }],

  // Quote reference (if created from quote)
  quoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    required: false 
  },

  // ENHANCED: Supplier details snapshot from Supplier model
  supplierDetails: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: String,
    address: String,
    businessType: String,
    registrationNumber: String,
    taxId: String,

    // Performance snapshot at time of PO creation
    performanceSnapshot: {
      overallRating: Number,
      totalOrders: Number,
      onTimeDeliveryRate: Number,
      lastOrderDate: Date
    }
  },

  // Performance Metrics
  performanceMetrics: {
    onTimeDelivery: Boolean,
    qualityRating: {
      type: Number,
      min: 1,
      max: 5
    },
    supplierRating: {
      type: Number,
      min: 1,
      max: 5
    },
    costVariance: Number,
    deliveryVariance: Number // in days
  },

  // Financial Information
  budgetAllocated: Number,
  actualCost: Number,
  costSavings: Number,

  // Integration metadata
  integrationData: {
    sourceSystem: {
      type: String,
      enum: ['manual', 'requisition', 'quote', 'catalog'],
      default: 'manual'
    },

    // Track which items came from database
    itemsFromDatabase: {
      type: Number,
      default: 0
    },
    manualItems: {
      type: Number,
      default: 0
    },

    // Validation flags
    supplierValidated: {
      type: Boolean,
      default: false
    },
    itemsValidated: {
      type: Boolean,
      default: false
    }
  },

  // Tax Information
  taxApplicable: {
    type: Boolean,
    default: false
  },
  taxRate: {
    type: Number,
    default: 19.25, // Default 19.25% to match template
    min: 0,
    max: 100
  },
  currency: {
    type: String,
    enum: ['FCFA', 'XAF', 'USD', 'EUR'],
    default: 'FCFA'
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedDate: {
    type: Date,
    default: Date.now
  },

  // Cancellation details
  cancellationReason: String,
  cancelledDate: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
PurchaseOrderSchema.index({ poNumber: 1 });
PurchaseOrderSchema.index({ requisitionId: 1 });
PurchaseOrderSchema.index({ supplierId: 1 }); // Updated for Supplier model
PurchaseOrderSchema.index({ buyerId: 1 });
PurchaseOrderSchema.index({ status: 1 });
PurchaseOrderSchema.index({ creationDate: -1 });
PurchaseOrderSchema.index({ expectedDeliveryDate: 1 });
PurchaseOrderSchema.index({ 'integrationData.sourceSystem': 1 });

// Compound indexes
PurchaseOrderSchema.index({ supplierId: 1, status: 1 });
PurchaseOrderSchema.index({ buyerId: 1, status: 1 });
PurchaseOrderSchema.index({ status: 1, expectedDeliveryDate: 1 });

// Virtual for display ID
PurchaseOrderSchema.virtual('displayId').get(function() {
  return this.poNumber || `PO-${this._id.toString().slice(-6).toUpperCase()}`;
});

// Virtual for items breakdown
PurchaseOrderSchema.virtual('itemsBreakdown').get(function() {
  const fromDatabase = this.items.filter(item => item.itemId).length;
  const manual = this.items.length - fromDatabase;

  return {
    total: this.items.length,
    fromDatabase,
    manual,
    databasePercentage: this.items.length > 0 ? Math.round((fromDatabase / this.items.length) * 100) : 0
  };
});

// Virtual for supplier performance at creation
PurchaseOrderSchema.virtual('supplierPerformanceAtCreation').get(function() {
  return this.supplierDetails.performanceSnapshot || null;
});

// Method to generate PO number
PurchaseOrderSchema.pre('save', async function(next) {
  // Only generate PO number if it's a new document and doesn't have one
  if (this.isNew && !this.poNumber) {
    try {
      const count = await this.constructor.countDocuments();
      const now = new Date();
      const year = now.getFullYear();
      this.poNumber = `PO-${year}-${String(count + 1).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }

  // Update integration metadata
  if (this.isNew || this.isModified('items')) {
    const itemsFromDb = this.items.filter(item => item.itemId).length;
    this.integrationData.itemsFromDatabase = itemsFromDb;
    this.integrationData.manualItems = this.items.length - itemsFromDb;
  }

  this.lastModifiedDate = new Date();
  next();
});

// Method to add activity
PurchaseOrderSchema.methods.addActivity = function(type, description, user) {
  this.activities.push({
    type,
    description,
    user: user || 'System',
    timestamp: new Date()
  });
  return this.save();
};

// Method to update status and progress
PurchaseOrderSchema.methods.updateStatus = function(newStatus, user) {
  const oldStatus = this.status;
  this.status = newStatus;

  // Update progress based on status
  const progressMap = {
    'draft': 5,
    'pending_approval': 10,
    'approved': 15,
    'sent_to_supplier': 25,
    'acknowledged': 35,
    'in_production': 50,
    'ready_for_shipment': 70,
    'in_transit': 85,
    'delivered': 95,
    'completed': 100,
    'cancelled': 0,
    'on_hold': this.progress
  };

  this.progress = progressMap[newStatus] || this.progress;

  // Update current stage
  const stageMap = {
    'draft': 'created',
    'pending_approval': 'created',
    'approved': 'created',
    'sent_to_supplier': 'supplier_acknowledgment',
    'acknowledged': 'supplier_acknowledgment',
    'in_production': 'in_production',
    'ready_for_shipment': 'in_production',
    'in_transit': 'in_transit',
    'delivered': 'completed',
    'completed': 'completed'
  };

  this.currentStage = stageMap[newStatus] || this.currentStage;

  // Add activity log
  this.addActivity('updated', `Status changed from ${oldStatus} to ${newStatus}`, user);

  return this;
};

// Method to populate supplier performance snapshot
PurchaseOrderSchema.methods.captureSupplierPerformance = async function() {
  try {
    const Supplier = require('./Supplier');
    const supplier = await Supplier.findById(this.supplierId);

    if (supplier && supplier.performance) {
      this.supplierDetails.performanceSnapshot = {
        overallRating: supplier.performance.overallRating,
        totalOrders: supplier.performance.totalOrders,
        onTimeDeliveryRate: supplier.onTimeDeliveryRate,
        lastOrderDate: supplier.performance.lastOrderDate
      };
    }

    return this.save();
  } catch (error) {
    console.error('Error capturing supplier performance:', error);
  }
};

// Method to validate items against database
PurchaseOrderSchema.methods.validateItems = async function() {
  try {
    const Item = require('./Item');
    let validationResults = {
      valid: true,
      errors: [],
      warnings: []
    };

    for (let item of this.items) {
      if (item.itemId) {
        const dbItem = await Item.findById(item.itemId);
        if (!dbItem) {
          validationResults.valid = false;
          validationResults.errors.push(`Item ${item.description}: Referenced database item not found`);
        } else if (!dbItem.isActive) {
          validationResults.valid = false;
          validationResults.errors.push(`Item ${item.description}: Referenced database item is inactive`);
        } else {
          // Mark as validated and from database
          item.isFromDatabase = true;
          item.itemCode = dbItem.code;
          if (!item.category) item.category = dbItem.category;
          if (!item.unitOfMeasure) item.unitOfMeasure = dbItem.unitOfMeasure;
        }
      }
    }

    this.integrationData.itemsValidated = validationResults.valid;
    return validationResults;
  } catch (error) {
    console.error('Error validating items:', error);
    return {
      valid: false,
      errors: ['Error validating items against database'],
      warnings: []
    };
  }
};

// Method to calculate delivery performance
PurchaseOrderSchema.methods.calculateDeliveryPerformance = function() {
  if (this.actualDeliveryDate && this.expectedDeliveryDate) {
    const expected = new Date(this.expectedDeliveryDate);
    const actual = new Date(this.actualDeliveryDate);
    const diffTime = actual - expected;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    this.performanceMetrics = this.performanceMetrics || {};
    this.performanceMetrics.onTimeDelivery = diffDays <= 0;
    this.performanceMetrics.deliveryVariance = diffDays;

    return {
      onTime: diffDays <= 0,
      variance: diffDays,
      status: diffDays <= 0 ? 'On Time' : `${diffDays} days late`
    };
  }
  return null;
};

// Static method to get purchase orders by buyer with supplier population
PurchaseOrderSchema.statics.getByBuyer = function(buyerId, options = {}) {
  const query = { buyerId };

  if (options.status) {
    query.status = options.status;
  }

  if (options.supplierId) {
    query.supplierId = options.supplierId;
  }

  return this.find(query)
    .populate('requisitionId', 'title department employee')
    .populate('supplierId', 'name email phone address performance') // Updated to populate Supplier
    .populate('buyerId', 'fullName email')
    .populate('items.itemId', 'code description category unitOfMeasure') // Populate item details
    .sort({ creationDate: -1 });
};

// Static method to get dashboard stats with supplier integration
PurchaseOrderSchema.statics.getBuyerStats = async function(buyerId) {
  const stats = await this.aggregate([
    { $match: { buyerId: mongoose.Types.ObjectId(buyerId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalValue: { $sum: '$totalAmount' },
        active: {
          $sum: {
            $cond: [
              { $in: ['$status', ['approved', 'sent_to_supplier', 'acknowledged', 'in_production', 'in_transit']] },
              1,
              0
            ]
          }
        },
        completed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        },
        cancelled: {
          $sum: {
            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
          }
        },
        avgDeliveryTime: { $avg: '$performanceMetrics.deliveryVariance' },
        onTimeDeliveries: {
          $sum: {
            $cond: [{ $eq: ['$performanceMetrics.onTimeDelivery', true] }, 1, 0]
          }
        },
        // Integration stats
        totalItemsFromDatabase: { $sum: '$integrationData.itemsFromDatabase' },
        totalManualItems: { $sum: '$integrationData.manualItems' }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    totalValue: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    avgDeliveryTime: 0,
    onTimeDeliveries: 0,
    totalItemsFromDatabase: 0,
    totalManualItems: 0
  };
};

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);


