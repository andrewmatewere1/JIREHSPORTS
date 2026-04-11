// services/emailService.js
// All automated email triggers for Jireh Sports Management

const nodemailer = require("nodemailer");
const pool = require("../database/db");

// ============================================================
// TRANSPORTER SETUP
// ============================================================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ============================================================
// EMAIL TEMPLATE WRAPPER
// ============================================================
function wrapTemplate(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a1628; font-family: Arial, sans-serif; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #d4a017; padding: 24px 32px; text-align: center; }
    .header h1 { color: #0a1628; font-size: 28px; letter-spacing: 4px; font-weight: 900; }
    .header p { color: #0a1628; font-size: 12px; letter-spacing: 2px; margin-top: 4px; opacity: 0.75; }
    .body { background: #111e35; padding: 32px; border-left: 4px solid #d4a017; }
    .id-box { background: #0a1628; border: 2px solid #d4a017; padding: 20px; text-align: center; margin: 24px 0; }
    .id-box .id { font-size: 32px; font-weight: 900; color: #d4a017; letter-spacing: 4px; }
    .id-box .label { font-size: 11px; color: #8899aa; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .cta { background: #d4a017; color: #0a1628; padding: 14px 28px; display: inline-block; font-weight: 700; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; text-decoration: none; margin: 16px 0; }
    p { color: #c8bfaa; font-size: 14px; line-height: 1.7; margin-bottom: 12px; }
    .footer { background: #0a1628; padding: 20px 32px; text-align: center; }
    .footer p { font-size: 11px; color: #445566; }
    .grade-green { color: #22c55e; font-weight: 700; font-size: 18px; }
    .grade-yellow { color: #eab308; font-weight: 700; font-size: 18px; }
    .grade-red { color: #ef4444; font-weight: 700; font-size: 18px; }
    .warning-box { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.4); padding: 16px; margin: 16px 0; }
    .divider { border: none; border-top: 1px solid #1a3260; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>JIREH SPORTS</h1>
      <p>TALENT MANAGEMENT & VERIFICATION SYSTEM</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>© Jireh Sports Management · Automated System · Do not reply to this email</p>
      <p style="margin-top:6px">Talent is everywhere. Verified data is rare.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============================================================
// LOG EMAIL TO DATABASE
// ============================================================
async function logEmail(playerId, toEmail, subject, type, success) {
  try {
    await pool.query(
      `INSERT INTO email_logs (player_id, to_email, subject, type, success)
       VALUES ($1, $2, $3, $4, $5)`,
      [playerId, toEmail, subject, type, success]
    );
  } catch (err) {
    console.error("Failed to log email:", err.message);
  }
}

// ============================================================
// SEND EMAIL HELPER
// ============================================================
async function sendEmail({ to, subject, html, playerId, type }) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent [${type}] → ${to}`);
    await logEmail(playerId, to, subject, type, true);
    return true;
  } catch (err) {
    console.error(`❌ Email failed [${type}] → ${to}:`, err.message);
    await logEmail(playerId, to, subject, type, false);
    return false;
  }
}

// ============================================================
// TRIGGER 1A: WELCOME EMAIL (post-chatbot)
// ============================================================
async function sendWelcomeEmail(player) {
  const subject = `Your Jireh Application Reference — ${player.temp_id}`;

  const html = wrapTemplate(`
    <p>Dear <strong style="color:#f5f0e8">${player.name}</strong>,</p>
    <p>Your application to the Jireh Sports Management verification system has been received.</p>

    <div class="id-box">
      <div class="id">${player.temp_id}</div>
      <div class="label">Your Application Reference Number</div>
    </div>

    <p><strong style="color:#d4a017">NEXT STEP — Visit a Jireh Partner Pharmacy:</strong></p>
    <p>You have <strong style="color:#f5f0e8">14 days</strong> to visit a Jireh Partner Pharmacy with this reference number. They will conduct a baseline medical assessment to complete your verification.</p>

    <hr class="divider">
    <p><strong style="color:#f5f0e8">What to bring:</strong></p>
    <p>✓ This reference number (${player.temp_id})<br>
       ✓ Valid ID or birth certificate<br>
       ✓ Payment for the medical fee (collected by the pharmacy)</p>
    <hr class="divider">

    <p style="color:#6b7280;font-size:12px">
      Name: ${player.name} · Position: ${player.position} · City: ${player.city}
    </p>
    <p style="color:#6b7280;font-size:11px;margin-top:8px">
      ⚠️ This reference expires in 14 days. Do not share it with others.
    </p>
  `);

  await sendEmail({
    to: player.email,
    subject,
    html,
    playerId: player.id,
    type: "welcome",
  });
}

// ============================================================
// TRIGGER 1B: PARENT COURTESY EMAIL (if U18)
// ============================================================
async function sendParentCourtesyEmail(player) {
  if (!player.parent_email) return;

  const subject = `Jireh Sports — Guardian Notification for ${player.name}`;

  const html = wrapTemplate(`
    <p>Dear Guardian,</p>
    <p>This is a professional courtesy notification from <strong style="color:#d4a017">Jireh Sports Management</strong>.</p>
    <p>Your child, <strong style="color:#f5f0e8">${player.name}</strong>, has submitted an application to our youth talent verification program.</p>

    <div class="id-box">
      <div class="id">${player.temp_id}</div>
      <div class="label">Their Application Reference</div>
    </div>

    <p><strong style="color:#d4a017">In accordance with FIFA Youth Protection regulations</strong>, all players under 18 require a guardian on file. Your email has been registered as the responsible guardian for this application.</p>

    <hr class="divider">
    <p>The next step requires ${player.name} to visit a Jireh Partner Pharmacy for a baseline medical assessment within 14 days. This is a non-invasive assessment covering height, weight, and blood pressure only.</p>
    <p>If you have any concerns about this process, please contact us via our official website.</p>
    <hr class="divider">

    <p style="color:#6b7280;font-size:11px">
      If you did not expect this email or believe it was sent in error, please disregard it.
    </p>
  `);

  await sendEmail({
    to: player.parent_email,
    subject,
    html,
    playerId: player.id,
    type: "parent_courtesy",
  });
}

// ============================================================
// TRIGGER 2A: GREEN GRADE EMAIL
// ============================================================
async function sendGreenGradeEmail(player) {
  const subject = `✅ You Meet Standard — Active Trial List | ${player.official_id}`;

  const html = wrapTemplate(`
    <p>Dear <strong style="color:#f5f0e8">${player.name}</strong>,</p>
    <p>Your fitness assessment has been completed and graded by a Jireh assessor.</p>

    <div class="id-box">
      <div class="grade-green">🟢 GREEN — MATCH-FIT</div>
      <div class="label" style="margin-top:8px">${player.official_id} · Assessed ${new Date().toLocaleDateString("en-GB")}</div>
    </div>

    <p>You <strong style="color:#22c55e">meet the Jireh physical standard</strong>. You have been added to the <strong style="color:#f5f0e8">Active Trial List</strong>.</p>
    <p>A Jireh scout or representative may contact you at the WhatsApp number on file when a relevant trial opportunity arises. Ensure your number remains active.</p>

    <hr class="divider">
    <div class="warning-box">
      <p style="color:#eab308;font-size:13px">⚠️ <strong>Important: Green Status Validity</strong></p>
      <p style="font-size:13px">Your Green status is valid for <strong style="color:#f5f0e8">45 days</strong> from your assessment date. After this, your status will be automatically downgraded. Re-test at any Jireh Combine to maintain your standing.</p>
    </div>
    <hr class="divider">

    <p style="color:#6b7280;font-size:12px">
      Position: ${player.position} · City: ${player.city}
    </p>
  `);

  await sendEmail({
    to: player.email,
    subject,
    html,
    playerId: player.id,
    type: "green",
  });
}

// ============================================================
// TRIGGER 2B: YELLOW GRADE EMAIL (with training guide note)
// ============================================================
async function sendYellowGradeEmail(player) {
  const subject = `🟡 Development Plan Required | ${player.official_id}`;

  const html = wrapTemplate(`
    <p>Dear <strong style="color:#f5f0e8">${player.name}</strong>,</p>
    <p>Your fitness assessment has been completed. Here is your result:</p>

    <div class="id-box">
      <div class="grade-yellow">🟡 YELLOW — DEVELOPMENT NEEDED</div>
      <div class="label" style="margin-top:8px">${player.official_id} · Assessed ${new Date().toLocaleDateString("en-GB")}</div>
    </div>

    <p>You do not currently meet the Jireh physical standard for the Active Trial List. This is not a rejection — it is a development flag.</p>

    <hr class="divider">
    <p><strong style="color:#d4a017">YOUR 30-DAY ACTION PLAN:</strong></p>
    <p>
      📋 <strong style="color:#f5f0e8">Week 1–2:</strong> Focus on aerobic base building. 5km runs, 3x per week.<br>
      📋 <strong style="color:#f5f0e8">Week 3:</strong> Introduce interval sprints — 6x40m with 90 seconds rest.<br>
      📋 <strong style="color:#f5f0e8">Week 4:</strong> Position-specific drills and strength conditioning.<br>
      📋 <strong style="color:#f5f0e8">End of Week 4:</strong> Re-test at the next Jireh Combine.
    </p>
    <hr class="divider">

    <p>Check our Notice Board for the next Combine date near <strong style="color:#f5f0e8">${player.city}</strong> and book your re-test.</p>

    <p style="color:#6b7280;font-size:12px;margin-top:16px">
      Position: ${player.position} · City: ${player.city}
    </p>
  `);

  await sendEmail({
    to: player.email,
    subject,
    html,
    playerId: player.id,
    type: "yellow",
  });
}

// ============================================================
// TRIGGER 3A: EXPIRY WARNING (35 days — 10 days to go)
// ============================================================
async function sendExpiryWarningEmail(player) {
  const subject = `⚠️ Your Green Status Expires in 10 Days | ${player.official_id}`;

  const html = wrapTemplate(`
    <p>Dear <strong style="color:#f5f0e8">${player.name}</strong>,</p>

    <div class="warning-box">
      <p style="color:#eab308;font-weight:700;font-size:16px">⚠️ STATUS EXPIRY WARNING</p>
      <p style="color:#f5f0e8;margin-top:8px">Your <strong>Green (Match-Fit)</strong> status expires in <strong>10 days</strong>.</p>
    </div>

    <p>Your last assessment was <strong style="color:#f5f0e8">35 days ago</strong>. Jireh requires a re-test every 45 days to maintain an active Green status on file.</p>
    <p><strong style="color:#d4a017">Action required:</strong> Book a Combine re-test before your status expires and you are removed from the Active Trial List.</p>

    <hr class="divider">
    <p>Visit the Jireh Notice Board to find the next Combine near <strong style="color:#f5f0e8">${player.city}</strong>.</p>

    <p style="color:#6b7280;font-size:12px;margin-top:16px">
      ${player.official_id} · Position: ${player.position}
    </p>
  `);

  await sendEmail({
    to: player.email,
    subject,
    html,
    playerId: player.id,
    type: "expiry_warning",
  });
}

// ============================================================
// TRIGGER 3B: STATUS EXPIRED (45+ days — auto-downgraded)
// ============================================================
async function sendStatusExpiredEmail(player) {
  const subject = `🔴 Green Status Expired — Downgraded to Yellow | ${player.official_id}`;

  const html = wrapTemplate(`
    <p>Dear <strong style="color:#f5f0e8">${player.name}</strong>,</p>

    <div class="id-box">
      <div class="grade-yellow">🟡 YELLOW — EXPIRED DATA</div>
      <div class="label" style="margin-top:8px">Automatically downgraded after 45-day inactivity</div>
    </div>

    <p>Your Green (Match-Fit) status has <strong style="color:#ef4444">automatically expired</strong> because more than 45 days have passed since your last assessment.</p>
    <p>You have been moved from the Active Trial List to Development status. This is a data integrity policy — your fitness record must stay current.</p>

    <hr class="divider">
    <p><strong style="color:#d4a017">To restore your Green status:</strong><br>
       Attend the next Jireh Combine near ${player.city} and complete a full re-assessment with a Jireh Assessor.</p>
    <hr class="divider">

    <p style="color:#6b7280;font-size:12px">
      ${player.official_id} · Position: ${player.position} · City: ${player.city}
    </p>
  `);

  await sendEmail({
    to: player.email,
    subject,
    html,
    playerId: player.id,
    type: "expired",
  });
}

module.exports = {
  sendWelcomeEmail,
  sendParentCourtesyEmail,
  sendGreenGradeEmail,
  sendYellowGradeEmail,
  sendExpiryWarningEmail,
  sendStatusExpiredEmail,
};
