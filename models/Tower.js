// const mongoose = require('mongoose');
// const Generator = require('./Generator');

// const towerSchema = new mongoose.Schema({
//   _id: {
//     type: String,
//     required: true,
//     match: /^TOWER_[A-Z]{3}_\d{3}$/,
//     uppercase: true,
//     trim: true,
//     unique: true,
//     example: "TOWER_ABJ_001"
//   },
//   name: {
//     type: String,
//     required: true,
//     minlength: 3,
//     maxlength: 100,
//     trim: true
//   },
//   // location: {
//   //   address: {
//   //     type: String,
//   //     required: true,
//   //     trim: true
//   //   },
//   //   gps: {
//   //     type: {
//   //       type: String,
//   //       default: 'Point',
//   //       enum: ['Point']
//   //     },
//   //     coordinates: {
//   //       type: [Number],
//   //       required: true,
//   //       validate: {
//   //         validator: function(v) {
//   //           return v.length === 2 && 
//   //                  v[0] >= -180 && v[0] <= 180 && 
//   //                  v[1] >= -90 && v[1] <= 90;
//   //         },
//   //         message: props => `${props.value} is not a valid GPS coordinate!`
//   //       }
//   //     }
//   //   }
//   // },
//   location: {
//     type: String,  
//     required: true,
//     trim: true
//   },
//   generators: [{
//     type: String,
//     ref: 'Generator',
//     validate: {
//       validator: async function(v) {
//         const doc = await Generator.findOne({ _id: v });
//         return doc !== null;
//       },
//       message: props => `Generator ${props.value} does not exist!`
//     }
//   }],
//   status: {
//     type: String,
//     enum: ['active', 'inactive', 'maintenance'],
//     default: 'inactive'
//   },
//   created_at: {
//     type: Date,
//     default: Date.now,
//     immutable: true
//   },
//   updated_at: {
//     type: Date,
//     default: Date.now
//   }
// }, {
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes
// // towerSchema.index({ location: '2dsphere' });
// towerSchema.index({ name: 'text' });
// towerSchema.index({ status: 1 });

// // Virtual for generator count
// towerSchema.virtual('generator_count').get(function() {
//   return this.generators.length;
// });

// // Update timestamp on save
// towerSchema.pre('save', function(next) {
//   this.updated_at = Date.now();
//   next();
// });

// // Cascade delete generators when tower is removed
// towerSchema.pre('remove', async function(next) {
//   await Generator.deleteMany({ tower_id: this._id });
//   next();
// });

// module.exports = mongoose.model('Tower', towerSchema);




const mongoose = require('mongoose');

const towerSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    match: /^TOWER_[A-Z]{3}_\d{3}$/,
    uppercase: true,
    trim: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 100,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 200
  },
  generators: [{
    type: String,
    ref: 'Generator'
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'inactive'
  },
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

// Remove any spatial indexes
towerSchema.index({ name: 'text' });
towerSchema.index({ status: 1 });

// Virtual for generator count
towerSchema.virtual('generator_count').get(function() {
  return this.generators.length;
});

// Update timestamp on save
towerSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Tower', towerSchema);