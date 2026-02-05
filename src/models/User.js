const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
  password: { type: String, required: [true, 'Password is required'], minlength: 6 },
  phone: { type: String, trim: true },
  // Updated Role Enum

  role: {
    type: String,
    enum: ['user', 'admin', 'reseller', 'customer'], // Added 'reseller'
    default: 'user'
  },
  
  // --- Reseller Specific Fields ---
  resellerStatus: {
    type: String,
    enum: ['new', 'pending', 'approved', 'rejected', 'suspended'],
    default: 'new'
  },
  
  businessDetails: {
    businessName: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true }, // Optional in logic, but schema supports it
    panNumber: { type: String, trim: true, uppercase: true },
    socialLink: { type: String, trim: true }, // Added for Instagram/Website link
    website: String
  },
  
  addresses: [{
    name: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    isDefault: { type: Boolean, default: false }
  }]
}, { timestamps: true });
// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Hide sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);