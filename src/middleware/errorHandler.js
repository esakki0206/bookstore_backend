// Custom error class for operational errors
class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async handler wrapper to avoid try-catch blocks
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  // Log error with timestamp, message, stack
  console.error('='.repeat(80));
  console.error(`[${new Date().toISOString()}] ERROR:`);
  console.error(`Message: ${err.message}`);
  console.error(`Stack: ${err.stack}`);
  console.error('='.repeat(80));

  // Default values
  let statusCode = 500;
  let message = 'Internal server error';
  let errors = null;

  // Handle operational errors from AppError
  if (err.isOperational) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // Handle Mongoose validation errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please login again.';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired. Please login again.';
  }
  // Handle Mongoose CastError (invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }
  // Handle duplicate key error (MongoDB code 11000)
  else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    const value = err.keyValue?.[field] || 'unknown';
    message = `Duplicate value for ${field}`;
    errors = [{
      field: field,
      message: `${field} '${value}' already exists`
    }];
  }
  // Handle Multer file upload errors
  else if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size too large. Maximum size is 5MB.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field.';
    } else {
      message = err.message || 'File upload error';
    }
  }
  // Handle custom status codes from other sources
  else if (err.statusCode || err.status) {
    statusCode = err.statusCode || err.status;
    message = err.message || message;
  }

  // Ensure statusCode is a valid number
  if (typeof statusCode !== 'number' || statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  // Build response object
  const response = {
    success: false,
    message: message
  };

  // Add validation errors if present
  if (errors && errors.length > 0) {
    response.errors = errors;
  }

  // Add additional details in development mode
  if (process.env.NODE_ENV === 'development') {
    response.error = err.message;
    response.stack = err.stack;
    
    // Add any additional error properties
    if (err.errors && typeof err.errors === 'object') {
      response.validationErrors = err.errors;
    }
  }

  // Send error response
  res.status(statusCode).json(response);
};

// 404 Not Found handler
const notFound = (req, res, next) => {
  const error = new AppError(404, `Route ${req.originalUrl} not found`);
  next(error);
};

// Export as default and named exports
module.exports = errorHandler;
module.exports.AppError = AppError;
module.exports.asyncHandler = asyncHandler;
module.exports.errorHandler = errorHandler;
module.exports.notFound = notFound;