const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config();

// ✅ Usage:
// 1) Create admin:
//    node src/utils/seedAdmin.js create admin@mail.com Admin123 "Admin Name"
//
// 2) Reset admin password:
//    node src/utils/seedAdmin.js reset admin@mail.com NewPass123
//
// 3) Force delete all admins:
//    node src/utils/seedAdmin.js --force
//
// 4) List all admins:
//    node src/utils/seedAdmin.js list

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("❌ MONGODB_URI missing in backend .env file!");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("✅ Connected to MongoDB");
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
};

const createAdmin = async (email, password, name = "System Administrator") => {
  await connectDB();

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      console.log("❌ User already exists with this email:", email);
      return;
    }

    // ✅ IMPORTANT: Use plain password
    // Schema pre-save will hash automatically
    const adminUser = await User.create({
      name,
      email,
      password,
      role: "admin",
      phone: "0000000000",
    });

    console.log("✅ Admin created successfully!");
    console.log("═══════════════════════════════════════");
    console.log("   Email:", adminUser.email);
    console.log("   Password:", password);
    console.log("   Name:", adminUser.name);
    console.log("═══════════════════════════════════════");
  } finally {
    await disconnectDB();
  }
};

const resetAdminPassword = async (email, newPassword) => {
  await connectDB();

  try {
    const admin = await User.findOne({ email, role: "admin" }).select("+password");

    if (!admin) {
      console.log("❌ Admin not found with email:", email);
      return;
    }

    // ✅ IMPORTANT: assign plain password
    // Schema will hash it automatically on save
    admin.password = newPassword;
    await admin.save();

    console.log("✅ Admin password reset successfully!");
    console.log("═══════════════════════════════════════");
    console.log("   Email:", admin.email);
    console.log("   New Password:", newPassword);
    console.log("═══════════════════════════════════════");
  } finally {
    await disconnectDB();
  }
};

const forceDeleteAdmins = async () => {
  await connectDB();

  try {
    const result = await User.deleteMany({ role: "admin" });
    console.log(`🗑️ Deleted ${result.deletedCount} admin user(s)`);
  } finally {
    await disconnectDB();
  }
};

const listAdmins = async () => {
  await connectDB();

  try {
    const admins = await User.find({ role: "admin" }).select("name email role createdAt");

    if (admins.length === 0) {
      console.log("ℹ️ No admin users found");
      return;
    }

    console.log("\n✅ Admin Users List:");
    console.log("═══════════════════════════════════════");
    admins.forEach((a, i) => {
      console.log(`${i + 1}) ${a.email}  |  ${a.name}`);
    });
    console.log("═══════════════════════════════════════\n");
  } finally {
    await disconnectDB();
  }
};

// ✅ Main CLI Handler
const run = async () => {
  const args = process.argv.slice(2);

  // ✅ Help
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log("\n✅ Admin Seeder Usage:");
    console.log("────────────────────────────────────────────");
    console.log("Create Admin:");
    console.log('  node src/utils/seedAdmin.js create admin@mail.com Admin123 "Admin Name"');
    console.log("");
    console.log("Reset Admin Password:");
    console.log("  node src/utils/seedAdmin.js reset admin@mail.com NewPass123");
    console.log("");
    console.log("List Admins:");
    console.log("  node src/utils/seedAdmin.js list");
    console.log("");
    console.log("Force Delete All Admins:");
    console.log("  node src/utils/seedAdmin.js --force");
    console.log("────────────────────────────────────────────\n");
    return;
  }

  if (args.includes("--force")) {
    await forceDeleteAdmins();
    return;
  }

  const command = args[0];

  if (command === "list") {
    await listAdmins();
    return;
  }

  if (command === "create") {
    const email = args[1];
    const password = args[2];
    const name = args.slice(3).join(" ") || "System Administrator";

    if (!email || !password) {
      console.log('❌ Usage: node src/utils/seedAdmin.js create admin@mail.com Admin123 "Admin Name"');
      return;
    }

    await createAdmin(email, password, name);
    return;
  }

  if (command === "reset") {
    const email = args[1];
    const newPassword = args[2];

    if (!email || !newPassword) {
      console.log("❌ Usage: node src/utils/seedAdmin.js reset admin@mail.com NewPass123");
      return;
    }

    await resetAdminPassword(email, newPassword);
    return;
  }

  console.log("❌ Unknown command:", command);
  console.log("Run: node src/utils/seedAdmin.js --help");
};

run().catch((err) => console.log("❌ Error:", err.message));
