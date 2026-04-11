#!/usr/bin/env node
// manage-assessors.js
// Usage: node manage-assessors.js <action> <email> <password> [name]
// Actions: create, reset

require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./database/db");

async function createAssessor(email, password, name) {
  try {
    console.log(`🔄 Creating assessor: ${email}`);
    
    // Check if exists
    const check = await pool.query("SELECT id FROM assessors WHERE email = $1", [email]);
    if (check.rows.length > 0) {
      console.log(`❌ Assessor with email "${email}" already exists`);
      process.exit(1);
    }

    // Generate bcrypt hash
    const hash = await bcrypt.hash(password, 12);

    // Create assessor
    const result = await pool.query(
      `INSERT INTO assessors (name, email, password_hash, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, name, email`,
      [name || "Assessor", email, hash]
    );

    const assessor = result.rows[0];
    console.log(`✅ Assessor created successfully!`);
    console.log(`   ID: ${assessor.id}`);
    console.log(`   Name: ${assessor.name}`);
    console.log(`   Email: ${assessor.email}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

async function resetAssessorPassword(email, newPassword) {
  try {
    console.log(`🔄 Resetting password for assessor: ${email}`);
    
    // Generate bcrypt hash
    const hash = await bcrypt.hash(newPassword, 12);

    // Update password
    const result = await pool.query(
      "UPDATE assessors SET password_hash = $1 WHERE email = $2 RETURNING id, name, email",
      [hash, email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Assessor with email "${email}" not found`);
      process.exit(1);
    }

    const assessor = result.rows[0];
    console.log(`✅ Password updated for: ${assessor.name} (${assessor.email})`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

const [action, email, password, name] = process.argv.slice(2);

if (!action || !email || !password) {
  console.log("\n📝 Usage:");
  console.log("  node manage-assessors.js <action> <email> <password> [name]\n");
  console.log("Actions:");
  console.log("  create - Create new assessor");
  console.log("  reset  - Reset existing assessor password\n");
  console.log("Examples:");
  console.log("  node manage-assessors.js create john@example.com Pass123 'John Doe'");
  console.log("  node manage-assessors.js reset john@example.com NewPass456\n");
  process.exit(1);
}

if (action === "create") {
  createAssessor(email, password, name);
} else if (action === "reset") {
  resetAssessorPassword(email, password);
} else {
  console.log(`❌ Unknown action: ${action}`);
  console.log("Use 'create' or 'reset'");
  process.exit(1);
}
