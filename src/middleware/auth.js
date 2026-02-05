const { verifyToken: verifyJWT } = require('../utils/jwt');
const User = require('../models/User');

// Verify JWT token middleware
const verifyToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header (Bearer format)
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token using jwt utility
    const decoded = verifyJWT(token);

    // Get user from database
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Attach user to req.user
    req.user = user;

    // Call next() on success
    next();
  } catch (error) {
    // Handle expired token error
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }

    // Handle invalid token error
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Handle other errors
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Verify admin middleware
const verifyAdmin = async (req, res, next) => {
  // First verify token
  await verifyToken(req, res, async (err) => {
    if (err) return;

    // Check if user role is admin
    if (req.user && req.user.role === 'admin') {
      return next();
    }

    // Return 403 if not admin
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  });
};

// Verify customer middleware
const verifyCustomer = async (req, res, next) => {
  // First verify token
  await verifyToken(req, res, async (err) => {
    if (err) return;

    // Check if user role is customer (or user)
    if (req.user && (req.user.role === 'customer' || req.user.role === 'user')) {
      return next();
    }

    // Return 403 if not customer
    return res.status(403).json({
      success: false,
      message: 'Customer access required'
    });
  });
};

// Export all three middleware functions
module.exports = {
  verifyToken,
  verifyAdmin,
  verifyCustomer,
  // Aliases for backward compatibility
  protect: verifyToken,
  auth: verifyToken,
  adminOnly: verifyAdmin
};