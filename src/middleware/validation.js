// Input validation middleware functions

// Validate email
const validateEmail = (req, res, next) => {
  const { email } = req.body;

  // Check if email exists
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required',
      status: 'error'
    });
  }

  // Validate email format using regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
      status: 'error'
    });
  }

  // Call next() if valid
  next();
};

// Validate password
const validatePassword = (req, res, next) => {
  const { password } = req.body;

  // Check if password exists
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password is required',
      status: 'error'
    });
  }

  // Validate min 6 chars
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long',
      status: 'error'
    });
  }

  // Call next() if valid
  next();
};

// Validate product input
const validateProductInput = (req, res, next) => {
  const { name, price, description, category, stock } = req.body;
  const errors = [];

  if (!name) errors.push('Product name is required');
  if (price === undefined || price === null) errors.push('Product price is required');
  if (!description) errors.push('Product description is required');
  if (!category) errors.push('Product category is required');

  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    errors.push('Price must be a positive number');
  }

  if (stock !== undefined) {
    const numericStock = Number(stock);
    if (!Number.isInteger(numericStock) || numericStock < 0) {
      errors.push('Stock must be a non-negative integer');
    }
  }

  // Allow both saree fabric categories (legacy) and new book categories
  const allowedCategories = [
    // Saree-related / legacy product categories
    'silk',
    'cotton',
    'chiffon',
    'georgette',
    'crepe',
    'banarasi',
    'kanchipuram',
    'other',
    'saree',
    // Book-related categories used in the admin UI
    'fiction',
    'non-fiction',
    'academic',
    'children',
    'biography',
    'mystery',
    'fantasy'
  ];

  if (category && !allowedCategories.includes(String(category).toLowerCase())) {
    errors.push(`Category must be one of: ${allowedCategories.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      status: 'error'
    });
  }

  next();
};

// Validate order input
const validateOrderInput = (req, res, next) => {
  const { items, shippingAddress, paymentMethod } = req.body;
  const errors = [];

  if (!Array.isArray(items) || items.length === 0) {
    errors.push('Order must contain at least one item');
  }

  if (!shippingAddress || typeof shippingAddress !== 'object') {
    errors.push('Shipping address is required');
  } else {
    const requiredFields = ['name', 'phone', 'address', 'city', 'state', 'pincode'];
    for (const field of requiredFields) {
      if (!shippingAddress[field]) {
        errors.push(`${field} is required in shipping address`);
      }
    }
  }

  const allowedPaymentMethods = ['cod', 'razorpay', 'card'];
  if (!paymentMethod) {
    errors.push('Payment method is required');
  } else if (!allowedPaymentMethods.includes(paymentMethod)) {
    errors.push('Invalid payment method');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      status: 'error'
    });
  }

  next();
};

// Validate address input
const validateAddressInput = (req, res, next) => {
  const { street, city, state, postalCode, country } = req.body;
  const errors = [];

  // Check required fields
  if (!street) errors.push('Street address is required');
  if (!city) errors.push('City is required');
  if (!state) errors.push('State is required');
  if (!postalCode) errors.push('Postal code is required');
  if (!country) errors.push('Country is required');

  // Return errors if invalid
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors,
      status: 'error'
    });
  }

  next();
};

module.exports = {
  validateEmail,
  validatePassword,
  validateProductInput,
  validateOrderInput,
  validateAddressInput
};
