const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendOrderConfirmation, sendOrderShipped, sendOrderDelivered, sendAdminNotification } = require('../utils/emailService');

const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SR${timestamp}${random}`;
};

// @desc    Create new order
// @route   POST /api/orders/create
// @access  Private
exports.createOrder = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const { items, shippingAddress, paymentMethod, couponCode } = req.body;
  const userRole = req.user.role;

  // ✅ STRICT VALIDATION: Block COD
  if (paymentMethod === 'cod') {
    throw new AppError(400, 'Cash on Delivery is currently unavailable. Please use online payment.');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'Order items are required');
  }

  const orderItems = [];
  let subtotal = 0;
  let totalShipping = 0;

  // 1. Process Items (Calculate Costs & Deduct Stock) - No Tax
  for (const item of items) {
    const product = await Product.findById(item.product);
    
    if (!product) throw new AppError(404, `Product not found: ${item.product}`);
    if (product.stock < item.quantity) throw new AppError(400, `Insufficient stock for ${product.name}`);

    // Determine Price
    const unitPrice = typeof product.getCurrentPrice === 'function' 
      ? product.getCurrentPrice(userRole) 
      : product.price;
      
    const lineTotal = unitPrice * item.quantity;

    // Determine Shipping (No Tax)
    const shippingRate = typeof product.getShippingCost === 'function' 
      ? product.getShippingCost(userRole) 
      : (userRole === 'reseller' ? (product.wholesale?.shippingCost || 0) : (product.retail?.shippingCost || 0));

    const itemShipping = shippingRate * item.quantity;

    // Stock Management
    product.stock -= item.quantity;
    if (item.selectedColor) {
      const variant = product.variants.find(v => v.colorName === item.selectedColor);
      if (variant) {
        variant.stock = Math.max(0, variant.stock - item.quantity);
      }
    }
    await product.save();

    // Image Handling
    let productImage = '';
    if (product.images && product.images.length > 0) {
      const firstImg = product.images[0];
      if (firstImg.url && typeof firstImg.url === 'string') {
        productImage = firstImg.url;
      } else if (firstImg.imageId) {
        productImage = firstImg.imageId.toString();
      }
    }

    orderItems.push({
      product: product._id,
      name: product.name,
      image: productImage,
      quantity: item.quantity,
      price: unitPrice,
      selectedSize: item.selectedSize,
      selectedColor: item.selectedColor,
      taxAmount: 0, // No tax
      shippingAmount: itemShipping
    });

    subtotal += lineTotal;
    totalShipping += itemShipping;
  }

  // 2. Handle Coupons
  let couponDiscount = 0;
  let couponDetails = null;

  if (couponCode && userRole !== 'reseller') {
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(), 
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });

    if (coupon && subtotal >= coupon.minOrderValue) {
      if (coupon.discountType === 'percentage') {
        couponDiscount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount > 0) couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
      } else {
        couponDiscount = coupon.discountValue;
      }
      
      couponDetails = {
        code: coupon.code,
        discountAmount: couponDiscount,
        percentage: coupon.discountType === 'percentage' ? coupon.discountValue : 0
      };
      coupon.usedCount += 1;
      await coupon.save();
    }
  }

  // 3. Final Total (No Tax)
  const totalAmount = Math.round((subtotal + totalShipping - couponDiscount) * 100) / 100;

  // 4. Create Order (Status: Pending Payment)
  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: req.user._id,
    customerEmail: req.user.email,
    customerPhone: shippingAddress.phone,
    items: orderItems,
    shippingAddress,
    paymentMethod: 'razorpay', // ✅ Enforce Razorpay
    subtotal,
    shippingCost: totalShipping,
    tax: 0, // No tax
    couponDiscount,
    couponDetails,
    totalAmount,
    status: 'pending',
    paymentStatus: 'pending' // Waits for Payment Controller to verify
  });

  await Cart.findOneAndDelete({ user: req.user._id });

  // Note: Emails are sent AFTER payment verification in paymentController

  res.status(201).json({
    success: true,
    message: 'Order created, awaiting payment',
    order
  });
});

// @desc    Update order status (Admin)
// @route   PUT /api/admin/orders/:id/status
// @access  Private (Admin)
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note, courierName, trackingId } = req.body;

  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) throw new AppError(404, 'Order not found');

  // Store old status for logging
  const oldStatus = order.status;
  
  order.status = status;
  let statusNote = note || `Status updated to ${status}`;
  
  if (status === 'shipped') {
    if (courierName) statusNote += ` via ${courierName}`;
    if (trackingId) statusNote += ` (${trackingId})`;
    
    order.trackingDetails = {
      courierName: courierName || '',
      trackingId: trackingId || '',
      shippedDate: new Date()
    };
  }

  if (status === 'delivered') {
    order.deliveredAt = new Date();
    order.paymentStatus = 'completed'; // Double check payment confirmed on delivery
  }

  order.statusHistory.push({ status, note: statusNote });
  await order.save();

  // ✅ FIXED: Send Emails Based on Status - ALWAYS TRY TO SEND
  let emailSent = false;
  let emailError = null;
  
  try {
    if (status === 'shipped') {
      console.log(`📧 Attempting to send SHIPPED email for order ${order.orderNumber}...`);
      const result = await sendOrderShipped(order);
      
      if (result && result.success) {
        order.emailNotifications.shippedSent = true;
        order.emailNotifications.shippedSentAt = new Date();
        emailSent = true;
        console.log(`✅ Shipped email sent successfully for order ${order.orderNumber}`);
      } else {
        emailError = result?.error || 'Unknown error';
        console.error(`❌ Failed to send shipped email for order ${order.orderNumber}:`, emailError);
      }
      
    } else if (status === 'delivered') {
      console.log(`📧 Attempting to send DELIVERED email for order ${order.orderNumber}...`);
      const result = await sendOrderDelivered(order);
      
      if (result && result.success) {
        order.emailNotifications.deliveredSent = true;
        order.emailNotifications.deliveredSentAt = new Date();
        emailSent = true;
        console.log(`✅ Delivered email sent successfully for order ${order.orderNumber}`);
      } else {
        emailError = result?.error || 'Unknown error';
        console.error(`❌ Failed to send delivered email for order ${order.orderNumber}:`, emailError);
      }
      
    } else if (status === 'confirmed' || status === 'processing') {
      // Optionally send confirmation email when confirming order
      if (!order.emailNotifications.confirmationSent) {
        console.log(`📧 Attempting to send CONFIRMATION email for order ${order.orderNumber}...`);
        const result = await sendOrderConfirmation(order);
        
        if (result && result.success) {
          order.emailNotifications.confirmationSent = true;
          order.emailNotifications.confirmationSentAt = new Date();
          emailSent = true;
          console.log(`✅ Confirmation email sent successfully for order ${order.orderNumber}`);
        } else {
          emailError = result?.error || 'Unknown error';
          console.error(`❌ Failed to send confirmation email for order ${order.orderNumber}:`, emailError);
        }
      }
    }
    
    // Save email notification updates
    if (emailSent) {
      await order.save();
    }
    
  } catch (emailException) {
    // Log but don't fail the status update
    console.error(`❌ Email sending exception for order ${order.orderNumber}:`, emailException);
    emailError = emailException.message;
  }

  // Return response with email status
  res.json({ 
    success: true, 
    message: `Order status updated from ${oldStatus} to ${status}`,
    emailStatus: emailSent ? 'sent' : 'failed',
    emailError: emailError || undefined,
    order 
  });
});

exports.getUserOrders = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = { user: req.user._id };

  if (req.query.status) {
    query.status = req.query.status;
  }

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('items.product', 'name images');

  const total = await Order.countDocuments(query);

  res.json({
    success: true,
    count: orders.length,
    total,
    orders
  });
});

exports.getOrderById = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const order = await Order.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('items.product', 'name images specifications');

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AppError(403, 'Not authorized to access this order');
  }

  res.json({
    success: true,
    order
  });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  if (order.user.toString() !== req.user._id.toString()) {
    throw new AppError(403, 'Not authorized to cancel this order');
  }

  if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status)) {
    throw new AppError(400, 'Order cannot be cancelled');
  }

  order.status = 'cancelled';
  order.statusHistory.push({
    status: 'cancelled',
    note: 'Order cancelled by user'
  });
  await order.save();

  for (const item of order.items) {
    const product = await Product.findById(item.product);

    product.stock += item.quantity;

    if (item.selectedColor) {
      const variant = product.variants.find(v => v.colorName === item.selectedColor);
      if (variant) {
        variant.stock += item.quantity;
      }
    }

    await product.save();
  }

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    order
  });
});

exports.trackOrder = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  if (order.user.toString() !== req.user._id.toString()) {
    throw new AppError(403, 'Not authorized to access this order');
  }

  res.json({
    success: true,
    tracking: {
      orderNumber: order.orderNumber,
      status: order.status,
      statusHistory: order.statusHistory,
      estimatedDelivery: order.estimatedDelivery,
      deliveredAt: order.deliveredAt
    }
  });
});

exports.addOrderNote = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const { note } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  order.notes = note;
  await order.save();

  res.json({
    success: true,
    message: 'Note added successfully',
    order
  });
});

exports.getOrders = exports.getUserOrders;

// ✅ FIXED: Resend Email Function
exports.resendOrderEmail = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const { emailType } = req.body;

  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  console.log(`📧 Attempting to resend ${emailType} email for order ${order.orderNumber}...`);

  let emailResult;

  try {
    switch (emailType) {
      case 'confirmation':
        emailResult = await sendOrderConfirmation(order);
        if (emailResult && emailResult.success) {
          order.emailNotifications.confirmationSent = true;
          order.emailNotifications.confirmationSentAt = new Date();
          console.log(`✅ Confirmation email resent successfully for order ${order.orderNumber}`);
        }
        break;
        
      case 'shipped':
        emailResult = await sendOrderShipped(order);
        if (emailResult && emailResult.success) {
          order.emailNotifications.shippedSent = true;
          order.emailNotifications.shippedSentAt = new Date();
          console.log(`✅ Shipped email resent successfully for order ${order.orderNumber}`);
        }
        break;
        
      case 'delivered':
        emailResult = await sendOrderDelivered(order);
        if (emailResult && emailResult.success) {
          order.emailNotifications.deliveredSent = true;
          order.emailNotifications.deliveredSentAt = new Date();
          console.log(`✅ Delivered email resent successfully for order ${order.orderNumber}`);
        }
        break;
        
      default:
        throw new AppError(400, 'Invalid email type');
    }

    // Check if email was successful
    if (!emailResult || !emailResult.success) {
      const errorMsg = emailResult?.error || 'Email service returned failure';
      console.error(`❌ Failed to send ${emailType} email:`, errorMsg);
      throw new AppError(500, `Failed to send ${emailType} email: ${errorMsg}`);
    }

    await order.save();

    res.json({
      success: true,
      message: `${emailType} email sent successfully to ${order.customerEmail}`,
      result: emailResult
    });
    
  } catch (emailError) {
    console.error(`❌ Failed to send ${emailType} email:`, emailError);
    
    // If it's already an AppError, rethrow it
    if (emailError instanceof AppError) {
      throw emailError;
    }
    
    // Otherwise create a new AppError with the details
    throw new AppError(500, `Failed to send ${emailType} email: ${emailError.message}`);
  }
});