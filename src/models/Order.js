const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String,
    required: true
  },
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: String,
    image: String,
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    selectedSize: String,
    selectedColor: String
  }],
  shippingAddress: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay'], // ❌ COD Removed
    required: true,
    default: 'razorpay'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  // ✅ Detailed Transaction Log
  paymentDetails: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    transactionId: String,
    paymentDate: Date,
    gatewayName: { type: String, default: 'Razorpay' }
  },
  subtotal: { type: Number, required: true },
  discountApplied: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  couponDiscount: { type: Number, default: 0 },
  couponDetails: {
    code: String,
    discountAmount: Number,
    percentage: Number
  },
  shippingCost: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  trackingDetails: {
    courierName: String,
    trackingId: String,
    shippedDate: Date
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String
  }],
  emailNotifications: {
    confirmationSent: { type: Boolean, default: false },
    shippedSent: { type: Boolean, default: false },
    deliveredSent: { type: Boolean, default: false },
    confirmationSentAt: Date,
    shippedSentAt: Date,
    deliveredSentAt: Date
  },
  deliveredAt: Date
}, {
  timestamps: true
});

orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.orderNumber = `SR${timestamp}${random}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);