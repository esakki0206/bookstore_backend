const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const isValidPassword = (password) => {
  return password && password.length >= 6;
};

const isValidPhoneNumber = (phone) => {
  const regex = /^[0-9]{10}$/;
  return regex.test(phone);
};

const isValidPinCode = (pinCode) => {
  const regex = /^[0-9]{6}$/;
  return regex.test(pinCode);
};

const isValidProductData = (data) => {
  const errors = [];
  if (!data.name) errors.push('Product name is required');
  if (!data.price || data.price <= 0) errors.push('Valid price is required');
  if (!data.description) errors.push('Description is required');
  if (!data.sku) errors.push('SKU is required');
  if (!data.category) errors.push('Category is required');
  return { isValid: errors.length === 0, errors };
};

const isValidOrderData = (data) => {
  const errors = [];
  if (!data.items || data.items.length === 0) errors.push('Order items required');
  if (!data.customerDetails) errors.push('Customer details required');
  if (!data.totalAmount || data.totalAmount <= 0) errors.push('Valid total amount required');
  return { isValid: errors.length === 0, errors };
};

const isValidAddressData = (data) => {
  const errors = [];
  if (!data.street) errors.push('Street is required');
  if (!data.city) errors.push('City is required');
  if (!data.state) errors.push('State is required');
  if (!data.postalCode) errors.push('Postal code is required');
  if (!data.country) errors.push('Country is required');
  return { isValid: errors.length === 0, errors };
};

const isValidReviewData = (data) => {
  const errors = [];
  if (!data.rating || data.rating < 1 || data.rating > 5) errors.push('Rating must be between 1 and 5');
  if (!data.comment) errors.push('Comment is required');
  return { isValid: errors.length === 0, errors };
};

const sanitizeUserData = (userData) => {
  const { password, ...safeData } = userData;
  return safeData;
};

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidPhoneNumber,
  isValidPinCode,
  isValidProductData,
  isValidOrderData,
  isValidAddressData,
  isValidReviewData,
  sanitizeUserData
};
