// routes/players.js
// All player-related API endpoints

const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const { authenticate, requireAssessor, requirePartner, requireAdmin } = require("../middleware/auth");
const { sendWelcomeEmail, sendParentCourtesyEmail, sendGreenGradeEmail, sendYellowGradeEmail } = require("../services/emailService");

// ============================================================
// HELPER: Generate temporary APP ID
// ============================================================
function generateAppId() {
  return "APP-" + Math.floor(1000 + Math.random() * 9000);
}

// ============================================================
// HELPER: Generate permanent JRH ID
// ============================================================
async function generateJrhId() {
  const result = await pool.query(
    "SELECT COUNT(*) FROM players WHERE official_id IS NOT NULL"
  );
  const count = parseInt(result.rows[0].count) + 1;
  return "JRH-" + String(count).padStart(4, "0");
}

// ============================================================
// HELPER: Calculate age from DOB
// ============================================================
function calcAge(dob) {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

// ============================================================
// POST /api/players/apply
// PUBLIC — Intake chatbot form submission
// ============================================================
router.post("/apply", async (req, res) => {
  const { name, dob, city, position, email, whatsapp, parentEmail } = req.body;

  // Validate required fields
  if (!name || !dob || !city || !position || !email || !whatsapp) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // Check if email already applied
  const existing = await pool.query(
    "SELECT id FROM players WHERE email = $1",
    [email]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "An application with this email already exists." });
  }

  // Generate unique APP ID (retry if collision)
  let tempId;
  let isUnique = false;
  while (!isUnique) {
    tempId = generateAppId();
    const check = await pool.query("SELECT id FROM players WHERE temp_id = $1", [tempId]);
    if (check.rows.length === 0) isUnique = true;
  }

  // Determine if under 18
  const age = calcAge(dob);
  const isMinor = age < 18;
  const guardianEmail = isMinor ? parentEmail : null;

  if (isMinor && !parentEmail) {
    return res.status(400).json({ error: "Parent/guardian email is required for players under 18." });
  }

  try {
    const result = await pool.query(`
      INSERT INTO players (temp_id, name, dob, city, position, email, whatsapp, parent_email, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')
      RETURNING *
    `, [tempId, name, dob, city, position, email, whatsapp, guardianEmail]);

    const player = result.rows[0];

    // Fire emails asynchronously (don't block the response)
    sendWelcomeEmail(player).catch(console.error);
    if (isMinor) {
      sendParentCourtesyEmail(player).catch(console.error);
    }

    res.status(201).json({
      success: true,
      message: "Application received.",
      tempId: player.temp_id,
      isMinor,
    });

  } catch (err) {
    console.error("Apply error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ============================================================
// GET /api/players/public/:id
// PUBLIC — Teaser profile for sharing (JRH-XXXX only)
// Returns: Name (last initial), position, city, grade, badge
// NEVER returns: phone, exact DOB, medical data
// ============================================================
router.get("/public/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        official_id,
        SPLIT_PART(name, ' ', 1) || ' ' || LEFT(SPLIT_PART(name, ' ', 2), 1) || '.' AS display_name,
        position,
        city,
        status,
        fitness_grade,
        last_tested_date,
        EXTRACT(YEAR FROM AGE(dob)) AS age
      FROM players
      WHERE official_id = $1 AND status = 'Verified'
    `, [req.params.id.toUpperCase()]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found or not yet verified." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// GET /api/players/search/:query
// PROTECTED (partner + assessor) — Search by APP or JRH ID
// ============================================================
router.get("/search/:query", authenticate, async (req, res) => {
  const query = req.params.query.toUpperCase();

  try {
    const result = await pool.query(`
      SELECT
        id, temp_id, official_id, name, dob, city, position,
        email, whatsapp, status, fitness_grade, last_tested_date,
        height_cm, weight_kg, blood_pressure,
        EXTRACT(YEAR FROM AGE(dob)) AS age
      FROM players
      WHERE temp_id = $1 OR official_id = $1
    `, [query]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// PUT /api/players/:id/verify
// PROTECTED (partner only) — Pharmacy verification flow
// ============================================================
router.put("/:id/verify", authenticate, requirePartner, async (req, res) => {
  const { heightCm, weightKg, bloodPressure } = req.body;
  const partnerId = req.user.id;

  if (!heightCm || !weightKg || !bloodPressure) {
    return res.status(400).json({ error: "All vitals are required: height, weight, blood pressure." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check partner token balance
    const partnerResult = await client.query(
      "SELECT * FROM partners WHERE id = $1 FOR UPDATE",
      [partnerId]
    );

    if (partnerResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Partner not found." });
    }

    const partner = partnerResult.rows[0];

    if (partner.token_balance <= 0) {
      await client.query("ROLLBACK");
      return res.status(402).json({
        error: "Zero Verification Credits remaining. Please contact Jireh.",
        tokenBalance: 0
      });
    }

    // Get player
    const playerResult = await client.query(
      "SELECT * FROM players WHERE id = $1",
      [req.params.id]
    );

    if (playerResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Player not found." });
    }

    const player = playerResult.rows[0];

    if (player.status === "Verified") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Player is already verified." });
    }

    // Generate JRH ID
    const officialId = await generateJrhId();

    // Update player
    await client.query(`
      UPDATE players SET
        official_id = $1,
        temp_id = NULL,
        status = 'Verified',
        height_cm = $2,
        weight_kg = $3,
        blood_pressure = $4,
        verified_by = $5,
        verified_at = NOW(),
        updated_at = NOW()
      WHERE id = $6
    `, [officialId, heightCm, weightKg, bloodPressure, partnerId, player.id]);

    // Deduct 1 token from partner
    await client.query(
      "UPDATE partners SET token_balance = token_balance - 1 WHERE id = $1",
      [partnerId]
    );

    // Log token transaction
    await client.query(`
      INSERT INTO token_transactions (partner_id, change_amount, reason, player_id)
      VALUES ($1, -1, 'Player Verification', $2)
    `, [partnerId, player.id]);

    await client.query("COMMIT");

    // Fetch updated player for email
    const updatedPlayer = { ...player, official_id: officialId, status: "Verified" };

    res.json({
      success: true,
      message: "Player verified successfully.",
      officialId,
      tokensRemaining: partner.token_balance - 1,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Verify error:", err.message);
    res.status(500).json({ error: "Server error during verification." });
  } finally {
    client.release();
  }
});

// ============================================================
// PUT /api/players/:id/grade
// PROTECTED (assessor only) — Submit fitness grade
// ============================================================
router.put("/:id/grade", authenticate, requireAssessor, async (req, res) => {
  const { fitnessGrade, sprint40m, verticalJumpCm, assessorNotes } = req.body;

  if (!["Green", "Yellow", "Red"].includes(fitnessGrade)) {
    return res.status(400).json({ error: "Grade must be Green, Yellow, or Red." });
  }

  try {
    const playerResult = await pool.query(
      "SELECT * FROM players WHERE id = $1",
      [req.params.id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: "Player not found." });
    }

    const player = playerResult.rows[0];

    await pool.query(`
      UPDATE players SET
        fitness_grade = $1,
        last_tested_date = NOW(),
        sprint_40m = $2,
        vertical_jump_cm = $3,
        assessor_notes = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [fitnessGrade, sprint40m || null, verticalJumpCm || null, assessorNotes || null, player.id]);

    // Send grade email (only for verified players)
    if (player.status === "Verified") {
      const updatedPlayer = { ...player, fitness_grade: fitnessGrade };
      if (fitnessGrade === "Green") {
        sendGreenGradeEmail(updatedPlayer).catch(console.error);
      } else if (fitnessGrade === "Yellow") {
        sendYellowGradeEmail(updatedPlayer).catch(console.error);
      }
    }

    res.json({
      success: true,
      message: `Player graded ${fitnessGrade}. Timestamp logged.`,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error("Grade error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// GET /api/players
// PROTECTED (admin only) — Full player list with filters
// ============================================================
router.get("/", authenticate, requireAdmin, async (req, res) => {
  const { position, fitnessGrade, ageGroup, status } = req.query;

  let conditions = [];
  let params = [];
  let i = 1;

  if (position) { conditions.push(`position = $${i++}`); params.push(position); }
  if (fitnessGrade) { conditions.push(`fitness_grade = $${i++}`); params.push(fitnessGrade); }
  if (status) { conditions.push(`status = $${i++}`); params.push(status); }
  if (ageGroup === "u18") { conditions.push(`EXTRACT(YEAR FROM AGE(dob)) < 18`); }
  if (ageGroup === "18-21") { conditions.push(`EXTRACT(YEAR FROM AGE(dob)) BETWEEN 18 AND 21`); }
  if (ageGroup === "22+") { conditions.push(`EXTRACT(YEAR FROM AGE(dob)) >= 22`); }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  try {
    const result = await pool.query(`
      SELECT
        id, temp_id, official_id, name, dob, city, position,
        email, whatsapp, parent_email, status, fitness_grade,
        last_tested_date, height_cm, weight_kg, blood_pressure,
        EXTRACT(YEAR FROM AGE(dob)) AS age,
        NOW() - last_tested_date AS days_since_test
      FROM players
      ${where}
      ORDER BY created_at DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error("Players list error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
