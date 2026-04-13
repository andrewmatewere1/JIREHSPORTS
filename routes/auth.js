// routes/auth.js
// Login endpoints for Admin, Partner (Pharmacy), and Assessor

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../database/db");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// ============================================================
// POST /api/auth/admin/login
// ============================================================
router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  console.log("LOGIN BODY:", req.body);// thiw...

  if (!username || !password) return res.status(400).json({ error: "Username and password required." });

  try {
    const result = await pool.query("SELECT * FROM admins WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });

    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const token = signToken({ id: admin.id, role: "admin", username: admin.username });
    res.json({ token, role: "admin", username: admin.username });

  } catch (err) {
  console.error("🔥 LOGIN ERROR:", err); // 👈 ADD THIS LINE

  res.status(500).json({
    error: err.message || "Server error."
  });
}
});

// ============================================================
// POST /api/auth/partner/login
// ============================================================
router.post("/partner/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required." });

  try {
    const result = await pool.query("SELECT * FROM partners WHERE email = $1 AND is_active = true", [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });

    const partner = result.rows[0];
    const valid = await bcrypt.compare(password, partner.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const token = signToken({ id: partner.id, role: "partner", clinicName: partner.clinic_name });
    res.json({
      token,
      role: "partner",
      clinicName: partner.clinic_name,
      tokenBalance: partner.token_balance,
    });

  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// POST /api/auth/assessor/login
// ============================================================
router.post("/assessor/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required." });

  try {
    const result = await pool.query("SELECT * FROM assessors WHERE email = $1 AND is_active = true", [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });

    const assessor = result.rows[0];
    const valid = await bcrypt.compare(password, assessor.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const token = signToken({ id: assessor.id, role: "assessor", name: assessor.name });
    res.json({ token, role: "assessor", name: assessor.name });

  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
