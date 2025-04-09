const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  generator_id: {
    type: String,
    ref: 'Generator',
    required: true
  },
  tower_id: {
    type: String,
    ref: 'Tower',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['routine', 'repair', 'inspection', 'emergency']
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  completed: {
    type: Boolean,
    default: false
  },
  technician: {
    type: String,
    required: true,
    trim: true
  },
  supervisor: {
    type: String,
    required: true,
    trim: true
  },
  // Updated to accept both formats
  parts_replaced: {
    type: [
      {
        type: mongoose.Schema.Types.Mixed,
        validate: {
          validator: function(v) {
            // Allow either string or object format
            return typeof v === 'string' || 
                  (v.name && typeof v.name === 'string');
          },
          message: props => `Invalid part format: ${props.value}`
        }
      }
    ],
    default: []
  },
  cost: {
    type: Number,
    min: 0
  },
  notes: {
    type: String,
    maxlength: 500
  },
  before_photos: [String],
  after_photos: [String],
  created_at: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes (unchanged)
maintenanceSchema.index({ generator_id: 1, date: -1 });
maintenanceSchema.index({ tower_id: 1 });
maintenanceSchema.index({ technician: 1 });
maintenanceSchema.index({ date: -1 });

// Pre-save hook to normalize parts_replaced
maintenanceSchema.pre('save', function(next) {
  if (this.parts_replaced) {
    this.parts_replaced = this.parts_replaced.map(part => {
      return typeof part === 'string' ? { name: part, quantity: 1 } : part;
    });
  }
  next();
});

// Update generator's last maintenance date
maintenanceSchema.post('save', async function(doc) {
  if (doc.completed) {
    await mongoose.model('Generator').updateOne(
      { _id: doc.generator_id },
      { 
        last_maintenance: doc.date,
        $addToSet: { maintenance_history: doc._id }
      }
    );
  }
});

module.exports = mongoose.model('Maintenance', maintenanceSchema);