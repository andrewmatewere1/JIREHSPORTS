// database/db.js
// Shared PostgreSQL connection pool — imported by all routes

const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      }
);

pool.on("connect", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("📦 Database connected");
  }
});

pool.on("error", (err) => {
  console.error("❌ Unexpected DB error:", err.message);
});

module.exports = pool;
