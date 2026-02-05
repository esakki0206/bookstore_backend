const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, adminOnly: admin } = require('../middleware/auth');

// Public Routes
router.get('/', productController.getAllProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/:id', productController.getProductById);

// Admin Routes (Protect these)
router.post('/', protect, admin, productController.createProduct);
router.put('/:id', protect, admin, productController.updateProduct);
router.delete('/:id', protect, admin, productController.deleteProduct);

module.exports = router;