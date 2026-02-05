# Backend Server Setup - Complete ✓

## Overview
Complete production-ready Express.js backend with all middleware and utilities configured.

## Files Created/Updated

### 1. Server Setup
- **src/server.js** ✓
  - Express app initialization
  - Middleware configuration (express.json, urlencoded, CORS)
  - Custom request logging middleware
  - Database connection on startup
  - All route mounting (/api/auth, /api/products, /api/cart, /api/orders, /api/payments, /api/admin)
  - 404 handler
  - Global error handling
  - Graceful shutdown handling (SIGTERM, SIGINT, unhandledRejection)

### 2. Middleware Files

#### src/middleware/auth.js ✓
- **verifyToken(req, res, next)** - JWT authentication middleware
  - Extracts token from Authorization header (Bearer format)
  - Verifies token using jwt.verify from utils/jwt.js
  - Fetches user from database
  - Attaches user to req.user
  - Handles expired token (401)
  - Handles invalid token (401)
  
- **verifyAdmin(req, res, next)** - Admin verification
  - Calls verifyToken first
  - Checks if req.user.role === 'admin'
  - Returns 403 if not admin
  
- **verifyCustomer(req, res, next)** - Customer verification
  - Calls verifyToken first
  - Checks if req.user.role === 'customer' or 'user'
  - Returns 403 if not customer

- **Exports**: verifyToken, verifyAdmin, verifyCustomer, protect (alias), auth (alias), adminOnly (alias)

#### src/middleware/errorHandler.js ✓
- **errorHandler(err, req, res, next)** - Global error handling
  - Logs errors with timestamp, message, stack
  - Handles Mongoose validation errors → 400
  - Handles JWT errors (JsonWebTokenError, TokenExpiredError) → 401
  - Handles Mongoose CastError → 400
  - Handles duplicate key error (code 11000) → 409
  - Handles custom error objects with status property
  - Generic server errors → 500
  - Response format: { success, message, status, error (dev only) }
  - Never exposes stack trace in production

- **AppError class** - Custom error class for throwing errors
- **asyncHandler(fn)** - Wrapper to avoid try-catch blocks in controllers

#### src/middleware/validation.js ✓
- **validateEmail(req, res, next)** - Email validation
- **validatePassword(req, res, next)** - Password validation (min 6 chars)
- **validateProductInput(req, res, next)** - Product data validation
- **validateOrderInput(req, res, next)** - Order data validation
- **validateAddressInput(req, res, next)** - Address data validation

### 3. Utility Files

#### src/utils/jwt.js ✓
```javascript
generateToken(payload, expiresIn = '7d') // Generate JWT token
verifyToken(token) // Verify JWT token
decodeToken(token) // Decode JWT token without verification
```

#### src/utils/errorMessages.js ✓
Centralized error messages object with:
- Auth errors (INVALID_EMAIL, EMAIL_ALREADY_EXISTS, USER_NOT_FOUND, etc.)
- Product errors (PRODUCT_NOT_FOUND, INSUFFICIENT_STOCK, etc.)
- Cart errors (CART_EMPTY, ITEM_NOT_IN_CART, etc.)
- Order errors (ORDER_NOT_FOUND, ORDER_CANNOT_BE_CANCELLED, etc.)
- Payment errors (PAYMENT_FAILED, PAYMENT_NOT_FOUND, etc.)
- Admin errors (ADMIN_ACCESS_REQUIRED)
- Generic errors (INTERNAL_SERVER_ERROR, SOMETHING_WENT_WRONG, etc.)

#### src/utils/validation.js ✓
Helper validation functions:
- isValidEmail(email)
- isValidPassword(password)
- isValidPhoneNumber(phone)
- isValidPinCode(pinCode)
- isValidProductData(data) - Returns { isValid, errors }
- isValidOrderData(data) - Returns { isValid, errors }
- isValidAddressData(data) - Returns { isValid, errors }
- isValidReviewData(data) - Returns { isValid, errors }
- sanitizeUserData(userData) - Removes password from user object

#### src/utils/response.js ✓
Standardized response helpers:
```javascript
sendSuccess(res, data, message, statusCode) // Success response
sendError(res, message, statusCode, error) // Error response
sendPaginated(res, data, total, page, limit, message, statusCode) // Paginated response
```

### 4. Configuration Files

#### src/config/database.js ✓
- MongoDB connection with retry logic (3 attempts)
- Connection retry with 5-second delay
- Success/failure logging
- Exits process on connection failure

#### .env.example ✓
Complete environment variables template:
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/saree-db
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=7d
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret-key
FRONTEND_URL=http://localhost:5173
ADMIN_EMAIL=admin@sareestore.com
CORS_ORIGIN=http://localhost:5173
NODE_LOG_LEVEL=debug
```

#### package.json ✓
Dependencies:
- express ^4.18.2
- mongoose ^7.5.0
- dotenv ^16.3.1
- bcryptjs ^2.4.3
- jsonwebtoken ^9.0.2
- cors ^2.8.5
- multer ^1.4.5-lts.1
- razorpay ^2.9.2
- express-validator ^7.0.0

Scripts:
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

## Directory Structure
```
backend/
├── src/
│   ├── config/
│   │   ├── constants.js
│   │   └── database.js ✓
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── cartController.js
│   │   ├── orderController.js
│   │   ├── paymentController.js
│   │   └── productController.js
│   ├── middleware/
│   │   ├── auth.js ✓
│   │   ├── errorHandler.js ✓
│   │   └── validation.js ✓
│   ├── models/
│   │   ├── Cart.js
│   │   ├── Order.js
│   │   ├── Payment.js
│   │   ├── Product.js
│   │   └── User.js
│   ├── routes/
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── cart.js
│   │   ├── orders.js
│   │   ├── payments.js
│   │   └── products.js
│   ├── utils/
│   │   ├── errorMessages.js ✓
│   │   ├── jwt.js ✓
│   │   ├── response.js ✓
│   │   ├── validation.js ✓
│   │   └── validationMiddleware.js (express-validator based, kept for backward compatibility)
│   └── server.js ✓
├── .env.example ✓
├── .gitignore
├── package.json ✓
└── README.md
```

## Features

### Middleware Chain
1. **CORS** - Configured for frontend URL from .env
2. **Body Parser** - JSON and URL-encoded parsing
3. **Request Logging** - Logs method, URL, and timestamp
4. **Authentication** - JWT verification for protected routes
5. **Validation** - Input validation for requests
6. **Error Handling** - Global error handler catches all errors

### Security Features
- JWT token verification
- Role-based access control (admin, customer/user)
- Password hashing (bcryptjs)
- CORS protection
- Input validation
- SQL injection protection (Mongoose)

### Error Handling
- Standardized error responses
- Environment-aware error details (dev vs production)
- Mongoose error handling
- JWT error handling
- Duplicate key error handling
- Custom error classes

### Response Format
All API responses follow this format:
```javascript
// Success
{
  success: true,
  message: "Operation successful",
  data: {...},
  status: "success"
}

// Error
{
  success: false,
  message: "Error message",
  status: "error",
  error: "Additional details (dev only)"
}

// Paginated
{
  success: true,
  message: "Success",
  data: [...],
  pagination: {
    total: 100,
    page: 1,
    limit: 10,
    pages: 10
  },
  status: "success"
}
```

## HTTP Status Codes Used
- 200 - OK (Success)
- 201 - Created
- 400 - Bad Request (Validation errors)
- 401 - Unauthorized (Authentication required)
- 403 - Forbidden (Insufficient permissions)
- 404 - Not Found
- 409 - Conflict (Duplicate key)
- 500 - Internal Server Error

## Route Structure
- `/api/auth` - Authentication routes
- `/api/products` - Product routes
- `/api/cart` - Shopping cart routes
- `/api/orders` - Order management routes
- `/api/payments` - Payment processing routes
- `/api/admin` - Admin panel routes

## Starting the Server

### Development
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your actual values
npm run dev
```

### Production
```bash
cd backend
npm install
# Set environment variables
npm start
```

## Environment Variables Required
Before starting the server, configure these in `.env`:
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_EXPIRE` - Token expiration time
- `RAZORPAY_KEY_ID` - Razorpay API key
- `RAZORPAY_KEY_SECRET` - Razorpay secret
- `FRONTEND_URL` - Frontend URL for CORS

## Testing
All files pass syntax validation:
- ✓ server.js
- ✓ middleware/auth.js
- ✓ middleware/errorHandler.js
- ✓ middleware/validation.js
- ✓ utils/jwt.js
- ✓ utils/validation.js
- ✓ utils/response.js
- ✓ config/database.js

## Integration
All middleware and utilities are ready for immediate use in controllers:
- Import errorHandler: `const { asyncHandler, AppError } = require('../middleware/errorHandler')`
- Import auth: `const { verifyToken, verifyAdmin } = require('../middleware/auth')`
- Import response helpers: `const { sendSuccess, sendError, sendPaginated } = require('../utils/response')`
- Import validation: `const { isValidEmail, isValidPassword } = require('../utils/validation')`
- Import error messages: `const errorMessages = require('../utils/errorMessages')`
- Import JWT utils: `const { generateToken, verifyToken } = require('../utils/jwt')`

## Next Steps
The backend server is now fully configured and ready for:
1. Controller implementation (already exists)
2. Additional route handlers
3. Testing with actual MongoDB database
4. Frontend integration
5. Deployment to production

## Notes
- All middleware properly ordered (body parser → logging → auth → routes → error handler)
- Database connection established before server starts listening
- Graceful shutdown handling for SIGTERM, SIGINT, and unhandled rejections
- No hardcoded values or secrets
- Environment variables used throughout
- Consistent response format across all endpoints
- Backward compatibility maintained for existing controllers and routes
