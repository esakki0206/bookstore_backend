// routes/cart.js
const express = require('express');
const router = express.Router();
const { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart,
  mergeCart
} = require('../controllers/cartController');

const { validateCoupon } = require('../controllers/CouponController'); 
const { verifyToken } = require('../middleware/auth');

// All routes protected (Base URL: /api/cart)
router.get('/', verifyToken, getCart);

// Support both legacy POST /api/cart and new POST /api/cart/add
router.post('/', verifyToken, addToCart);      // legacy/compat
router.post('/add', verifyToken, addToCart);   // explicit "add" endpoint
router.post('/merge', verifyToken, mergeCart); // For guest cart merge on login
router.put('/:itemId', verifyToken, updateCartItem); // ✅ Changed param name for clarity
router.delete('/:itemId', verifyToken, removeFromCart); // ✅ Changed param name
router.delete('/', verifyToken, clearCart);

// Coupon validation route
router.post('/validate-coupon', verifyToken, validateCoupon);

module.exports = router;