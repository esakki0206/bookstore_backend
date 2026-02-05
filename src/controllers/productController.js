const Product = require('../models/Product');
const { validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { PAGINATION } = require('../config/constants');

/**
 * Helper to format product for UI with book/saree specific data
 */
const formatProduct = (product) => {
  const obj = product.toObject({ virtuals: true });

  // Calculate discount status
  const discountActive = typeof product.isDiscountActive === 'function' 
    ? product.isDiscountActive() 
    : false;

  obj.discountActive = discountActive;
  obj.discountedPrice = discountActive ? product.finalPrice : null;
  obj.currentPrice = typeof product.getCurrentPrice === 'function' 
    ? product.getCurrentPrice() 
    : obj.price;
  
  // FIX: Ensure the main 'image' property exists as a string URL
  // This fixes the issue where product details page cannot find the image
  if (obj.images && obj.images.length > 0) {
    const firstImage = obj.images[0];
    // Handle both object format {url, publicId} and string format
    if (typeof firstImage === 'string') {
      obj.image = firstImage;
    } else if (firstImage && typeof firstImage === 'object') {
      obj.image = firstImage.url || firstImage.secure_url || firstImage.path || null;
    } else {
      obj.image = null;
    }
  } else {
    obj.image = null; 
  }

  // Book-specific defaults
  if (obj.category !== 'saree') {
    obj.author = obj.author || 'Unknown Author';
    obj.isbn = obj.isbn || '';
    obj.publisher = obj.publisher || '';
    obj.pages = obj.pages || 0;
    obj.language = obj.language || 'English';
  }
  
  obj.variants = obj.variants || []; 
  obj.isSoldOut = obj.stock <= 0;
  
  return obj;
};

/**
 * Normalize various image payload shapes into the schema shape:
 * { url: String, publicId: String }
 */
const normalizeImages = (images) => {
  if (!Array.isArray(images)) return [];

  return images
    .map((img) => {
      if (!img) return null;

      // Handle string URLs directly
      if (typeof img === 'string') {
        let url = img;
        let publicId;

        try {
          const urlObj = new URL(url);
          const filename = urlObj.pathname.split('/').pop() || '';
          publicId = filename.split('.')[0] || filename;
        } catch {
          const filename = url.split('/').pop() || '';
          publicId = filename.split('.')[0] || filename;
        }

        if (!url || !publicId) return null;
        return { url, publicId };
      }

      // Handle various possible shapes from frontend / upload responses
      const source = img.image || img;

      const url =
        source.url ||
        source.path ||
        source.secure_url;

      let publicId =
        source.publicId ||
        source.public_id ||
        source.filename ||
        source.publicid;

      // Derive publicId from URL/path if missing
      if (!publicId && url) {
        try {
          const urlObj = new URL(url);
          const filename = urlObj.pathname.split('/').pop() || '';
          publicId = filename.split('.')[0] || filename;
        } catch {
          const filename = url.split('/').pop() || '';
          publicId = filename.split('.')[0] || filename;
        }
      }

      if (!url || !publicId) {
        return null;
      }

      return { url, publicId };
    })
    .filter(Boolean);
};

// @desc    Create product (Book or Saree)
// @route   POST /api/admin/products
// @access  Private (Admin)
exports.createProduct = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const {
    name,
    author,
    isbn,
    publisher,
    description,
    price,
    category,
    discountPercentage,
    stock,
    pages,
    language,
    formats,
    images,
    retail,
    wholesale,
    fabric,
    pattern,
    occasion,
    variants
  } = req.body;

  // Validate required fields based on category
  if (category !== 'saree' && !author) {
    throw new AppError(400, 'Author is required for books');
  }

  // Normalize images into the shape expected by Product schema
  const normalizedImages = normalizeImages(images);

  // Create product with proper type conversion
  const productData = {
    name: name.trim(),
    description: description.trim(),
    price: Number(price),
    category,
    stock: Number(stock) || 0,
    discountPercentage: Number(discountPercentage) || 0,
    images: normalizedImages,
    retail: retail || { shippingCost: 0, taxPercentage: 0 },
    wholesale: wholesale || { shippingCost: 0, taxPercentage: 0 },
    createdBy: req.user._id
  };

  // Add book-specific fields
  if (category !== 'saree') {
    productData.author = author?.trim();
    productData.isbn = isbn?.trim() || '';
    productData.publisher = publisher?.trim() || '';
    productData.pages = Number(pages) || 0;
    productData.language = language || 'English';
    productData.formats = Array.isArray(formats) ? formats : [];
  }

  // Add saree-specific fields
  if (category === 'saree') {
    productData.fabric = fabric;
    productData.pattern = pattern;
    productData.occasion = occasion;
    productData.variants = Array.isArray(variants) ? variants : [];
  }

  const product = await Product.create(productData);

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    product: formatProduct(product)
  });
});

// @desc    Update product (Book or Saree)
// @route   PUT /api/admin/products/:id
// @access  Private (Admin)
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  const {
    name,
    author,
    isbn,
    publisher,
    description,
    price,
    category,
    discountPercentage,
    stock,
    pages,
    language,
    formats,
    images,
    retail,
    wholesale
  } = req.body;

  // Update common fields
  if (name) product.name = name.trim();
  if (description) product.description = description.trim();
  if (price !== undefined) product.price = Number(price);
  if (category) product.category = category;
  if (stock !== undefined) product.stock = Number(stock);
  if (discountPercentage !== undefined) product.discountPercentage = Number(discountPercentage);
  if (Array.isArray(images)) {
    product.images = normalizeImages(images);
  }
  
  // Update pricing structures
  if (retail) {
    product.retail = {
      shippingCost: Number(retail.shippingCost) || 0,
      taxPercentage: Number(retail.taxPercentage) || 0
    };
  }
  
  if (wholesale) {
    product.wholesale = {
      shippingCost: Number(wholesale.shippingCost) || 0,
      taxPercentage: Number(wholesale.taxPercentage) || 0
    };
  }

  // Update book-specific fields
  if (category !== 'saree') {
    if (author) product.author = author.trim();
    if (isbn !== undefined) product.isbn = isbn?.trim() || '';
    if (publisher) product.publisher = publisher.trim();
    if (pages !== undefined) product.pages = Number(pages);
    if (language) product.language = language;
    if (Array.isArray(formats)) product.formats = formats;
  }

  await product.save();

  res.json({
    success: true,
    message: 'Product updated successfully',
    product: formatProduct(product)
  });
});

// @desc    Get all products with filtering
// @route   GET /api/products
// @access  Public
exports.getAllProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT;
  const skip = (page - 1) * limit;

  const query = { isActive: true };

  // Category filter
  if (req.query.category) {
    query.category = req.query.category;
  }

  // Price range filter
  if (req.query.minPrice || req.query.maxPrice) {
    query.price = {};
    if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
    if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
  }

  // Stock filter
  if (req.query.inStock === 'true') {
    query.stock = { $gt: 0 };
  }

  // Search filter (works for both books and sarees)
  if (req.query.search) {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { author: { $regex: req.query.search, $options: 'i' } },
      { isbn: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  // Sorting
  let sort = {};
  switch (req.query.sort) {
    case 'price-asc':
      sort = { price: 1 };
      break;
    case 'price-desc':
      sort = { price: -1 };
      break;
    case 'newest':
      sort = { createdAt: -1 };
      break;
    case 'popular':
      sort = { 'ratings.count': -1 };
      break;
    default:
      sort = { createdAt: -1 };
  }

  const products = await Product.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(query);
  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    count: products.length,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    products: products.map(formatProduct)
  });
});

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  res.json({
    success: true,
    product: formatProduct(product)
  });
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
exports.getFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  const products = await Product.find({
    featured: true,
    stock: { $gt: 0 },
    isActive: true
  })
    .sort({ 'ratings.count': -1 })
    .limit(limit);

  res.json({
    success: true,
    count: products.length,
    products: products.map(formatProduct)
  });
});

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
// @access  Private (Admin)
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  await product.deleteOne();

  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
});

// Export all functions
module.exports = {
  createProduct: exports.createProduct,
  updateProduct: exports.updateProduct,
  getAllProducts: exports.getAllProducts,
  getProductById: exports.getProductById,
  getFeaturedProducts: exports.getFeaturedProducts,
  deleteProduct: exports.deleteProduct
};