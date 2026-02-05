const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  // 'all' for global, 'specific' for selected products
  scope: {
    type: String,
    enum: ['all', 'specific'],
    default: 'all'
  },
  // Only used if scope is 'specific'
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  minOrderValue: {
    type: Number,
    default: 0
  },
  expirationDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageLimit: {
    type: Number, // Total times this coupon can be used
    default: null
  },
  usedCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Middleware to check if expired
couponSchema.methods.isValid = function() {
  return this.isActive && this.expirationDate > new Date();
};

module.exports = mongoose.model('Coupon', couponSchema);