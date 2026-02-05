const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // --- CORE DETAILS (Works for both Sarees & Books) ---
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    index: true
  },
  
  // --- BOOK-SPECIFIC FIELDS ---
  author: {
    type: String,
    trim: true,
    index: true
  },
  isbn: {
    type: String,
    trim: true,
    sparse: true // Allows null/undefined for non-book products
  },
  publisher: {
    type: String,
    trim: true
  },
  language: {
    type: String,
    default: 'English'
  },
  pages: {
    type: Number,
    min: 0
  },
  formats: {
    type: [String], // e.g., ['Hardcover', 'Paperback', 'E-book']
    default: []
  },

  // --- SAREE-SPECIFIC FIELDS ---
  fabric: String,
  pattern: String,
  occasion: String,
  
  // --- COMMON FIELDS ---
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  
  images: [{
    url: { type: String, required: true },
    publicId: { type: String, required: true }
  }],
  
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  
  stock: {
    type: Number,
    required: [true, 'Stock is required'],
    min: 0,
    default: 0
  },
  
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    index: true
    // Removed enum restriction to allow any custom category
  },
  
  // --- PRICING & DISCOUNTS ---
  discountPercentage: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 100 
  },
  discountStartDate: Date,
  discountEndDate: Date,
  
  // --- WHOLESALE/RETAIL PRICING ---
  wholesalePrice: {
    type: Number,
    default: 0
  },
  
  retail: {
    shippingCost: { type: Number, default: 0 },
    taxPercentage: { type: Number, default: 0 }
  },
  
  wholesale: {
    shippingCost: { type: Number, default: 0 },
    taxPercentage: { type: Number, default: 0 }
  },
  
  // --- VARIANTS (For Sarees: colors/sizes) ---
  variants: [{
    colorName: String,
    colorCode: String,
    size: String,
    stock: { type: Number, default: 0 },
    images: [String]
  }],
  
  // --- METADATA ---
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  
  featured: {
    type: Boolean,
    default: false
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  tags: [String],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// --- INDEXES ---
productSchema.index({ name: 'text', author: 'text', isbn: 'text', description: 'text' });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ featured: 1, stock: 1 });

// --- VIRTUALS ---

// Check if discount is currently active
productSchema.virtual('isDiscountActive').get(function() {
  if (this.discountPercentage <= 0) return false;
  const now = new Date();
  if (this.discountStartDate && now < this.discountStartDate) return false;
  if (this.discountEndDate && now > this.discountEndDate) return false;
  return true;
});

// Calculate final price after discount
productSchema.virtual('finalPrice').get(function() {
  if (this.isDiscountActive) {
    return Math.round(this.price * (1 - this.discountPercentage / 100) * 100) / 100;
  }
  return this.price;
});

// --- METHODS ---

// Get current price based on user role
productSchema.methods.getCurrentPrice = function(userRole = 'user') {
  if (userRole === 'reseller') {
    return this.wholesalePrice > 0 ? this.wholesalePrice : this.price;
  }
  return this.finalPrice;
};

// Get shipping cost based on user role
productSchema.methods.getShippingCost = function(userRole = 'user') {
  if (userRole === 'reseller') {
    return this.wholesale?.shippingCost || 0;
  }
  return this.retail?.shippingCost || 0;
};

// Get tax percentage based on user role
productSchema.methods.getTaxPercentage = function(userRole = 'user') {
  if (userRole === 'reseller') {
    return this.wholesale?.taxPercentage || 0;
  }
  return this.retail?.taxPercentage || 0;
};

module.exports = mongoose.model('Product', productSchema);