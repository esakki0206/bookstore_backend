const express = require('express');
const { adminLogin } = require('../controllers/authController');
const router = express.Router();
const upload = require('../middleware/upload');
const User = require('../models/User');
const {
  createCoupon,
  getAllCoupons,
  deleteCoupon
} = require('../controllers/CouponController');

const {
  getDashboardStats: getAdminDashboardStats,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  getProducts,
  getProductsWithDiscounts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateStock,
  getLowStockProducts,
  exportOrders,
  getRecentActivities,
  getAnalyticsOverview,
  getTopSellingProducts,
  updateProductDiscount,
  getDiscountAnalytics,
  getRefundAnalytics,
  getAllOrders,
  getOrderById,
  uploadImage,
  updateOrderStatus,
  resendOrderEmail
} = require('../controllers/adminController');

const {
  getDashboardStats: getAnalyticsStats,
  getSalesByDate,
  getTopProducts,
  getLowStockAnalytics,
  getOrderSummary
} = require('../controllers/analyticController');

const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { validateProductInput } = require('../middleware/validation');
const { getPendingResellers, updateResellerStatus } = require('../controllers/adminController');


router.post('/login', adminLogin);

// All routes protected + admin only
router.use(verifyToken, verifyAdmin);  // Middleware for all routes below

// Dashboard
router.get('/dashboard', getAdminDashboardStats);  // GET /api/admin/dashboard

// Product management
router.get('/products', getProducts);  // GET /api/admin/products
router.post(
  '/products/upload',
  upload.single('image'),
  uploadImage
);

router.get('/products/with-discounts', getProductsWithDiscounts);  // GET /api/admin/products/with-discounts
router.post('/products', validateProductInput, createProduct);  // POST /api/admin/products
router.put('/products/:id', updateProduct);  // PUT /api/admin/products/:id
router.delete('/products/:id', deleteProduct);  // DELETE /api/admin/products/:id

// Stock
router.put('/products/stock', bulkUpdateStock);  // PUT /api/admin/products/stock
router.get('/products/stock', getLowStockProducts);  // GET /api/admin/products/stock
router.get('/products/low-stock', getLowStockProducts);  // GET /api/admin/products/low-stock (alias)

// Product discount management
router.put('/products/:id/discount', updateProductDiscount);  // PUT /api/admin/products/:id/discount

// Coupon management
router.post('/coupons', createCoupon);          // POST /api/admin/coupons
router.get('/coupons', getAllCoupons);           // GET  /api/admin/coupons
router.delete('/coupons/:id', deleteCoupon);     // DELETE /api/admin/coupons/:id

// Analytics routes
router.get('/analytics/overview', getAnalyticsOverview);  // GET /api/admin/analytics/overview
router.get('/analytics/top-products', getTopSellingProducts);  // GET /api/admin/analytics/top-products
router.get('/analytics/discounts', getDiscountAnalytics);  // GET /api/admin/analytics/discounts
router.get('/analytics/refunds', getRefundAnalytics);  // GET /api/admin/analytics/refunds

// Legacy analytics routes (keeping for compatibility)
router.get('/analytics/stats', getAnalyticsStats);  // GET /api/admin/analytics/stats
router.get('/analytics/sales-by-date', getSalesByDate);  // GET /api/admin/analytics/sales-by-date
router.get('/analytics/top-products-legacy', getTopProducts);  // GET /api/admin/analytics/top-products-legacy
router.get('/analytics/low-stock', getLowStockAnalytics);  // GET /api/admin/analytics/low-stock
router.get('/analytics/orders', getOrderSummary);  // GET /api/admin/analytics/orders

// Order management
router.get('/orders', getAllOrders);  // GET /api/admin/orders
router.get('/orders/export', exportOrders);  // GET /api/admin/orders/export
router.get('/orders/:id', getOrderById);  // GET /api/admin/orders/:id
router.put('/orders/:id/status', updateOrderStatus);  // PUT /api/admin/orders/:id/status
router.post('/orders/:id/resend-email', resendOrderEmail);  // POST /api/admin/orders/:id/resend-email
router.get('/resellers/pending', getPendingResellers);
router.put('/resellers/:id/status', updateResellerStatus);

// Users
router.get('/users', getAllUsers);  // GET /api/admin/users
router.get('/users/:userId', getUserDetails);  // GET /api/admin/users/:userId
router.put('/users/:userId/status', updateUserStatus);  // PUT /api/admin/users/:userId/status

// Activities
router.get('/activities/recent', getRecentActivities);  // GET /api/admin/activities/recent

module.exports = router;
