const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get dashboard statistics
// @route   GET /api/admin/analytics/stats
// @access  Private (Admin)
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const revenueAgg = await Order.aggregate([
    { $match: { paymentStatus: 'completed' } },
    { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
  ]);

  const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

  const [
    totalOrders,
    totalUsers,
    totalProducts,
    pendingOrders,
    lowStockProducts
  ] = await Promise.all([
    Order.countDocuments(),
    User.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments({ status: 'pending' }),
    Product.countDocuments({ stock: { $lt: 10 } })
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysOrders = await Order.countDocuments({ createdAt: { $gte: today } });

  res.json({
    success: true,
    stats: {
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      pendingOrders,
      lowStockProducts,
      todaysOrders
    }
  });
});

// @desc    Get sales by date
// @route   GET /api/admin/analytics/sales-by-date
// @access  Private (Admin)
exports.getSalesByDate = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const match = { paymentStatus: 'completed' };
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo) match.createdAt.$lte = new Date(dateTo);
  }

  const sales = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    sales
  });
});

// @desc    Get top products
// @route   GET /api/admin/analytics/top-products
// @access  Private (Admin)
exports.getTopProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  const topProducts = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
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
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        totalSold: 1,
        revenue: 1,
        name: '$product.name',
        category: '$product.category',
        price: '$product.price'
      }
    }
  ]);

  res.json({
    success: true,
    topProducts
  });
});

// @desc    Get low stock analytics
// @route   GET /api/admin/analytics/low-stock
// @access  Private (Admin)
exports.getLowStockAnalytics = asyncHandler(async (req, res) => {
  const threshold = parseInt(req.query.threshold, 10) || 10;

  const products = await Product.find({ stock: { $lt: threshold } })
    .sort({ stock: 1 })
    .select('name category stock price');

  res.json({
    success: true,
    threshold,
    count: products.length,
    products
  });
});

// @desc    Get order summary
// @route   GET /api/admin/analytics/orders
// @access  Private (Admin)
exports.getOrderSummary = asyncHandler(async (req, res) => {
  const summary = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    summary
  });
});
