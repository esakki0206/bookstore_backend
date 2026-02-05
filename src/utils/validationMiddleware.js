const { body, param, query, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
};

// User validation
const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6, max: 30 })
    .withMessage('Password must be between 6 and 30 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('phone')
    .optional()
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid phone number'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Product validation
const validateProduct = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('category')
    .isIn(['silk', 'cotton', 'chiffon', 'georgette', 'crepe', 'banarasi', 'kanchipuram', 'other'])
    .withMessage('Invalid category'),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  handleValidationErrors
];

const validateProductReview = [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Comment cannot be empty')
    .isLength({ max: 500 })
    .withMessage('Comment must not exceed 500 characters'),
  handleValidationErrors
];

// Cart validation
const validateCartItem = [
  body('product')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  body('selectedSize')
    .optional()
    .isIn(['S', 'M', 'L', 'XL', 'XXL', 'Free Size'])
    .withMessage('Invalid size'),
  handleValidationErrors
];

// Order validation
const validateOrder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.product')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('shippingAddress.name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('shippingAddress.phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ min: 10, max: 15 })
    .withMessage('Invalid phone number'),
  body('shippingAddress.address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('shippingAddress.city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('shippingAddress.state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  body('shippingAddress.pincode')
    .trim()
    .notEmpty()
    .withMessage('Pincode is required')
    .isPostalCode('IN')
    .withMessage('Invalid pincode'),
  body('paymentMethod')
    .isIn(['cod', 'razorpay', 'card'])
    .withMessage('Invalid payment method'),
  handleValidationErrors
];

// Payment validation
const validatePayment = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be a positive number'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Invalid currency code'),
  handleValidationErrors
];

const validatePaymentVerification = [
  body('razorpayOrderId')
    .trim()
    .notEmpty()
    .withMessage('Razorpay order ID is required'),
  body('razorpayPaymentId')
    .trim()
    .notEmpty()
    .withMessage('Razorpay payment ID is required'),
  body('razorpaySignature')
    .trim()
    .notEmpty()
    .withMessage('Razorpay signature is required'),
  body('orderId')
    .isMongoId()
    .withMessage('Invalid order ID'),
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// MongoDB ID validation
const validateMongoId = (paramName = 'id') => {
  return [
    param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
    handleValidationErrors
  ];
};

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateProduct,
  validateProductReview,
  validateCartItem,
  validateOrder,
  validatePayment,
  validatePaymentVerification,
  validatePagination,
  validateMongoId
};
