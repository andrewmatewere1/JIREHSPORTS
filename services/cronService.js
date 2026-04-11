// services/cronService.js
// Automated background jobs — runs without any human admin work

const cron = require("node-cron");
const pool = require("../database/db");
const {
  sendExpiryWarningEmail,
  sendStatusExpiredEmail,
} = require("./emailService");

// ============================================================
// JOB 1: 35-DAY WARNING CHECK
// Runs every day at 8:00 AM
// Finds Green players whose last_tested_date is exactly 35 days ago
// Sends a "10 days left" warning email
// ============================================================
function startExpiryWarningJob() {
  cron.schedule("0 8 * * *", async () => {
    console.log("🕐 [CRON] Running 35-day expiry warning check...");

    try {
      // Find all Green players who hit the 35-day mark today
      // We check a 24-hour window to avoid missing anyone
      const result = await pool.query(`
        SELECT * FROM players
        WHERE fitness_grade = 'Green'
          AND status = 'Verified'
          AND last_tested_date IS NOT NULL
          AND last_tested_date::date = (CURRENT_DATE - INTERVAL '35 days')::date
      `);

      if (result.rows.length === 0) {
        console.log("✅ [CRON] No expiry warnings needed today.");
        return;
      }

      console.log(`⚠️  [CRON] Sending expiry warnings to ${result.rows.length} player(s)...`);

      for (const player of result.rows) {
        await sendExpiryWarningEmail(player);
        console.log(`   → Warning sent to ${player.name} (${player.official_id})`);
      }

    } catch (err) {
      console.error("❌ [CRON] Expiry warning job failed:", err.message);
    }
  });

  console.log("⏰ CRON: Expiry warning job scheduled (daily 08:00)");
}

// ============================================================
// JOB 2: 45-DAY AUTO-DOWNGRADE
// Runs every day at 8:05 AM
// Finds Green players whose last_tested_date > 45 days ago
// Downgrades them to Yellow and sends notification email
// ============================================================
function startAutoDowngradeJob() {
  cron.schedule("5 8 * * *", async () => {
    console.log("🕐 [CRON] Running 45-day auto-downgrade check...");

    try {
      // Find Green players past 45 days
      const result = await pool.query(`
        SELECT * FROM players
        WHERE fitness_grade = 'Green'
          AND status = 'Verified'
          AND last_tested_date IS NOT NULL
          AND last_tested_date < NOW() - INTERVAL '45 days'
      `);

      if (result.rows.length === 0) {
        console.log("✅ [CRON] No downgrades needed today.");
        return;
      }

      console.log(`🔴 [CRON] Downgrading ${result.rows.length} player(s) from Green → Yellow...`);

      for (const player of result.rows) {
        // Downgrade in database
        await pool.query(`
          UPDATE players
          SET fitness_grade = 'Yellow', updated_at = NOW()
          WHERE id = $1
        `, [player.id]);

        // Send expiry email
        await sendStatusExpiredEmail(player);
        console.log(`   → Downgraded: ${player.name} (${player.official_id})`);
      }

    } catch (err) {
      console.error("❌ [CRON] Auto-downgrade job failed:", err.message);
    }
  });

  console.log("⏰ CRON: Auto-downgrade job scheduled (daily 08:05)");
}

// ============================================================
// EXPORT: Start all CRON jobs
// ============================================================
function startAllCronJobs() {
  startExpiryWarningJob();
  startAutoDowngradeJob();
  console.log("✅ All CRON jobs active.\n");
}

module.exports = { startAllCronJobs };
