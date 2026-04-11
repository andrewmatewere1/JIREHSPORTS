#!/usr/bin/env node
// manage-partners.js
// Usage: node manage-partners.js <action> <email> <password> [clinic_name] [token_balance]
// Actions: create, reset

require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./database/db");

async function createPartner(email, password, clinicName, tokenBalance = 100) {
  try {
    console.log(`🔄 Creating partner: ${email}`);
    
    // Check if exists
    const check = await pool.query("SELECT id FROM partners WHERE email = $1", [email]);
    if (check.rows.length > 0) {
      console.log(`❌ Partner with email "${email}" already exists`);
      process.exit(1);
    }

    // Generate bcrypt hash
    const hash = await bcrypt.hash(password, 12);

    // Create partner
    const result = await pool.query(
      `INSERT INTO partners (clinic_name, email, password_hash, token_balance, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, clinic_name, email, token_balance`,
      [clinicName || "Clinic", email, hash, tokenBalance]
    );

    const partner = result.rows[0];
    console.log(`✅ Partner created successfully!`);
    console.log(`   ID: ${partner.id}`);
    console.log(`   Email: ${partner.email}`);
    console.log(`   Clinic: ${partner.clinic_name}`);
    console.log(`   Tokens: ${partner.token_balance}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

async function resetPartnerPassword(email, newPassword) {
  try {
    console.log(`🔄 Resetting password for partner: ${email}`);
    
    // Generate bcrypt hash
    const hash = await bcrypt.hash(newPassword, 12);

    // Update password
    const result = await pool.query(
      "UPDATE partners SET password_hash = $1 WHERE email = $2 RETURNING id, clinic_name, email",
      [hash, email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Partner with email "${email}" not found`);
      process.exit(1);
    }

    const partner = result.rows[0];
    console.log(`✅ Password updated for: ${partner.clinic_name} (${partner.email})`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

const [action, email, password, clinicName, tokenBalance] = process.argv.slice(2);

if (!action || !email || !password) {
  console.log("\n📝 Usage:");
  console.log("  node manage-partners.js <action> <email> <password> [clinic_name] [token_balance]\n");
  console.log("Actions:");
  console.log("  create - Create new partner");
  console.log("  reset  - Reset existing partner password\n");
  console.log("Examples:");
  console.log("  node manage-partners.js create partner@example.com Pass123 'Apollo Clinic' 50");
  console.log("  node manage-partners.js reset partner@example.com NewPass456\n");
  process.exit(1);
}

if (action === "create") {
  createPartner(email, password, clinicName, parseInt(tokenBalance) || 100);
} else if (action === "reset") {
  resetPartnerPassword(email, password);
} else {
  console.log(`❌ Unknown action: ${action}`);
  console.log("Use 'create' or 'reset'");
  process.exit(1);
}
