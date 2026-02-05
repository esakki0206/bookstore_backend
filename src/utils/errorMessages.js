module.exports = {
  // Auth errors
  INVALID_EMAIL: 'Please provide a valid email address',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  USER_NOT_FOUND: 'User not found',
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_TOKEN: 'Invalid or expired token',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',

  // Product errors
  PRODUCT_NOT_FOUND: 'Product not found',
  INVALID_PRODUCT_DATA: 'Invalid product data',
  SKU_ALREADY_EXISTS: 'SKU already exists',
  INSUFFICIENT_STOCK: 'Insufficient stock available',
  INVALID_CATEGORY: 'Invalid product category',

  // Cart errors
  CART_EMPTY: 'Cart is empty',
  ITEM_NOT_IN_CART: 'Item not found in cart',
  INVALID_QUANTITY: 'Invalid quantity',

  // Order errors
  ORDER_NOT_FOUND: 'Order not found',
  INVALID_ORDER_DATA: 'Invalid order data',
  ORDER_CANNOT_BE_CANCELLED: 'This order cannot be cancelled',
  ORDER_ALREADY_SHIPPED: 'Order already shipped',

  // Payment errors
  PAYMENT_FAILED: 'Payment failed',
  PAYMENT_NOT_FOUND: 'Payment not found',
  INVALID_PAYMENT_DATA: 'Invalid payment data',
  PAYMENT_ALREADY_PROCESSED: 'Payment already processed',

  // Admin errors
  ADMIN_ACCESS_REQUIRED: 'Admin access required',
  
  // Generic errors
  INTERNAL_SERVER_ERROR: 'Internal server error',
  SOMETHING_WENT_WRONG: 'Something went wrong. Please try again',
  INVALID_REQUEST: 'Invalid request'
};
