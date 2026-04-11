// routes/public.js
// Publicly accessible routes — no auth required

const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const { authenticate, requirePartner } = require("../middleware/auth");

// ============================================================
// GET /api/public/events
// Notice board — all published events
// ============================================================
router.get("/events", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM events WHERE is_published = true ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// GET /api/public/roster
// Active roster — verified + green players (teaser data only)
// ============================================================
router.get("/roster", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        official_id,
        SPLIT_PART(name, ' ', 1) || ' ' || LEFT(SPLIT_PART(name, ' ', 2), 1) || '.' AS display_name,
        position,
        city,
        fitness_grade,
        last_tested_date
      FROM players
      WHERE status = 'Verified'
      ORDER BY last_tested_date DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// GET /api/public/stats
// Public-facing stats for landing page
// ============================================================
router.get("/stats", async (req, res) => {
  try {
    const [players, events] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'Verified') AS verified_count,
          COUNT(*) FILTER (WHERE fitness_grade = 'Green') AS green_count
        FROM players
      `),
      pool.query("SELECT COUNT(*) AS event_count FROM events WHERE is_published = true"),
    ]);

    res.json({
      verifiedPlayers: parseInt(players.rows[0].verified_count),
      greenPlayers: parseInt(players.rows[0].green_count),
      upcomingEvents: parseInt(events.rows[0].event_count),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// GET /api/public/partner/balance
// PROTECTED (partner) — Get their current token balance
// ============================================================
router.get("/partner/balance", authenticate, requirePartner, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT token_balance, clinic_name FROM partners WHERE id = $1",
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
