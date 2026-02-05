const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const cloudinary = require('../config/cloudinary');

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
exports.getDashboardStats = asyncHandler(async (req, res) => {
  // Total revenue
  const completedOrders = await Order.find({ paymentStatus: 'completed' });
  const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  // Total orders
  const totalOrders = await Order.countDocuments();

  // Total users
  const totalUsers = await User.countDocuments();

  // Total products
  const totalProducts = await Product.countDocuments();
  const productsWithDiscounts = await Product.countDocuments({ discountPercentage: { $gt: 0 } });

  // Recent orders
  const recentOrders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('user', 'name email');

  // Pending orders
  const pendingOrders = await Order.countDocuments({ status: 'pending' });

  // Low stock products
  const lowStockProducts = await Product.countDocuments({ stock: { $lt: 10 } });

  // Today's orders
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysOrders = await Order.countDocuments({
    createdAt: { $gte: today }
  });

  res.json({
    success: true,
    stats: {
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      productsWithDiscounts,
      pendingOrders,
      lowStockProducts,
      todaysOrders
    },
    recentOrders
  });
});

// @desc    Get all users with pagination
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getAllUsers = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.search) {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    count: users.length,
    total,
    users
  });
});

// @desc    Upload Image to Cloudinary
// @route   POST /api/admin/products/upload
// @access  Private (Admin)
exports.uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, 'No image uploaded');
  }

  // CloudinaryStorage provides path (secure_url) and filename (public_id)
  // Handle both possible property names for compatibility
  const imageUrl = req.file.path || req.file.secure_url || req.file.url;
  const publicId = req.file.filename || req.file.public_id || req.file.publicId;

  if (!imageUrl) {
    throw new AppError(500, 'Failed to get image URL from upload');
  }

  res.json({
    success: true,
    image: {
      url: imageUrl,
      publicId: publicId || imageUrl.split('/').pop().split('.')[0] // Fallback: derive from URL
    }
  });
});


// @desc    Get user details
// @route   GET /api/admin/users/:userId
// @access  Private (Admin)
exports.getUserDetails = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const user = await User.findById(req.params.userId).select('-password');

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Get user's orders
  const orders = await Order.find({ user: req.params.userId })
    .sort({ createdAt: -1 })
    .limit(10);

  res.json({
    success: true,
    user,
    orders: orders.length,
    recentOrders: orders
  });
});

// @desc    Update user status
// @route   PUT /api/admin/users/:userId/status
// @access  Private (Admin)
exports.updateUserStatus = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const { status } = req.body;

  const user = await User.findById(req.params.userId);

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Prevent blocking the admin
  if (user.role === 'admin') {
    throw new AppError(400, 'Cannot update admin status');
  }

  user.isActive = status === 'active';
  await user.save();

  res.json({
    success: true,
    message: 'User status updated successfully',
    user
  });
});

// @desc    Get all orders with pagination and filters
// @route   GET /api/admin/orders
// @access  Private (Admin)
exports.getAllOrders = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};

  // 1. Role Filter (Retail vs Wholesale)
  // We first find users matching the role, then filter orders by those users
  if (req.query.role) {
    const users = await User.find({ role: req.query.role }).select('_id');
    const userIds = users.map(u => u._id);
    query.user = { $in: userIds };
  }

  // 2. Status Filter
  if (req.query.status) {
    query.status = req.query.status;
  }

  // 3. Date Range Filter
  if (req.query.dateFrom || req.query.dateTo) {
    query.createdAt = {};
    if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) query.createdAt.$lte = new Date(req.query.dateTo);
  }

  // 4. Search (Order Number)
  if (req.query.search) {
    query.orderNumber = { $regex: req.query.search, $options: 'i' };
  }

  const orders = await Order.find(query)
    // ✅ POPULATE: Include 'role' and 'businessDetails' to differentiate in frontend
    .populate('user', 'name email phone role businessDetails') 
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments(query);

  res.json({
    success: true,
    count: orders.length,
    total,
    orders
  });
});

// @desc    Get sales analytics
// @route   GET /api/admin/analytics/sales
// @access  Private (Admin)
exports.getSalesAnalytics = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const period = req.query.period || 'month';
  let startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'all':
      startDate = new Date(0);
      break;
  }

  const orders = await Order.find({
    createdAt: { $gte: startDate },
    paymentStatus: 'completed'
  });

  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Sales by category
  const categorySales = {};
  for (const order of orders) {
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const category = product.category;
        if (!categorySales[category]) {
          categorySales[category] = { count: 0, revenue: 0 };
        }
        categorySales[category].count += item.quantity;
        categorySales[category].revenue += item.price * item.quantity;
      }
    }
  }

  res.json({
    success: true,
    analytics: {
      period,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      categorySales
    }
  });
});

// @desc    Get product analytics
// @route   GET /api/admin/analytics/products
// @access  Private (Admin)
exports.getProductAnalytics = asyncHandler(async (req, res) => {
  const totalProducts = await Product.countDocuments();

  const featuredProducts = await Product.countDocuments({ featured: true });
  const outOfStockProducts = await Product.countDocuments({ stock: 0 });
  const lowStockProducts = await Product.countDocuments({ stock: { $gt: 0, $lt: 10 } });

  // Top selling products
  const topSelling = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        name: '$product.name',
        category: '$product.category',
        totalSold: 1,
        revenue: 1
      }
    }
  ]);

  res.json({
    success: true,
    analytics: {
      totalProducts,
      featuredProducts,
      outOfStockProducts,
      lowStockProducts,
      topSelling
    }
  });
});

// @desc    Get low stock products
// @route   GET /api/admin/products/low-stock
// @access  Private (Admin)
exports.getLowStockProducts = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const threshold = parseInt(req.query.threshold) || 10;

  const products = await Product.find({ stock: { $lt: threshold } })
    .sort({ stock: 1 })
    .select('name category stock price');

  res.json({
    success: true,
    count: products.length,
    products
  });
});

// @desc    Bulk update product prices
// @route   PUT /api/admin/products/bulk-update
// @access  Private (Admin)
exports.bulkUpdateProducts = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const { productIds, action, value } = req.body;

  const products = await Product.find({ _id: { $in: productIds } });

  for (const product of products) {
    switch (action) {
      case 'increase':
        product.price = Math.round(product.price * (1 + value / 100) * 100) / 100;
        break;
      case 'decrease':
        product.price = Math.round(product.price * (1 - value / 100) * 100) / 100;
        break;
      case 'set':
        product.price = value;
        break;
    }
    await product.save();
  }

  res.json({
    success: true,
    message: 'Products updated successfully',
    count: products.length
  });
});

// @desc    Export orders
// @route   GET /api/admin/orders/export
// @access  Private (Admin)
exports.exportOrders = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const format = req.query.format || 'csv';
  const query = {};

  if (req.query.dateFrom || req.query.dateTo) {
    query.createdAt = {};
    if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) query.createdAt.$lte = new Date(req.query.dateTo);
  }

  const orders = await Order.find(query)
    .populate('user', 'name email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    message: `Orders exported in ${format} format`,
    count: orders.length,
    orders
  });
});

// @desc    Get recent activities
// @route   GET /api/admin/activities/recent
// @access  Private (Admin)
exports.getRecentActivities = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const limit = parseInt(req.query.limit) || 20;

  // Get recent orders
  const recentOrders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('orderNumber status createdAt user')
    .populate('user', 'name email');

  // Format as activities
  const activities = recentOrders.map(order => ({
    type: 'order',
    message: `Order ${order.orderNumber} ${order.status}`,
    user: order.user?.name || 'Unknown',
    timestamp: order.createdAt
  }));

  res.json({
    success: true,
    activities
  });
});

// Additional functions for admin routes compatibility

// @desc    Create product (from productController)
// @route   POST /api/admin/products
// @access  Private (Admin)
exports.createProduct = require('./productController').createProduct;

// @desc    Update product (from productController)
// @route   PUT /api/admin/products/:id
// @access  Private (Admin)
exports.updateProduct = require('./productController').updateProduct;

// @desc    Delete product (from productController)
// @route   DELETE /api/admin/products/:id
// @access  Private (Admin)
exports.deleteProduct = require('./productController').deleteProduct;

// @desc    Bulk update stock
// @route   PUT /api/admin/products/stock
// @access  Private (Admin)
exports.bulkUpdateStock = asyncHandler(async (req, res) => {
  const updates = Array.isArray(req.body)
    ? req.body
    : (req.body.updates || req.body.items || req.body.products);

  if (!Array.isArray(updates) || updates.length === 0) {
    throw new AppError(400, 'Stock updates are required');
  }

  const operations = updates.map((u) => {
    const productId = u.productId || u.id || u._id;
    const stock = u.stock;

    if (!productId) {
      throw new AppError(400, 'Product ID is required for each stock update');
    }

    const numericStock = Number(stock);
    if (!Number.isInteger(numericStock) || numericStock < 0) {
      throw new AppError(400, 'Stock must be a non-negative integer');
    }

    return Product.updateOne({ _id: productId }, { $set: { stock: numericStock } });
  });

  await Promise.all(operations);

  res.json({
    success: true,
    message: 'Stock updated successfully',
    count: updates.length
  });
});

// --- REMOVED DUPLICATE uploadImage HERE ---

// @desc    Get comprehensive analytics overview
// @route   GET /api/admin/analytics/overview
// @access  Private (Admin)
exports.getAnalyticsOverview = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const period = req.query.period || 'month';
  let startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'all':
      startDate = new Date(0);
      break;
  }

  // Current period analytics
  const currentOrders = await Order.find({
    createdAt: { $gte: startDate },
    paymentStatus: 'completed'
  });

  // Previous period for comparison
  const previousPeriodEnd = new Date(startDate);
  let previousPeriodStart = new Date();
  
  switch (period) {
    case 'today':
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
      break;
    case 'week':
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 14);
      break;
    case 'month':
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 2);
      break;
    case 'quarter':
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 6);
      break;
    case 'year':
      previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 2);
      break;
    default:
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
  }

  const previousOrders = await Order.find({
    createdAt: { $gte: previousPeriodStart, $lt: previousPeriodEnd },
    paymentStatus: 'completed'
  });

  // Calculate current period stats
  const currentRevenue = currentOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const currentOrdersCount = currentOrders.length;
  const currentAOV = currentOrdersCount > 0 ? currentRevenue / currentOrdersCount : 0;

  // Calculate previous period stats
  const previousRevenue = previousOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const previousOrdersCount = previousOrders.length;
  const previousAOV = previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0;

  // Calculate growth percentages
  const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
  const ordersGrowth = previousOrdersCount > 0 ? ((currentOrdersCount - previousOrdersCount) / previousOrdersCount) * 100 : 0;
  const aovGrowth = previousAOV > 0 ? ((currentAOV - previousAOV) / previousAOV) * 100 : 0;

  // Order status breakdown
  const orderStatusBreakdown = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Monthly sales data for chart
  const monthlySales = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) },
        paymentStatus: 'completed'
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.month': 1 }
    }
  ]);

  // Total users
  const totalUsers = await User.countDocuments();
  const newUsersInPeriod = await User.countDocuments({
    createdAt: { $gte: startDate }
  });

  // Product analytics
  const totalProducts = await Product.countDocuments();
  const productsWithDiscounts = await Product.countDocuments({ discountPercentage: { $gt: 0 } });
  const totalDiscountGiven = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        paymentStatus: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalDiscount: { $sum: '$discount' }
      }
    }
  ]);

  const [pendingOrdersCount, cancelledOrdersCount, refundedOrdersCount] = await Promise.all([
    Order.countDocuments({ status: 'pending' }),
    Order.countDocuments({ status: 'cancelled' }),
    Order.countDocuments({ status: 'refunded' })
  ]);

  const refundedAmountAgg = await Order.aggregate([
    { $match: { status: 'refunded' } },
    { $group: { _id: null, totalRefunded: { $sum: '$totalAmount' } } }
  ]);

  res.json({
    success: true,
    analytics: {
      period,
      overview: {
        revenue: {
          current: currentRevenue,
          previous: previousRevenue,
          growth: Math.round(revenueGrowth * 100) / 100
        },
        orders: {
          current: currentOrdersCount,
          previous: previousOrdersCount,
          growth: Math.round(ordersGrowth * 100) / 100,
          pending: pendingOrdersCount,
          cancelled: cancelledOrdersCount,
          refunded: refundedOrdersCount
        },
        averageOrderValue: {
          current: Math.round(currentAOV * 100) / 100,
          previous: Math.round(previousAOV * 100) / 100,
          growth: Math.round(aovGrowth * 100) / 100
        },
        customers: {
          total: totalUsers,
          newInPeriod: newUsersInPeriod
        },
        products: {
          total: totalProducts,
          withDiscounts: productsWithDiscounts
        },
        discounts: {
          totalGiven: totalDiscountGiven[0]?.totalDiscount || 0
        },
        refunds: {
          totalRefunded: refundedAmountAgg[0]?.totalRefunded || 0
        }
      },
      orderStatusBreakdown,
      monthlySales,
      recentOrders: await Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name email')
    }
  });
});

// @desc    Get top selling products
// @route   GET /api/admin/analytics/top-products
// @access  Private (Admin)
exports.getTopSellingProducts = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const limit = parseInt(req.query.limit) || 10;
  const period = req.query.period || 'month';

  let startDate = new Date();
  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  const topProducts = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        paymentStatus: 'completed'
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        orders: { $sum: 1 }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        name: '$product.name',
        category: '$product.category',
        price: '$product.price',
        discountPercentage: '$product.discountPercentage',
        stock: '$product.stock',
        totalSold: 1,
        revenue: 1,
        orders: 1,
        image: { $arrayElemAt: ['$product.images.url', 0] }
      }
    }
  ]);

  res.json({
    success: true,
    count: topProducts.length,
    products: topProducts
  });
});

// @desc    Update product discount
// @route   PUT /api/admin/products/:id/discount
// @access  Private (Admin)
exports.updateProductDiscount = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const { discountPercentage, discountStartDate, discountEndDate } = req.body;

  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  if (discountPercentage !== undefined) {
    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new AppError(400, 'Discount percentage must be between 0 and 100');
    }
    product.discountPercentage = discountPercentage;
  }

  if (discountStartDate !== undefined) {
    product.discountStartDate = discountStartDate ? new Date(discountStartDate) : null;
  }

  if (discountEndDate !== undefined) {
    product.discountEndDate = discountEndDate ? new Date(discountEndDate) : null;
  }

  await product.save();

  res.json({
    success: true,
    message: 'Product discount updated successfully',
    product
  });
});

// @desc    Get discount analytics
// @route   GET /api/admin/analytics/discounts
// @access  Private (Admin)
exports.getDiscountAnalytics = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const period = req.query.period || 'month';
  let startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  // Total discount given
  const discountStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        paymentStatus: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalDiscount: { $sum: '$discount' },
        totalOrders: { $sum: 1 },
        ordersWithDiscount: { $sum: { $cond: [{ $gt: ['$discount', 0] }, 1, 0] } }
      }
    }
  ]);

  // Discount by category
  const discountByCategory = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        paymentStatus: 'completed',
        discount: { $gt: 0 }
      }
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        totalDiscount: { $sum: '$discount' },
        orderCount: { $sum: 1 }
      }
    }
  ]);

  // Top discounted products
  const topDiscountedProducts = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        paymentStatus: 'completed',
        discount: { $gt: 0 }
      }
    },
    { $unwind: '$discountDetails.appliedDiscounts' },
    {
      $group: {
        _id: '$discountDetails.appliedDiscounts.productId',
        totalDiscountAmount: { $sum: '$discountDetails.appliedDiscounts.discountAmount' },
        productName: { $first: '$discountDetails.appliedDiscounts.productName' },
        timesDiscounted: { $sum: 1 }
      }
    },
    { $sort: { totalDiscountAmount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        name: '$product.name',
        category: '$product.category',
        totalDiscountAmount: 1,
        timesDiscounted: 1
      }
    }
  ]);

  res.json({
    success: true,
    analytics: {
      overall: discountStats[0] || {
        totalDiscount: 0,
        totalOrders: 0,
        ordersWithDiscount: 0
      },
      byCategory: discountByCategory,
      topDiscountedProducts
    }
  });
});

// @desc    Get products with pagination and filters
// @route   GET /api/admin/products
// @access  Private (Admin)
exports.getProducts = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = {};

  if (req.query.search) {
    const regex = new RegExp(req.query.search, 'i');
    query.$or = [{ name: regex }, { description: regex }];
  }

  if (req.query.category) {
    query.category = req.query.category;
  }

  if (req.query.hasDiscount !== undefined && req.query.hasDiscount !== '') {
    const hasDiscount = req.query.hasDiscount === true || req.query.hasDiscount === 'true';
    query.discountPercentage = hasDiscount ? { $gt: 0 } : { $lte: 0 };
  }

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(query)
  ]);

  res.json({
    success: true,
    page,
    limit,
    total,
    products
  });
});

// @desc    Get products with discounts
// @route   GET /api/admin/products/with-discounts
// @access  Private (Admin)
exports.getProductsWithDiscounts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = { discountPercentage: { $gt: 0 } };

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(query)
  ]);

  res.json({
    success: true,
    page,
    limit,
    total,
    products
  });
});

// @desc    Get single order details
// @route   GET /api/admin/orders/:id
// @access  Private (Admin)
exports.getOrderById = require('./orderController').getOrderById;

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private (Admin)
exports.updateOrderStatus = require('./orderController').updateOrderStatus;

// @desc    Resend order notification email
// @route   POST /api/admin/orders/:id/resend-email
// @access  Private (Admin)
exports.resendOrderEmail = require('./orderController').resendOrderEmail;

// @desc    Refund/Cancellation analytics
// @route   GET /api/admin/analytics/refunds
// @access  Private (Admin)
exports.getRefundAnalytics = asyncHandler(async (req, res) => {
  const refundStats = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);

  const byStatus = refundStats.reduce((acc, row) => {
    acc[row._id] = { count: row.count, totalAmount: row.totalAmount };
    return acc;
  }, {});

  res.json({
    success: true,
    refunds: {
      cancelled: byStatus.cancelled || { count: 0, totalAmount: 0 },
      refunded: byStatus.refunded || { count: 0, totalAmount: 0 }
    },
    breakdown: refundStats
  });
});

// @desc    Get pending reseller requests
exports.getPendingResellers = asyncHandler(async (req, res) => {
  const pendingResellers = await User.find({ 
    role: 'reseller', 
    resellerStatus: 'pending' 
  }).select('-password');
  
  res.json({ success: true, resellers: pendingResellers });
});

// @desc    Approve or Reject reseller
exports.updateResellerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; 
  
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'User not found');

  user.resellerStatus = status;
  await user.save();

  res.json({ 
    success: true, 
    message: `Reseller ${status} successfully` 
  });
});