// routes/admin.js
// Admin-only routes: token management, events CMS, partner/assessor management

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../database/db");
const { authenticate, requireAdmin } = require("../middleware/auth");

// All admin routes require authentication
router.use(authenticate, requireAdmin);

// ============================================================
// GET /api/admin/dashboard
// Returns KPI counts for the admin dashboard
// ============================================================
router.get("/dashboard", async (req, res) => {
  try {
    const [players, partners, events, warnings] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'Verified') AS verified,
          COUNT(*) FILTER (WHERE status = 'Pending') AS pending,
          COUNT(*) FILTER (WHERE fitness_grade = 'Green') AS green,
          COUNT(*) FILTER (WHERE fitness_grade = 'Yellow') AS yellow,
          COUNT(*) FILTER (WHERE fitness_grade = 'Red') AS red
        FROM players
      `),
      pool.query("SELECT id, clinic_name, token_balance, is_active FROM partners ORDER BY clinic_name"),
      pool.query("SELECT * FROM events WHERE is_published = true ORDER BY created_at DESC"),
      pool.query(`
        SELECT id, name, official_id, city, position,
          EXTRACT(DAY FROM NOW() - last_tested_date) AS days_since_test
        FROM players
        WHERE fitness_grade = 'Green'
          AND last_tested_date IS NOT NULL
          AND last_tested_date < NOW() - INTERVAL '35 days'
          AND last_tested_date > NOW() - INTERVAL '45 days'
      `),
    ]);

    res.json({
      stats: players.rows[0],
      partners: partners.rows,
      events: events.rows,
      expiryWarnings: warnings.rows,
    });
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

// POST /api/admin/tokens/add
// Add tokens to a pharmacy
router.post("/tokens/add", async (req, res) => {
  const { partnerId, amount } = req.body;

  if (!partnerId || !amount || amount < 1) {
    return res.status(400).json({ error: "Valid partnerId and amount required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE partners SET token_balance = token_balance + $1 WHERE id = $2",
      [amount, partnerId]
    );

    await client.query(`
      INSERT INTO token_transactions (partner_id, change_amount, reason)
      VALUES ($1, $2, 'Admin Top-up')
    `, [partnerId, amount]);

    const result = await client.query(
      "SELECT clinic_name, token_balance FROM partners WHERE id = $1",
      [partnerId]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `+${amount} tokens added to ${result.rows[0].clinic_name}.`,
      newBalance: result.rows[0].token_balance,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Server error." });
  } finally {
    client.release();
  }
});

// GET /api/admin/tokens/history
// Token transaction audit log
router.get("/tokens/history", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        tt.id, tt.change_amount, tt.reason, tt.created_at,
        p.clinic_name, pl.name AS player_name, pl.official_id
      FROM token_transactions tt
      LEFT JOIN partners p ON tt.partner_id = p.id
      LEFT JOIN players pl ON tt.player_id = pl.id
      ORDER BY tt.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// PARTNER MANAGEMENT
// ============================================================

// GET /api/admin/partners
// Get all partners with their details
router.get("/partners", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, clinic_name, email, token_balance, is_active, created_at
      FROM partners
      ORDER BY clinic_name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// POST /api/admin/partners
// Create a new pharmacy partner
router.post("/partners", async (req, res) => {
  const { clinicName, email, password, tokenBalance } = req.body;

  if (!clinicName || !email || !password) {
    return res.status(400).json({ error: "Clinic name, email, and password required." });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(`
      INSERT INTO partners (clinic_name, email, password_hash, token_balance)
      VALUES ($1, $2, $3, $4)
      RETURNING id, clinic_name, email, token_balance, is_active
    `, [clinicName, email, hash, tokenBalance || 0]);

    res.status(201).json({ success: true, partner: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered." });
    res.status(500).json({ error: "Server error." });
  }
});

// PATCH /api/admin/partners/:id/password
// Reset/set password for a partner
router.patch("/partners/:id/password", async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(`
      UPDATE partners SET password_hash = $1 WHERE id = $2
      RETURNING id, clinic_name, email
    `, [hash, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Partner not found." });
    }

    res.json({ success: true, message: `Password updated for ${result.rows[0].clinic_name}.` });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// PATCH /api/admin/partners/:id/toggle
// Activate / deactivate a partner
router.patch("/partners/:id/toggle", async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE partners SET is_active = NOT is_active WHERE id = $1
      RETURNING id, clinic_name, is_active
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Partner not found." });
    }

    res.json({ success: true, ...result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// ASSESSOR MANAGEMENT
// ============================================================

// GET /api/admin/assessors
// Get all assessors
router.get("/assessors", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, is_active, created_at
      FROM assessors
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// POST /api/admin/assessors
// Create a new assessor account
router.post("/assessors", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password required." });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(`
      INSERT INTO assessors (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, is_active
    `, [name, email, hash]);

    res.status(201).json({ success: true, assessor: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered." });
    res.status(500).json({ error: "Server error." });
  }
});

// PATCH /api/admin/assessors/:id/password
// Reset/set password for an assessor
router.patch("/assessors/:id/password", async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(`
      UPDATE assessors SET password_hash = $1 WHERE id = $2
      RETURNING id, name, email
    `, [hash, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assessor not found." });
    }

    res.json({ success: true, message: `Password updated for ${result.rows[0].name}.` });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// PATCH /api/admin/assessors/:id/toggle
// Activate / deactivate an assessor
router.patch("/assessors/:id/toggle", async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE assessors SET is_active = NOT is_active WHERE id = $1
      RETURNING id, name, is_active
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assessor not found." });
    }

    res.json({ success: true, ...result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// EVENTS / NOTICE BOARD
// ============================================================

// GET /api/admin/events
router.get("/events", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// POST /api/admin/events
router.post("/events", async (req, res) => {
  const { title, dates, location, registrationFee } = req.body;
  if (!title || !dates || !location) {
    return res.status(400).json({ error: "Title, dates, and location are required." });
  }

  try {
    const result = await pool.query(`
      INSERT INTO events (title, dates, location, registration_fee)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title, dates, location, registrationFee || "$15 USD"]);

    res.status(201).json({ success: true, event: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// DELETE /api/admin/events/:id
router.delete("/events/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM events WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// SQUAD EXPORT
// Returns full contact details for selected player IDs
// ============================================================
router.post("/squad/export", async (req, res) => {
  const { playerIds } = req.body;

  if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: "Provide an array of player IDs." });
  }

  try {
    const result = await pool.query(`
      SELECT
        name,
        official_id,
        temp_id,
        position,
        city,
        email,
        whatsapp,
        fitness_grade,
        EXTRACT(YEAR FROM AGE(dob)) AS age
      FROM players
      WHERE id = ANY($1)
      ORDER BY name
    `, [playerIds]);

    res.json({
      count: result.rows.length,
      squad: result.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// EMAIL LOGS
// ============================================================
router.get("/email-logs", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT el.*, p.name AS player_name
      FROM email_logs el
      LEFT JOIN players p ON el.player_id = p.id
      ORDER BY el.sent_at DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
