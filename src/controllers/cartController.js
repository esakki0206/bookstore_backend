// controllers/cartController.js
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// ✅ HELPER: Recalculate Totals (No Taxes)
const recalculateCart = async (cart, userRole = 'user') => {
  // 1. Populate products with necessary fields (including author, category for books)
  await cart.populate({
    path: 'items.product',
    select: 'price stock wholesalePrice retail wholesale isDiscountActive discountPercentage discountStartDate discountEndDate name images author category description'
  });

  let subtotal = 0;
  let totalShipping = 0;
  let totalItems = 0;
  
  // 2. Filter out invalid items (deleted products)
  cart.items = cart.items.filter(item => item.product != null);

  // 3. Iterate and Calculate
  for (const item of cart.items) {
    const product = item.product;
    const qty = item.quantity;

    // --- A. DETERMINE PRICE ---
    let unitPrice;
    if (userRole === 'reseller') {
      // Reseller: Use Wholesale Price if set, otherwise Retail Price
      unitPrice = product.wholesalePrice > 0 ? product.wholesalePrice : product.price;
    } else {
      // Retail: Use method if available (handles discounts), else raw price
      unitPrice = typeof product.getCurrentPrice === 'function'
        ? product.getCurrentPrice('user')
        : (product.discountedPrice || product.price);
    }

    // Update item price in DB to match current catalog
    item.price = unitPrice;
    const lineTotal = unitPrice * qty;

    // --- B. DETERMINE SHIPPING (No Tax) ---
    let logisticsSettings;
    if (userRole === 'reseller') {
      logisticsSettings = product.wholesale || { shippingCost: 0 };
    } else {
      logisticsSettings = product.retail || { shippingCost: 0 };
    }

    const itemShipping = (logisticsSettings.shippingCost || 0) * qty;

    // Save item-level breakdowns (no tax)
    item.shippingAmount = Math.round(itemShipping * 100) / 100;
    item.taxAmount = 0; // No taxes

    // Add to Totals
    subtotal += lineTotal;
    totalShipping += itemShipping;
    totalItems += qty;
  }

  // 4. Update Root Fields (No Tax)
  cart.subtotal = Math.round(subtotal * 100) / 100;
  cart.totalShipping = Math.round(totalShipping * 100) / 100;
  cart.totalTax = 0; // No taxes
  cart.totalItems = totalItems;
  
  // Grand Total = Subtotal + Shipping (No Tax)
  cart.totalAmount = Math.round((cart.subtotal + cart.totalShipping) * 100) / 100;

  return cart.save();
};

// @desc    Get user's cart
// @route   GET /api/cart
exports.getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  // Refresh prices and calculations on every load
  await recalculateCart(cart, req.user.role);

  res.json({ success: true, cart });
});

// @desc    Add item to cart
// @route   POST /api/cart/add (FIXED - was missing /add)
exports.addToCart = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError(400, errors.array()[0].msg);

  let { product, quantity, selectedSize, selectedColor } = req.body;

  // ✅ Normalize & validate quantity
  quantity = Number(quantity);
  if (!quantity || quantity < 1) {
    throw new AppError(400, 'Quantity must be at least 1');
  }

  // ✅ Validate product
  if (!product) throw new AppError(400, 'Product ID is required');

  const productDoc = await Product.findById(product);
  if (!productDoc) throw new AppError(404, 'Product not found');

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  // Find existing cart item
  const existingItemIndex = cart.items.findIndex(
    item =>
      item.product.toString() === product &&
      item.selectedSize === selectedSize &&
      item.selectedColor === selectedColor
  );

  // Determine unit price
  let unitPrice;
  if (req.user.role === 'reseller') {
    unitPrice =
      productDoc.wholesalePrice > 0
        ? productDoc.wholesalePrice
        : productDoc.price;
  } else {
    unitPrice =
      typeof productDoc.getCurrentPrice === 'function'
        ? productDoc.getCurrentPrice('user')
        : productDoc.price;
  }

  // ✅ Correct stock validation (existing + incoming)
  const existingQty =
    existingItemIndex > -1 ? cart.items[existingItemIndex].quantity : 0;

  if (productDoc.stock < existingQty + quantity) {
    throw new AppError(400, 'Insufficient stock');
  }

  if (existingItemIndex > -1) {
    // ✅ KEY FIX: accumulate quantity correctly
    cart.items[existingItemIndex].quantity += quantity;
    cart.items[existingItemIndex].price = unitPrice;
  } else {
    cart.items.push({
      product,
      quantity,
      price: unitPrice,
      selectedSize: selectedSize || 'Free Size',
      selectedColor: selectedColor || 'Standard'
    });
  }

  // ✅ Recalculate totals (shipping, tax, subtotal)
  await recalculateCart(cart, req.user.role);

  res.json({
    success: true,
    message: 'Item added to cart',
    cart
  });
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/:itemId
exports.updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) throw new AppError(400, 'Quantity must be at least 1');

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError(404, 'Cart not found');

  const identifier = req.params.itemId;
  
  // ✅ FIX: Find item by _id OR product ID
  const itemIndex = cart.items.findIndex(i => 
    i._id.toString() === identifier || i.product.toString() === identifier
  );

  if (itemIndex === -1) throw new AppError(404, 'Item not found in cart');

  // Check stock
  const product = await Product.findById(cart.items[itemIndex].product);
  if (!product) {
    cart.items.splice(itemIndex, 1);
    await recalculateCart(cart, req.user.role);
    throw new AppError(404, 'Product no longer exists');
  }

  if (product.stock < quantity) throw new AppError(400, `Only ${product.stock} items available`);

  // Update Quantity
  cart.items[itemIndex].quantity = quantity;
  
  // ✅ Recalculate
  await recalculateCart(cart, req.user.role);

  res.json({ success: true, message: 'Cart updated', cart });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/:itemId
exports.removeFromCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError(404, 'Cart not found');

  const identifier = req.params.itemId;

  const initialLength = cart.items.length;
  // ✅ FIX: Remove by line item _id (specific variant entry)
  cart.items = cart.items.filter(i => i._id.toString() !== identifier);

  if (cart.items.length === initialLength) throw new AppError(404, 'Item not found');

  await recalculateCart(cart, req.user.role);

  res.json({ success: true, message: 'Item removed', cart });
});

// @desc    Clear cart
// @route   DELETE /api/cart
exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError(404, 'Cart not found');

  cart.items = [];
  cart.subtotal = 0;
  cart.totalShipping = 0;
  cart.totalTax = 0; // Keep field for compatibility but always 0
  cart.totalAmount = 0;
  cart.totalItems = 0;
  
  await cart.save();

  res.json({ success: true, message: 'Cart cleared', cart });
});

// @desc    Merge guest cart on login
// @route   POST /api/cart/merge
exports.mergeCart = asyncHandler(async (req, res) => {
  const { guestCartItems } = req.body;
  if (!guestCartItems || !Array.isArray(guestCartItems)) throw new AppError(400, 'Invalid items');

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

  for (const guestItem of guestCartItems) {
    const productDoc = await Product.findById(guestItem.product);
    if (!productDoc) continue;

    let unitPrice;
    if (req.user.role === 'reseller') {
      unitPrice = productDoc.wholesalePrice > 0 ? productDoc.wholesalePrice : productDoc.price;
    } else {
      unitPrice = typeof productDoc.getCurrentPrice === 'function'
        ? productDoc.getCurrentPrice('user')
        : productDoc.price;
    }

    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === guestItem.product &&
              item.selectedSize === guestItem.selectedSize &&
              item.selectedColor === guestItem.selectedColor
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += guestItem.quantity;
      cart.items[existingItemIndex].price = unitPrice;
    } else {
      cart.items.push({
        product: guestItem.product,
        quantity: guestItem.quantity,
        price: unitPrice,
        selectedSize: guestItem.selectedSize || 'Free Size',
        selectedColor: guestItem.selectedColor || 'Standard'
      });
    }
  }

  await recalculateCart(cart, req.user.role);
  res.json({ success: true, message: 'Cart merged', cart });
});