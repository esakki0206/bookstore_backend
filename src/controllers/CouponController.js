const Coupon = require('../models/Coupon');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @desc    Create a new coupon
// @route   POST /api/admin/coupons
// @access  Private (Admin)
exports.createCoupon = asyncHandler(async (req, res) => {
  const { code, discountPercentage, scope, applicableProducts, minOrderValue, expirationDate } = req.body;

  const existing = await Coupon.findOne({ code: code.toUpperCase() });
  if (existing) {
    throw new AppError(400, 'Coupon code already exists');
  }

  const coupon = await Coupon.create({
    code,
    discountPercentage,
    scope,
    applicableProducts: scope === 'specific' ? applicableProducts : [],
    minOrderValue,
    expirationDate
  });

  res.status(201).json({ success: true, coupon });
});

// @desc    Get all coupons
// @route   GET /api/admin/coupons
// @access  Private (Admin)
exports.getAllCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json({ success: true, coupons });
});

// @desc    Validate Coupon for a Cart
// @route   POST /api/coupons/validate
// @access  Private
exports.validateCoupon = asyncHandler(async (req, res) => {
  const { code, cartTotal, cartItems } = req.body; // cartItems must contain productId

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });

  if (!coupon || !coupon.isValid()) {
    throw new AppError(400, 'Invalid or expired coupon');
  }

  if (cartTotal < coupon.minOrderValue) {
    throw new AppError(400, `Minimum order value of ₹${coupon.minOrderValue} required`);
  }

  // Calculate Discount Amount
  let discountAmount = 0;

  if (coupon.scope === 'all') {
    discountAmount = (cartTotal * coupon.discountPercentage) / 100;
  } else {
    // Calculate discount only on applicable products
    const applicableIds = coupon.applicableProducts.map(id => id.toString());
    
    let eligibleTotal = 0;
    cartItems.forEach(item => {
      // Check if item.product (id) is in applicable list
      const pId = item.product._id || item.product; 
      if (applicableIds.includes(pId.toString())) {
        eligibleTotal += (item.price * item.quantity);
      }
    });

    if (eligibleTotal === 0) {
      throw new AppError(400, 'Coupon not applicable to items in cart');
    }
    
    discountAmount = (eligibleTotal * coupon.discountPercentage) / 100;
  }

  res.json({
    success: true,
    discountAmount: Math.round(discountAmount),
    couponCode: coupon.code,
    couponId: coupon._id
  });
});

// @desc    Delete Coupon
// @route   DELETE /api/admin/coupons/:id
// @access  Private (Admin)
exports.deleteCoupon = asyncHandler(async (req, res) => {
  await Coupon.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Coupon deleted' });
});