#!/usr/bin/env node
// reset-admin-password.js
// Usage: node reset-admin-password.js <username> <new_password>

require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./database/db");

async function resetPassword(username, newPassword) {
  try {
    console.log(`🔄 Resetting password for admin: ${username}`);
    
    // Generate bcrypt hash
    const hash = await bcrypt.hash(newPassword, 12);
    console.log(`✅ Generated hash: ${hash}`);

    // Update in database
    const result = await pool.query(
      "UPDATE admins SET password_hash = $1 WHERE username = $2 RETURNING id, username",
      [hash, username]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Admin username "${username}" not found in database`);
      process.exit(1);
    }

    console.log(`✅ Password updated successfully for: ${result.rows[0].username}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Database Error:", err.message);
    process.exit(1);
  }
}

// Get arguments
const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.log("\n📝 Usage:");
  console.log("  node reset-admin-password.js <username> <password>\n");
  console.log("Example:");
  console.log("  node reset-admin-password.js admin MyNewPassword123\n");
  process.exit(1);
}

resetPassword(username, password);
