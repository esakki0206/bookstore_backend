# Backend Quick Reference Guide

## 🚀 Quick Start

```bash
cd backend
npm install
cp .env.example .env
# Edit .env file with your values
npm run dev
```

## 📦 Import Examples

### Middleware
```javascript
// Auth middleware
const { verifyToken, verifyAdmin, verifyCustomer } = require('./middleware/auth');
// or use aliases
const { auth, protect, adminOnly } = require('./middleware/auth');

// Error handling
const { asyncHandler, AppError } = require('./middleware/errorHandler');
const errorHandler = require('./middleware/errorHandler');

// Validation middleware
const { validateEmail, validatePassword, validateProductInput } = require('./middleware/validation');
```

### Utilities
```javascript
// JWT utilities
const { generateToken, verifyToken, decodeToken } = require('./utils/jwt');

// Response helpers
const { sendSuccess, sendError, sendPaginated } = require('./utils/response');

// Validation helpers
const { isValidEmail, isValidPassword, isValidProductData } = require('./utils/validation');

// Error messages
const errorMessages = require('./utils/errorMessages');
```

## 🛠️ Usage Examples

### Controller with AsyncHandler
```javascript
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendSuccess } = require('../utils/response');

exports.getItems = asyncHandler(async (req, res) => {
  const items = await Item.find();
  sendSuccess(res, items, 'Items retrieved successfully');
});

exports.createItem = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    throw new AppError(400, 'Name is required');
  }
  const item = await Item.create(req.body);
  sendSuccess(res, item, 'Item created successfully', 201);
});
```

### Route with Auth Middleware
```javascript
const { auth, adminOnly } = require('../middleware/auth');

// Protected route (any authenticated user)
router.get('/profile', auth, controller.getProfile);

// Admin only route
router.post('/admin/users', adminOnly, controller.createUser);

// Or use verifyAdmin directly
const { verifyAdmin } = require('../middleware/auth');
router.delete('/admin/users/:id', verifyAdmin, controller.deleteUser);
```

### Using Validation Middleware
```javascript
const { validateEmail, validatePassword } = require('../middleware/validation');

router.post('/register', validateEmail, validatePassword, controller.register);
```

### Using Validation Helpers
```javascript
const { isValidEmail, isValidProductData } = require('../utils/validation');

if (!isValidEmail(email)) {
  throw new AppError(400, 'Invalid email format');
}

const { isValid, errors } = isValidProductData(productData);
if (!isValid) {
  throw new AppError(400, errors.join(', '));
}
```

### Using Response Helpers
```javascript
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

// Success response
sendSuccess(res, data, 'Operation successful', 200);

// Error response
sendError(res, 'Something went wrong', 500);

// Paginated response
sendPaginated(res, items, total, page, limit);
```

### Using JWT Utilities
```javascript
const { generateToken, verifyToken } = require('../utils/jwt');

// Generate token
const token = generateToken({ id: user._id, role: user.role }, '7d');

// Verify token
try {
  const decoded = verifyToken(token);
  console.log(decoded.id, decoded.role);
} catch (error) {
  console.error('Invalid token');
}
```

### Using Error Messages
```javascript
const errorMessages = require('../utils/errorMessages');

throw new AppError(404, errorMessages.PRODUCT_NOT_FOUND);
throw new AppError(401, errorMessages.INVALID_CREDENTIALS);
throw new AppError(403, errorMessages.ADMIN_ACCESS_REQUIRED);
```

## 📋 Available Error Messages

```javascript
// Auth
errorMessages.INVALID_EMAIL
errorMessages.EMAIL_ALREADY_EXISTS
errorMessages.USER_NOT_FOUND
errorMessages.INVALID_CREDENTIALS
errorMessages.INVALID_TOKEN
errorMessages.UNAUTHORIZED
errorMessages.FORBIDDEN

// Product
errorMessages.PRODUCT_NOT_FOUND
errorMessages.INVALID_PRODUCT_DATA
errorMessages.SKU_ALREADY_EXISTS
errorMessages.INSUFFICIENT_STOCK
errorMessages.INVALID_CATEGORY

// Cart
errorMessages.CART_EMPTY
errorMessages.ITEM_NOT_IN_CART
errorMessages.INVALID_QUANTITY

// Order
errorMessages.ORDER_NOT_FOUND
errorMessages.INVALID_ORDER_DATA
errorMessages.ORDER_CANNOT_BE_CANCELLED
errorMessages.ORDER_ALREADY_SHIPPED

// Payment
errorMessages.PAYMENT_FAILED
errorMessages.PAYMENT_NOT_FOUND
errorMessages.INVALID_PAYMENT_DATA
errorMessages.PAYMENT_ALREADY_PROCESSED

// Generic
errorMessages.INTERNAL_SERVER_ERROR
errorMessages.SOMETHING_WENT_WRONG
errorMessages.INVALID_REQUEST
```

## 🔐 Auth Middleware Options

### Available Middleware Functions
- `verifyToken` - Verify JWT and attach user to req.user
- `verifyAdmin` - Verify token + check admin role
- `verifyCustomer` - Verify token + check customer/user role
- `auth` - Alias for verifyToken
- `protect` - Alias for verifyToken
- `adminOnly` - Alias for verifyAdmin

### Usage in Routes
```javascript
// Any authenticated user
router.get('/profile', auth, controller.getProfile);

// Admin only
router.post('/products', verifyAdmin, controller.createProduct);

// Customer only
router.post('/orders', verifyCustomer, controller.createOrder);
```

## 📝 Response Format Standards

### Success (200/201)
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "status": "success"
}
```

### Error (400/401/403/404/409/500)
```json
{
  "success": false,
  "message": "Error description",
  "status": "error",
  "error": "Details (dev only)"
}
```

### Paginated (200)
```json
{
  "success": true,
  "message": "Success",
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  },
  "status": "success"
}
```

## 🌍 Environment Variables

Required in `.env`:
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - development/production
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT tokens
- `JWT_EXPIRE` - Token expiration (e.g., '7d')
- `RAZORPAY_KEY_ID` - Razorpay API key
- `RAZORPAY_KEY_SECRET` - Razorpay secret
- `FRONTEND_URL` - Frontend URL for CORS

## 🧪 Testing

### Check syntax
```bash
node -c src/server.js
```

### Load all modules
```bash
node -e "require('./src/server')"
```

### Run server
```bash
npm run dev
```

## 📊 HTTP Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## 🔍 Common Patterns

### Create Resource
```javascript
exports.create = asyncHandler(async (req, res) => {
  const item = await Model.create(req.body);
  sendSuccess(res, item, 'Created successfully', 201);
});
```

### Get All Resources
```javascript
exports.getAll = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const items = await Model.find().limit(limit).skip(skip);
  const total = await Model.countDocuments();
  
  sendPaginated(res, items, total, page, limit);
});
```

### Get Single Resource
```javascript
exports.getById = asyncHandler(async (req, res) => {
  const item = await Model.findById(req.params.id);
  
  if (!item) {
    throw new AppError(404, errorMessages.NOT_FOUND);
  }
  
  sendSuccess(res, item);
});
```

### Update Resource
```javascript
exports.update = asyncHandler(async (req, res) => {
  const item = await Model.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!item) {
    throw new AppError(404, errorMessages.NOT_FOUND);
  }
  
  sendSuccess(res, item, 'Updated successfully');
});
```

### Delete Resource
```javascript
exports.delete = asyncHandler(async (req, res) => {
  const item = await Model.findByIdAndDelete(req.params.id);
  
  if (!item) {
    throw new AppError(404, errorMessages.NOT_FOUND);
  }
  
  sendSuccess(res, null, 'Deleted successfully');
});
```

---

## 📚 Additional Resources

- Full setup documentation: `SETUP_COMPLETE.md`
- Main README: `README.md`
- Environment template: `.env.example`

---

**Happy Coding! 🚀**
