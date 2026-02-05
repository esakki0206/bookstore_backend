const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendPaymentConfirmed, sendAdminNotification } = require('../utils/emailService');

// Initialize Razorpay
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} else {
  console.warn("WARNING: Razorpay keys are missing in environment variables.");
}

// @desc    Create Razorpay Order (Secure)
// @route   POST /api/payments/create-order
// @access  Private
exports.createRazorpayOrder = asyncHandler(async (req, res) => {
  if (!razorpay) throw new AppError(500, 'Payment gateway not configured');

  const { orderId } = req.body;
  if (!orderId) throw new AppError(400, 'Order ID is required');

  // 1. Fetch Order from DB to ensure amount is correct (Security)
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Order not found');

  // 2. Create Razorpay Order
  const options = {
    amount: Math.round(order.totalAmount * 100), // Amount in smallest currency unit (paise)
    currency: 'INR',
    receipt: `receipt_${order.orderNumber}`,
    payment_capture: 1 // Auto capture
  };

  try {
    const response = await razorpay.orders.create(options);
    
    res.json({
      success: true,
      id: response.id,
      currency: response.currency,
      amount: response.amount,
      key: process.env.RAZORPAY_KEY_ID // Send key to frontend safely
    });
  } catch (error) {
    console.error("Razorpay Error:", error);
    throw new AppError(502, 'Failed to create payment order with gateway');
  }
});

// @desc    Verify Razorpay Payment
// @route   POST /api/payments/verify
// @access  Private
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature, 
    orderId 
  } = req.body;

  // 1. Basic Validation
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
    throw new AppError(400, 'Missing payment verification details');
  }

  const order = await Order.findById(orderId).populate('user', 'name email');
  if (!order) throw new AppError(404, 'Order not found');

  // 2. Verify Signature (HMAC SHA256)
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  
  // DEBUG LOGGING (Remove in Production)
  console.log("--- Payment Verification Debug ---");
  console.log("Received Order ID:", razorpay_order_id);
  console.log("Received Payment ID:", razorpay_payment_id);
  console.log("Using Secret Key (Last 4 chars):", process.env.RAZORPAY_KEY_SECRET ? process.env.RAZORPAY_KEY_SECRET.slice(-4) : "MISSING");
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  console.log("Expected Signature:", expectedSignature);
  console.log("Received Signature:", razorpay_signature);
  console.log("Match:", expectedSignature === razorpay_signature);
  console.log("----------------------------------");

  const isAuthentic = expectedSignature === razorpay_signature;

  if (isAuthentic) {
    // 3. Save Payment Record
    // Check if payment already exists to prevent duplicates
    let payment = await Payment.findOne({ transactionId: razorpay_payment_id });
    
    if (!payment) {
      payment = await Payment.create({
        order: order._id,
        user: req.user._id,
        amount: order.totalAmount,
        paymentMethod: 'razorpay',
        paymentStatus: 'completed',
        razorpayDetails: {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature
        },
        transactionId: razorpay_payment_id
      });
    }

    // 4. Update Order Status
    order.paymentStatus = 'completed'; 
    order.status = 'processing'; 
    order.paymentDetails = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      transactionId: razorpay_payment_id,
      paymentDate: new Date() // Add date
    };
    
    await order.save();

    // 5. Send Confirmation Emails (Silent Fail)
    try {
      if (!order.emailNotifications?.confirmationSent) {
        await sendPaymentConfirmed(order);
      }
    } catch (emailErr) {
      console.error("Email Error:", emailErr);
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: payment._id
    });
  } else {
    // Log failure
    await Payment.create({
      order: order._id,
      user: req.user._id,
      amount: order.totalAmount,
      paymentMethod: 'razorpay',
      paymentStatus: 'failed',
      failureReason: 'Invalid Signature',
      razorpayDetails: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      }
    });

    throw new AppError(400, 'Payment verification failed: Invalid Signature');
  }
});
// @desc    Initiate Cash on Delivery
// @route   POST /api/payments/cod
// @access  Private
exports.initiateCoD = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw new AppError(400, 'Order ID is required');

  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Order not found');

  // Just record the intent, actual payment happens on delivery
  await Payment.create({
    order: orderId,
    user: req.user._id,
    amount: order.totalAmount,
    paymentMethod: 'cod',
    paymentStatus: 'pending'
  });

  // Ensure order is confirmed
  order.status = 'confirmed';
  await order.save();

  res.json({ success: true, message: 'Order Confirmed' });
});

exports.getPaymentStatus = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ order: req.params.orderId });
  res.json({ success: true, payment });
});