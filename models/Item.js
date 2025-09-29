const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'IT Accessories',
      'Office Supplies',
      'Equipment',
      'Consumables',
      'Software',
      'Hardware',
      'Furniture',
      'Safety Equipment',
      'Maintenance Supplies',
      'Other'
    ]
  },
  subcategory: {
    type: String,
    trim: true
  },
  unitOfMeasure: {
    type: String,
    required: true,
    enum: ['Pieces', 'Sets', 'Boxes', 'Packs', 'Units', 'Kg', 'Litres', 'Meters', 'Pairs', 'Each']
  },
  standardPrice: {
    type: Number,
    min: 0
  },
  supplier: String,
  specifications: String,
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ItemRequest'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
ItemSchema.index({ code: 1 });
ItemSchema.index({ category: 1, isActive: 1 });
ItemSchema.index({ description: 'text', specifications: 'text' });
ItemSchema.index({ isActive: 1 });

// Virtual for display ID
ItemSchema.virtual('displayCode').get(function() {
  return this.code || `ITM-${this._id.toString().slice(-6).toUpperCase()}`;
});

module.exports = mongoose.model('Item', ItemSchema);





