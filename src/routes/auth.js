const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, logout ,registerReseller} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { validateEmail, validatePassword } = require('../middleware/validation');

// Public routes
router.post('/register', validateEmail, validatePassword, register);
router.post('/login', validateEmail, validatePassword, login);
router.post('/logout', logout);

// Protected routes
router.get('/me', verifyToken, getProfile); // Alias for frontend compatibility
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);
router.post('/register-reseller', registerReseller);

module.exports = router;
