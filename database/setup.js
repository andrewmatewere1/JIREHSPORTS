require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log("Setting up Jireh Sports database...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id SERIAL PRIMARY KEY,
        clinic_name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        token_balance INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Partners table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        temp_id VARCHAR(20) UNIQUE,
        official_id VARCHAR(20) UNIQUE,
        name VARCHAR(100) NOT NULL,
        dob DATE NOT NULL,
        city VARCHAR(100) NOT NULL,
        position VARCHAR(50) NOT NULL,
        email VARCHAR(150) NOT NULL,
        whatsapp VARCHAR(30) NOT NULL,
        parent_email VARCHAR(150),
        status VARCHAR(20) DEFAULT 'Pending',
        fitness_grade VARCHAR(20),
        last_tested_date TIMESTAMP,
        height_cm DECIMAL(5,1),
        weight_kg DECIMAL(5,1),
        blood_pressure VARCHAR(20),
        sprint_40m DECIMAL(5,2),
        vertical_jump_cm DECIMAL(5,1),
        assessor_notes TEXT,
        verified_by INTEGER REFERENCES partners(id),
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Players table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS token_transactions (
        id SERIAL PRIMARY KEY,
        partner_id INTEGER REFERENCES partners(id),
        change_amount INTEGER NOT NULL,
        reason VARCHAR(100),
        player_id INTEGER REFERENCES players(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Token transactions table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS assessors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Assessors table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        dates VARCHAR(100) NOT NULL,
        location VARCHAR(200) NOT NULL,
        registration_fee VARCHAR(50) DEFAULT '$15 USD',
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Events table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id),
        to_email VARCHAR(150) NOT NULL,
        subject VARCHAR(250) NOT NULL,
        type VARCHAR(50) NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW(),
        success BOOLEAN DEFAULT true
      );
    `);
    console.log("Email logs table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Admins table created");

    const adminHash = await bcrypt.hash("jireh2024", 12);
    await client.query(`
      INSERT INTO admins (username, password_hash)
      VALUES ('admin', $1)
      ON CONFLICT (username) DO NOTHING;
    `, [adminHash]);
    console.log("Admin account seeded");

    const partnerHash = await bcrypt.hash("pharmacy123", 12);
    await client.query(`
      INSERT INTO partners (clinic_name, email, password_hash, token_balance)
      VALUES
        ('Avenues Pharmacy', 'avenues@partner.jireh.com', $1, 8),
        ('CityMed Clinic', 'citymed@partner.jireh.com', $1, 3),
        ('BulaCare Health', 'bulacare@partner.jireh.com', $1, 0)
      ON CONFLICT (email) DO NOTHING;
    `, [partnerHash]);
    console.log("Sample pharmacies seeded");

    const assessorHash = await bcrypt.hash("assessor123", 12);
    await client.query(`
      INSERT INTO assessors (name, email, password_hash)
      VALUES ('Coach Jireh', 'coach@jireh.com', $1)
      ON CONFLICT (email) DO NOTHING;
    `, [assessorHash]);
    console.log("Sample assessor seeded");

    await client.query(`
      INSERT INTO events (title, dates, location, registration_fee)
      VALUES
        ('Harare Pop-Up Combine', 'Feb 28 - Mar 2, 2026', 'Rufaro Stadium, Harare', '$15 USD'),
        ('Bulawayo Talent Assessment', 'Mar 14-16, 2026', 'Barbourfields Stadium', '$15 USD'),
        ('Mutare Highland Combine', 'Apr 4-6, 2026', 'Sakubva Stadium, Mutare', '$10 USD')
      ON CONFLICT DO NOTHING;
    `);
    console.log("Sample events seeded");

    console.log("\nDatabase setup complete! Run: npm run dev\n");

  } catch (err) {
    console.error("Database setup error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();

