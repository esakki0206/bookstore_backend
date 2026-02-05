const express = require('express');
const router = express.Router();
const { 
  createOrder, 
  getOrders, 
  getOrderById, 
  updateOrderStatus, 
  cancelOrder,
  resendOrderEmail
} = require('../controllers/orderController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { validateOrderInput } = require('../middleware/validation');

// Customer routes (protected)
router.post('/create', verifyToken, validateOrderInput, createOrder);  // POST /api/orders/create
router.get('/', verifyToken, getOrders);  // GET /api/orders
router.get('/:id', verifyToken, getOrderById);  // GET /api/orders/:id
router.post('/:id/cancel', verifyToken, cancelOrder);  // POST /api/orders/:id/cancel

// Admin routes (protected + admin)
router.put('/:id/status', verifyToken, verifyAdmin, updateOrderStatus);  // PUT /api/orders/:id/status
router.post('/:id/resend-email', verifyToken, verifyAdmin, resendOrderEmail);  // POST /api/orders/:id/resend-email

module.exports = router;
