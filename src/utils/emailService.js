const nodemailer = require('nodemailer');

// --- Configuration ---
const emailConfig = {
  service: process.env.EMAIL_SERVICE || 'gmail',
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
};

// ✅ IMPROVED: Better transporter creation with validation
const createTransporter = () => {
  // Validate email configuration
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL CONFIGURATION ERROR: EMAIL_USER and EMAIL_PASSWORD must be set in environment variables');
    throw new Error('Email configuration is incomplete. Please set EMAIL_USER and EMAIL_PASSWORD.');
  }

  console.log(`📧 Creating email transporter with service: ${process.env.EMAIL_SERVICE || 'gmail'}`);
  console.log(`📧 Email user: ${process.env.EMAIL_USER}`);

  // ✅ FIX: Check if nodemailer is properly loaded
  if (typeof nodemailer.createTransport !== 'function') {
    console.error('❌ nodemailer.createTransport is not a function. Nodemailer may not be installed correctly.');
    console.error('Run: npm install nodemailer');
    throw new Error('Nodemailer not properly installed');
  }

  if (process.env.EMAIL_SERVICE === 'sendgrid') {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY is required when using SendGrid');
    }
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net', 
      port: 587, 
      secure: false,
      auth: { 
        user: 'apikey', 
        pass: process.env.SENDGRID_API_KEY 
      }
    });
  }
  
  if (process.env.EMAIL_SERVICE === 'smtp') {
    if (!process.env.SMTP_HOST) {
      throw new Error('SMTP_HOST is required when using SMTP service');
    }
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST, 
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { 
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASSWORD 
      }
    });
  }
  
  // Default to Gmail
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { 
      user: process.env.EMAIL_USER, 
      pass: process.env.EMAIL_PASSWORD 
    }
  });
};

let transporter;
try {
  transporter = createTransporter();
  console.log('✅ Email transporter created successfully');
} catch (error) {
  console.error('❌ Failed to create email transporter:', error.message);
  // Create a dummy transporter that will fail gracefully
  transporter = null;
}

const formatCurrency = (amount) => `₹${amount.toLocaleString('en-IN')}`;

// --- Helper: Generate Product Table HTML ---
const generateOrderTable = (order) => {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <div style="font-weight: bold; color: #333;">${item.name}</div>
        <div style="font-size: 12px; color: #777;">
          ${item.selectedSize ? `Size: ${item.selectedSize}` : ''} 
          ${item.selectedColor ? `| Color: ${item.selectedColor}` : ''}
        </div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th style="padding: 10px; text-align: left; color: #555;">Item</th>
          <th style="padding: 10px; text-align: center; color: #555;">Qty</th>
          <th style="padding: 10px; text-align: right; color: #555;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold; color: #555;">Subtotal:</td>
          <td style="padding: 10px; text-align: right;">${formatCurrency(order.subtotal || order.totalAmount)}</td>
        </tr>
        ${order.shippingCost > 0 ? `
        <tr>
          <td colspan="2" style="padding: 5px 10px; text-align: right; color: #555;">Shipping:</td>
          <td style="padding: 5px 10px; text-align: right;">${formatCurrency(order.shippingCost)}</td>
        </tr>` : ''}
        <tr>
          <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold; font-size: 16px; color: #333; border-top: 2px solid #eee;">Total:</td>
          <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 16px; color: #333; border-top: 2px solid #eee;">${formatCurrency(order.totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
  `;
};

// --- Templates ---
const emailTemplates = {
  
  // 1. Order Confirmation
  orderConfirmation: (order) => ({
    subject: `Order Confirmed: #${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; background-color: #ffffff;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-family: serif; font-size: 24px;">Book Store</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">Thank you for your order!</h2>
          <p style="color: #555; line-height: 1.6;">
            Hi <strong>${order.shippingAddress.name}</strong>,<br>
            We have received your order and are currently processing it. Here are the details:
          </p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #555;"><strong>Order ID:</strong> ${order.orderNumber}</p>
            <p style="margin: 5px 0 0; font-size: 14px; color: #555;"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          </div>

          <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; color: #333;">Order Summary</h3>
          ${generateOrderTable(order)}

          <div style="margin-top: 30px;">
            <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; color: #333;">Shipping Address</h3>
            <p style="color: #555; line-height: 1.5; font-size: 14px;">
              ${order.shippingAddress.name}<br>
              ${order.shippingAddress.address}<br>
              ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}<br>
              Phone: ${order.shippingAddress.phone}
            </p>
          </div>
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          &copy; ${new Date().getFullYear()} BookStore Collections. All rights reserved.
        </div>
      </div>
    `
  }),

  // 2. Order Shipped (With Tracking Box)
  orderShipped: (order) => ({
    subject: `Your Order #${order.orderNumber} has Shipped!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; background-color: #ffffff;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-family: serif; font-size: 24px;">Book Store</h1>
        </div>
        
        <div style="padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">On its way! 🚚</h2>
          <p style="color: #555; line-height: 1.6;">
            Great news, <strong>${order.shippingAddress.name}</strong>! Your order has been dispatched and is making its way to you.
          </p>
          
          <div style="border: 1px solid #b3e5fc; background-color: #e1f5fe; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="font-size: 14px; color: #0277bd; padding-bottom: 5px;"><strong>Status:</strong> Shipped</td>
              </tr>
              ${order.trackingDetails && order.trackingDetails.courierName ? `
              <tr>
                <td style="font-size: 14px; color: #0277bd; padding-bottom: 5px;">
                  <strong>Courier:</strong> ${order.trackingDetails.courierName}
                </td>
              </tr>` : ''}
              ${order.trackingDetails && order.trackingDetails.trackingId ? `
              <tr>
                <td style="font-size: 14px; color: #0277bd; padding-top: 10px; border-top: 1px solid #b3e5fc;">
                  <strong>Tracking Number:</strong> <span style="font-family: monospace; font-size: 16px;">${order.trackingDetails.trackingId}</span>
                </td>
              </tr>` : ''}
            </table>
          </div>

          <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; color: #333;">Items in this Shipment</h3>
          ${generateOrderTable(order)}

          <p style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
            Please note: Tracking information may take up to 24 hours to update on the courier's website.
          </p>
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          &copy; ${new Date().getFullYear()} Book Store Collections.
        </div>
      </div>
    `
  }),

  // 3. Order Delivered
  orderDelivered: (order) => ({
    subject: `Delivered: Order #${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; background-color: #ffffff;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-family: serif; font-size: 24px;"Book Store</h1>
        </div>
        <div style="padding: 30px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 40px;">🎉</span>
          </div>
          <h2 style="color: #333; margin-top: 0; text-align: center;">Your Order has Arrived!</h2>
          <p style="color: #555; line-height: 1.6;">
            Hi <strong>${order.shippingAddress.name}</strong>,<br>
            Your order <strong>${order.orderNumber}</strong> has been marked as delivered. We hope you love your purchase!
          </p>

          <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; color: #333; margin-top: 30px;">Recap of your Order</h3>
          ${generateOrderTable(order)}

        </div>
      </div>
    `
  }),

  // 4. Order Cancelled
  orderCancelled: (order) => ({
    subject: `Order Cancelled: #${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; background-color: #ffffff;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-family: serif; font-size: 24px;">Book Store</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #d32f2f; margin-top: 0;">Order Cancelled</h2>
          <p style="color: #555; line-height: 1.6;">
            Hi <strong>${order.shippingAddress.name}</strong>,<br>
            As requested, your order <strong>${order.orderNumber}</strong> has been cancelled.
          </p>

          ${order.paymentStatus === 'completed' || order.paymentStatus === 'paid' ? `
          <div style="background-color: #fff3e0; border: 1px solid #ffe0b2; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #e65100; font-weight: bold;">Refund Initiated</p>
            <p style="margin: 5px 0 0; color: #555; font-size: 14px;">
              Since you have already paid, a refund of <strong>${formatCurrency(order.totalAmount)}</strong> has been initiated to your original payment method. It usually takes 5-7 business days to reflect.
            </p>
          </div>` : ''}

          <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; color: #333;">Cancelled Items</h3>
          ${generateOrderTable(order)}

          <p style="color: #555; margin-top: 20px;">
            We hope to serve you again in the future.
          </p>
        </div>
      </div>
    `
  }),

  // 5. Admin Notification
  adminNotification: (order) => ({
    subject: `[New Order] ${order.orderNumber} - ${formatCurrency(order.totalAmount)}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc;">
        <h2>New Order Received</h2>
        <p><strong>Customer:</strong> ${order.user?.name || order.shippingAddress.name} (${order.user?.email || order.customerEmail})</p>
        <p><strong>Order ID:</strong> ${order.orderNumber}</p>
        <p><strong>Payment:</strong> ${order.paymentMethod.toUpperCase()} (${order.paymentStatus})</p>
        
        <h3>Order Details</h3>
        ${generateOrderTable(order)}
        
        <p style="margin-top: 20px;">
          <a href="${process.env.FRONTEND_URL}/admin/orders/${order._id}" style="background: #333; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">View in Dashboard</a>
        </p>
      </div>
    `
  }),

  paymentConfirmed: (order) => ({
    subject: `Payment Receipt - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Payment Confirmed</h2>
        <p>We have received a payment of <strong>${formatCurrency(order.totalAmount)}</strong> for order #${order.orderNumber}.</p>
      </div>
    `
  }),
};

// ✅ IMPROVED: Enhanced sending logic with better error handling
const sendEmail = async (to, template, data) => {
  // Check if transporter is available
  if (!transporter) {
    const error = 'Email transporter not initialized. Check EMAIL_USER and EMAIL_PASSWORD environment variables.';
    console.error(`❌ ${error}`);
    return { success: false, error };
  }

  // Validate recipient email
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    const error = `Invalid recipient email: ${to}`;
    console.error(`❌ ${error}`);
    return { success: false, error };
  }

  try {
    console.log(`📧 Preparing to send ${template} email to ${to}...`);
    
    const emailData = emailTemplates[template](data);
    
    if (!emailData) {
      const error = `Email template "${template}" not found`;
      console.error(`❌ ${error}`);
      return { success: false, error };
    }

    const mailOptions = {
      from: { 
        name: process.env.EMAIL_FROM_NAME || 'Book Store Collections', 
        address: process.env.EMAIL_USER 
      },
      to, 
      subject: emailData.subject, 
      html: emailData.html
    };

    console.log(`📧 Sending email with subject: "${emailData.subject}"`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
    
    return { 
      success: true, 
      messageId: info.messageId,
      response: info.response 
    };
    
  } catch (error) {
    console.error(`❌ Email error for ${template} to ${to}:`, error.message);
    console.error('Full error:', error);
    
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      command: error.command 
    };
  }
};

// ✅ Export functions with proper error handling
module.exports = {
  sendEmail,
  
  sendOrderConfirmation: async (order) => {
    const email = order.user?.email || order.customerEmail;
    console.log(`📧 sendOrderConfirmation called for order ${order.orderNumber} to ${email}`);
    return sendEmail(email, 'orderConfirmation', order);
  },
  
  sendPaymentConfirmed: async (order) => {
    const email = order.user?.email || order.customerEmail;
    console.log(`📧 sendPaymentConfirmed called for order ${order.orderNumber} to ${email}`);
    return sendEmail(email, 'paymentConfirmed', order);
  },
  
  sendOrderShipped: async (order) => {
    const email = order.user?.email || order.customerEmail;
    console.log(`📧 sendOrderShipped called for order ${order.orderNumber} to ${email}`);
    return sendEmail(email, 'orderShipped', order);
  },
  
  sendOrderDelivered: async (order) => {
    const email = order.user?.email || order.customerEmail;
    console.log(`📧 sendOrderDelivered called for order ${order.orderNumber} to ${email}`);
    return sendEmail(email, 'orderDelivered', order);
  },
  
  sendOrderCancelled: async (order) => {
    const email = order.user?.email || order.customerEmail;
    console.log(`📧 sendOrderCancelled called for order ${order.orderNumber} to ${email}`);
    return sendEmail(email, 'orderCancelled', order);
  },
  
  sendAdminNotification: async (order) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('⚠️  ADMIN_EMAIL not set in environment variables, skipping admin notification');
      return { success: false, error: 'ADMIN_EMAIL not configured' };
    }
    console.log(`📧 sendAdminNotification called for order ${order.orderNumber} to ${adminEmail}`);
    return sendEmail(adminEmail, 'adminNotification', order);
  }
};