const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { TOKEN_EXPIRY } = require('../config/constants');

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY.ACCESS }
  );
};


// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const { name, email, password, phone } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError(400, 'User already exists with this email');
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    phone
  });

  // Generate token
  const token = generateToken(user);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    user
  });
});

// @route   POST /api/auth/register-reseller
exports.registerReseller = asyncHandler(async (req, res) => {
  const { 
    name, 
    email, 
    password, 
    phone, 
    businessName, 
    gstNumber, 
    panNumber, // New
    address,   // New
    socialLink // New
  } = req.body;

  // 1. Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError(400, 'User already exists with this email');
  }

  // 2. Create User
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: 'reseller',
    resellerStatus: 'pending', // IMPORTANT: Default to pending
    
    // Store Business Specifics
    businessDetails: {
      businessName,
      gstNumber,
      panNumber,
      socialLink
    },

    // Automatically add the provided address to their address book
    addresses: address ? [{
      address: address,
      // Since the simple form doesn't ask for city/state/zip separately yet, 
      // we leave them empty or you can parse them if needed.
      city: '', 
      state: '',
      pincode: '',
      isDefault: true,
      name: businessName || name,
      phone: phone
    }] : []
  });

  // 3. Response (Do not return token if you want them to wait for approval)
  // For now, we return success message
  res.status(201).json({
    success: true,
    message: 'Reseller application submitted successfully. Please wait for admin approval.',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      resellerStatus: user.resellerStatus
    }
  });
});

// @desc    Login user (Ensure this checks reseller status)
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +role +resellerStatus');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError(401, 'Invalid email or password');
  }

  // Reseller Verification Logic
  if (user.role === 'reseller') {
    if (user.resellerStatus === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your reseller account is pending approval. Please contact support.',
        isPending: true
      });
    }
    if (user.resellerStatus === 'rejected') {
      throw new AppError(403, 'Your reseller application was rejected.');
    }
    if (user.resellerStatus === 'suspended') {
      throw new AppError(403, 'Your reseller account has been suspended.');
    }
  }

  // ... Generate token and send response ...
  const token = generateToken(user);

  res.json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      resellerStatus: user.resellerStatus,
      // ... other fields
    }
  });
});

exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const admin = await User.findOne({ email, role: 'admin' }).select('+password');
  if (!admin) {
    throw new AppError(401, 'Invalid admin credentials');
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new AppError(401, 'Invalid admin credentials');
  }

  const token = generateToken(admin);

  res.json({
    success: true,
    token,
    user: admin
  });
});


// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  // In a stateless JWT auth system, logout is handled on the client side
  // by removing the token from storage
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({
    success: true,
    user
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const { name, phone } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { name, phone },
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user
  });
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg);
  }

  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);

  // Check current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AppError(401, 'Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Generate new token
  const token = generateToken(user);

  res.json({
    success: true,
    message: 'Password changed successfully',
    token
  });
});

// @desc    Add address
// @route   POST /api/auth/address
// @access  Private
exports.addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  user.addresses.push(req.body);
  await user.save();

  res.json({
    success: true,
    message: 'Address added successfully',
    addresses: user.addresses
  });
});

// @desc    Update address
// @route   PUT /api/auth/address/:addressId
// @access  Private
exports.updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  const address = user.addresses.id(req.params.addressId);
  if (!address) {
    throw new AppError(404, 'Address not found');
  }

  Object.assign(address, req.body);
  await user.save();

  res.json({
    success: true,
    message: 'Address updated successfully',
    addresses: user.addresses
  });
});

// @desc    Delete address
// @route   DELETE /api/auth/address/:addressId
// @access  Private
exports.deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  const address = user.addresses.id(req.params.addressId);
  if (!address) {
    throw new AppError(404, 'Address not found');
  }

  address.remove();
  await user.save();

  res.json({
    success: true,
    message: 'Address deleted successfully',
    addresses: user.addresses
  });
});

// @desc    Set default address
// @route   PUT /api/auth/address/:addressId/default
// @access  Private
exports.setDefaultAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  // Unset all default addresses
  user.addresses.forEach(addr => addr.isDefault = false);

  // Set selected address as default
  const address = user.addresses.id(req.params.addressId);
  if (!address) {
    throw new AppError(404, 'Address not found');
  }

  address.isDefault = true;
  await user.save();

  res.json({
    success: true,
    message: 'Default address updated successfully',
    addresses: user.addresses
  });
});

// Alias for getProfile
exports.getProfile = exports.getCurrentUser;
