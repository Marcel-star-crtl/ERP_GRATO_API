const mongoose = require('mongoose');
const Tower = require('./Tower');

const generatorSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    match: /^GEN_[A-Z]{3}_\d{3}$/,
    uppercase: true,
    trim: true,
    unique: true,
    example: "GEN_ABJ_001"
  },
  tower_id: {
    type: String,
    ref: 'Tower',
    required: true,
    validate: {
      validator: async function(v) {
        const doc = await Tower.findOne({ _id: v });
        return doc !== null;
      },
      message: props => `Tower ${props.value} does not exist!`
    }
  },
  model: {
    type: String,
    required: true,
    enum: ['PowerMax 3000', 'EcoGen 2500', 'DieselPro 4000'],
    example: "PowerMax 3000"
  },
  specifications: {
    fuel_capacity: {
      type: Number,
      required: true,
      min: 50,
      max: 1000,
      description: "Fuel tank capacity in liters"
    },
    power_rating: {
      type: Number,
      required: true,
      min: 5,
      max: 100,
      description: "Rated power output in kW"
    },
    fuel_type: {
      type: String,
      required: true,
      enum: ['diesel', 'gasoline', 'hybrid'],
      default: 'diesel'
    }
  },
  current_stats: {
    fuel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
      description: "Current fuel level percentage"
    },
    power: {
      type: Number,
      min: 0,
      default: 0,
      description: "Current power output in kW"
    },
    temp: {
      type: Number,
      min: -20,
      max: 120,
      default: 25,
      description: "Current temperature in °C"
    },
    runtime: {
      type: Number,
      min: 0,
      default: 0,
      description: "Total runtime hours"
    }
  },
  status: {
    type: String,
    enum: ['running', 'standby', 'fault', 'maintenance'],
    default: 'standby'
  },
  installation_date: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v <= Date.now();
      },
      message: props => `Installation date cannot be in the future!`
    }
  },
  last_maintenance: Date,
  maintenance_history: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Maintenance'
  }],
  created_at: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
generatorSchema.index({ tower_id: 1 });
generatorSchema.index({ status: 1 });
generatorSchema.index({ model: 1 });
generatorSchema.index({ 'current_stats.fuel': 1 });

// Virtual for age in months
generatorSchema.virtual('age_months').get(function() {
  const diff = Date.now() - this.installation_date;
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
});

// Update timestamp on save
generatorSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  
  // Update tower's generator list if this is new
  if (this.isNew) {
    Tower.updateOne(
      { _id: this.tower_id },
      { $addToSet: { generators: this._id } }
    ).exec();
  }
  next();
});

// Update tower status based on generator status
generatorSchema.post('save', async function(doc) {
  try {
    const tower = await Tower.findById(doc.tower_id);
    if (!tower) return;

    // Use the model directly instead of this.model
    const generators = await mongoose.model('Generator').find({ tower_id: doc.tower_id });
    
    const activeCount = generators.filter(g => g.status === 'running').length;
    tower.status = activeCount > 0 ? 'active' : 'inactive';
    await tower.save();
  } catch (err) {
    console.error('Error updating tower status:', err);
  }
});

module.exports = mongoose.model('Generator', generatorSchema);