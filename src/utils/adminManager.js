const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

class AdminManager {
  constructor() {
    this.conn = null;
  }

  async connect() {
    if (!this.conn) {
      this.conn = await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    }
    return this.conn;
  }

  async disconnect() {
    if (this.conn) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
      this.conn = null;
    }
  }

  async createAdmin(email, password, name = 'Admin User') {
    await this.connect();

    // Check if admin with this email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error(`User with email ${email} already exists`);
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const admin = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      phone: '0000000000'
    });

    console.log('✅ Admin created successfully');
    console.log('═══════════════════════════════════════');
    console.log(`   ID: ${admin._id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log('═══════════════════════════════════════');

    return admin;
  }

  async listAdmins() {
    await this.connect();
    const admins = await User.find({ role: 'admin' })
      .select('name email phone createdAt updatedAt');

    if (admins.length === 0) {
      console.log('ℹ️ No admin users found');
      return [];
    }

    console.log(`\n📋 Found ${admins.length} admin user(s):`);
    console.log('═══════════════════════════════════════════════════════════════════════════════════════');
    console.log('ID                      | Email                 | Name                  | Created');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════');

    admins.forEach(admin => {
      const created = new Date(admin.createdAt).toLocaleDateString();
      console.log(`${admin._id.toString().padEnd(23)} | ${admin.email.padEnd(21)} | ${admin.name.padEnd(21)} | ${created}`);
    });

    console.log('═══════════════════════════════════════════════════════════════════════════════════════');
    return admins;
  }

  async resetAdminPassword(email, newPassword) {
    await this.connect();

    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) {
      throw new Error(`Admin with email ${email} not found`);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    admin.password = await bcrypt.hash(newPassword, salt);
    admin.updatedAt = new Date();
    await admin.save();

    console.log('✅ Admin password reset successfully');
    console.log(`   Email: ${admin.email}`);

    return admin;
  }

  async deleteAdmin(email) {
    await this.connect();

    const admin = await User.findOneAndDelete({ email, role: 'admin' });
    if (!admin) {
      throw new Error(`Admin with email ${email} not found`);
    }

    console.log('✅ Admin deleted successfully');
    console.log(`   Email: ${admin.email}`);

    return admin;
  }

  async checkAdmin(email) {
    await this.connect();

    const admin = await User.findOne({ email }).select('_id email name role');
    
    if (!admin) {
      console.log(`ℹ️ No user found with email: ${email}`);
      return null;
    }

    if (admin.role === 'admin') {
      console.log('✅ User is an admin');
    } else {
      console.log(`ℹ️ User found, but role is: ${admin.role}`);
    }

    console.log(`   ID: ${admin._id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Role: ${admin.role}`);

    return admin;
  }

  async verifyAdminLogin(email, password) {
    await this.connect();

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    if (user.role !== 'admin') {
      throw new Error('User is not an admin');
    }

    console.log('✅ Admin login verified successfully');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   ID: ${user._id}`);

    return user;
  }
}

const commands = {
  'seed': async (manager) => {
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@sareestore.com';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@2024';
    await manager.createAdmin(email, password, 'System Administrator');
  },

  'create': async (manager, args) => {
    if (args.length < 2) {
      console.error('❌ Usage: node adminManager.js create <email> <password> [name]');
      return;
    }
    const [email, password, ...nameParts] = args;
    const name = nameParts.join(' ') || 'Admin User';
    await manager.createAdmin(email, password, name);
  },

  'list': async (manager) => {
    await manager.listAdmins();
  },

  'reset': async (manager, args) => {
    if (args.length !== 2) {
      console.error('❌ Usage: node adminManager.js reset <email> <new_password>');
      return;
    }
    const [email, newPassword] = args;
    await manager.resetAdminPassword(email, newPassword);
  },

  'delete': async (manager, args) => {
    if (args.length !== 1) {
      console.error('❌ Usage: node adminManager.js delete <email>');
      return;
    }
    const [email] = args;
    await manager.deleteAdmin(email);
  },

  'check': async (manager, args) => {
    if (args.length !== 1) {
      console.error('❌ Usage: node adminManager.js check <email>');
      return;
    }
    const [email] = args;
    await manager.checkAdmin(email);
  },

  'verify': async (manager, args) => {
    if (args.length !== 2) {
      console.error('❌ Usage: node adminManager.js verify <email> <password>');
      return;
    }
    const [email, password] = args;
    await manager.verifyAdminLogin(email, password);
  }
};

const showHelp = () => {
  console.log('\n👤 Admin Manager - Saree E-Commerce Platform');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Usage: node adminManager.js <command> [arguments]');
  console.log('\nCommands:');
  console.log('  seed        Create default admin from env vars');
  console.log('  create      Create a new admin (email password [name])');
  console.log('  list        List all admin users');
  console.log('  reset       Reset admin password (email new_password)');
  console.log('  delete      Delete an admin user (email)');
  console.log('  check       Check if user exists and role (email)');
  console.log('  verify      Verify admin login credentials (email password)');
  console.log('  help        Show this help message');
  console.log('\nExamples:');
  console.log('  node adminManager.js seed');
  console.log('  node adminManager.js create admin@example.com SecurePass123 "Super Admin"');
  console.log('  node adminManager.js list');
  console.log('  node adminManager.js reset admin@example.com NewPass456');
  console.log('  node adminManager.js verify admin@example.com CheckPass');
  console.log('═══════════════════════════════════════════════════════\n');
};

// Main execution
const execute = async () => {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  if (!commands[command]) {
    console.error(`❌ Unknown command: ${command}`);
    showHelp();
    return;
  }

  const manager = new AdminManager();

  try {
    await commands[command](manager, args);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await manager.disconnect();
  }
};

// Run if called directly
if (require.main === module) {
  execute().catch(console.error);
}

module.exports = AdminManager;