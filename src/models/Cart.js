// models/Cart.js
const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1
    },
    price: { // Unit price (after discounts/wholesale logic)
      type: Number,
      required: true
    },
    // Cache these for display speed, but recalculate on updates
    taxAmount: { type: Number, default: 0 },
    shippingAmount: { type: Number, default: 0 },
    
    selectedSize: String,
    selectedColor: String
  }],
  // Summary Fields
  subtotal: { type: Number, default: 0 },     // Sum of price * qty
  totalShipping: { type: Number, default: 0 }, // Sum of all item shipping
  totalTax: { type: Number, default: 0 },      // Sum of all item tax
  totalAmount: { type: Number, default: 0 },   // Grand Total
  totalItems: { type: Number, default: 0 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Cart', cartSchema);