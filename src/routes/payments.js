const express = require('express');
const router = express.Router();
const { 
  createRazorpayOrder, // Updated Function Name
  verifyPayment, 
  initiateCoD, 
  getPaymentStatus 
} = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/auth');

// All payment routes protected
router.post('/create-order', verifyToken, createRazorpayOrder); // Matches Frontend
router.post('/verify', verifyToken, verifyPayment);
router.post('/cod', verifyToken, initiateCoD);
router.get('/:orderId', verifyToken, getPaymentStatus);

module.exports = router;