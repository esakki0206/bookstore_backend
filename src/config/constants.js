// Product Categories
const PRODUCT_CATEGORIES = [
  'silk',
  'cotton',
  'chiffon',
  'georgette',
  'crepe',
  'banarasi',
  'kanchipuram',
  'other'
];

// Product Sizes
const PRODUCT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'Free Size'];

// Order Status
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  INITIATED: 'initiated'
};

// Payment Methods
const PAYMENT_METHODS = {
  COD: 'cod',
  RAZORPAY: 'razorpay',
  CARD: 'card',
  UPI: 'upi',
  NETBANKING: 'netbanking',
  WALLET: 'wallet'
};

// User Roles
const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
};

// Pagination Defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
};

// File Upload Limits
const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp']
};

// JWT Token Expiry
const TOKEN_EXPIRY = {
  ACCESS: '7d'
};

// Shipping
const SHIPPING = {
  DEFAULT_COST: 50,
  FREE_SHIPPING_THRESHOLD: 999,
  ESTIMATED_DELIVERY_DAYS: 7
};

// Tax
const TAX_RATE = 0.18; // 18% GST

// Discount
const DISCOUNT = {
  MAX_PERCENTAGE: 50
};

module.exports = {
  PRODUCT_CATEGORIES,
  PRODUCT_SIZES,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  USER_ROLES,
  PAGINATION,
  FILE_UPLOAD,
  TOKEN_EXPIRY,
  SHIPPING,
  TAX_RATE,
  DISCOUNT
};
