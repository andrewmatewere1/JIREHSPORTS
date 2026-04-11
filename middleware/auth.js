// middleware/auth.js
// JWT authentication middleware for protecting routes

const jwt = require("jsonwebtoken");

// ============================================================
// VERIFY JWT TOKEN
// ============================================================
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}

// ============================================================
// ROLE GUARDS
// ============================================================
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

function requirePartner(req, res, next) {
  if (req.user?.role !== "partner" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Partner access required." });
  }
  next();
}

function requireAssessor(req, res, next) {
  if (req.user?.role !== "assessor" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Assessor access required." });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requirePartner, requireAssessor };
