<<<<<<< HEAD
# Jireh Sports Management — Backend API

Complete Node.js + Express + PostgreSQL backend for the Jireh Sports Management MVP.

---

## 📁 Project Structure

```
jireh-backend/
├── server.js                  ← Main entry point
├── package.json
├── .env.example               ← Copy to .env and fill in values
├── database/
│   ├── db.js                  ← PostgreSQL connection pool
│   └── setup.js               ← Run once to create all tables + seed data
├── middleware/
│   └── auth.js                ← JWT authentication + role guards
├── routes/
│   ├── auth.js                ← Login for admin / partner / assessor
│   ├── players.js             ← Apply, search, verify, grade players
│   ├── admin.js               ← Token management, events, squad export
│   └── public.js              ← Public events, roster, stats
└── services/
    ├── emailService.js        ← All 5 automated email triggers
    └── cronService.js         ← 45-day decay CRON jobs
```

---

## ⚡ Quick Start

### Step 1 — Get a PostgreSQL database (pick one)

**Option A: Supabase (free, recommended for beginners)**
1. Go to [supabase.com](https://supabase.com) → New Project
2. Go to Settings → Database → copy the "Connection String"

**Option B: Railway (free tier)**
1. Go to [railway.app](https://railway.app) → New Project → PostgreSQL
2. Copy the connection string from the Variables tab

**Option C: Local PostgreSQL**
1. Install PostgreSQL from [postgresql.org](https://postgresql.org)
2. Create a database: `createdb jireh_sports`

---

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:
- Your database connection details
- Your email credentials (see email setup below)
- A strong `JWT_SECRET` (random 64+ character string)
- A strong `ADMIN_PASSWORD`

---

### Step 3 — Install and run

```bash
npm install
node database/setup.js    # Creates all tables + seeds sample data
npm run dev               # Starts server with auto-reload
```

Server runs at: `http://localhost:5000`

---

## 📧 Email Setup (Gmail)

1. Go to your Google Account → Security → 2-Step Verification (enable it)
2. Go to App Passwords → create one for "Mail"
3. Use that 16-character password as `EMAIL_PASS` in your `.env`
4. Set `EMAIL_USER` to your Gmail address

**For production**, use [SendGrid](https://sendgrid.com) (free tier: 100 emails/day):
```
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your_sendgrid_api_key
```

---

## 🔐 Default Login Credentials (seeded)

| Role | Email / Username | Password |
|------|-----------------|----------|
| Admin | `admin` | value of `ADMIN_PASSWORD` in .env |
| Pharmacy (Avenues) | `avenues@partner.jireh.com` | `pharmacy123` |
| Pharmacy (CityMed) | `citymed@partner.jireh.com` | `pharmacy123` |
| Assessor | `coach@jireh.com` | `assessor123` |

⚠️ Change all passwords before going live.

---

## 🛣️ API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/admin/login` | Admin login |
| POST | `/api/auth/partner/login` | Pharmacy login |
| POST | `/api/auth/assessor/login` | Assessor login |

### Public (no auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/events` | All published combine events |
| GET | `/api/public/roster` | Active verified players (teaser data) |
| GET | `/api/public/stats` | Landing page KPI counts |
| GET | `/api/players/public/:id` | Single player teaser profile |

### Players
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/players/apply` | None | Submit chatbot intake form |
| GET | `/api/players/search/:query` | Partner/Assessor | Search by APP or JRH ID |
| PUT | `/api/players/:id/verify` | Partner | Pharmacy verification + deduct token |
| PUT | `/api/players/:id/grade` | Assessor | Submit fitness grade + timestamp |
| GET | `/api/players` | Admin | Full player list with filters |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | KPIs, partners, warnings |
| POST | `/api/admin/tokens/add` | Add tokens to a pharmacy |
| GET | `/api/admin/tokens/history` | Token transaction audit log |
| POST | `/api/admin/partners` | Create new pharmacy partner |
| POST | `/api/admin/assessors` | Create new assessor account |
| GET | `/api/admin/events` | All events |
| POST | `/api/admin/events` | Create new event |
| DELETE | `/api/admin/events/:id` | Delete event |
| POST | `/api/admin/squad/export` | Get contact data for selected players |
| GET | `/api/admin/email-logs` | All automated email history |

---

## 🤖 Automated Email Triggers

| Trigger | When | Recipient |
|---------|------|-----------|
| Welcome | Player submits chatbot form | Player |
| Guardian Courtesy | Player is under 18 | Parent/Guardian |
| Green Grade | Assessor grades player Green | Player |
| Yellow Grade | Assessor grades player Yellow | Player |
| Expiry Warning | 35 days since last test | Player |
| Status Expired | 45+ days since last test | Player |

---

## ⏰ CRON Jobs

- **08:00 daily** — Scans for Green players at 35 days → sends warning email
- **08:05 daily** — Scans for Green players past 45 days → downgrades to Yellow + sends email

---

## 🚀 Deploying to Production

**Recommended: Railway (easiest)**
1. Push code to GitHub
2. Create new Railway project → Deploy from GitHub
3. Add PostgreSQL service
4. Set all environment variables in Railway dashboard
5. Railway gives you a live URL automatically

**Alternative: Render.com**
1. Connect GitHub repo
2. Create Web Service + PostgreSQL database
3. Set environment variables
4. Deploy

---

## 🔗 Connecting the Frontend

In your React frontend (jireh-sports-mvp.jsx), replace the in-memory state with API calls:

```javascript
// Example: Submit chatbot form
const response = await fetch("http://localhost:5000/api/players/apply", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, dob, city, position, email, whatsapp, parentEmail })
});

// Example: Admin login
const response = await fetch("http://localhost:5000/api/auth/admin/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "yourpassword" })
});
const { token } = await response.json();
// Store token, add to all subsequent requests as: Authorization: Bearer <token>
```
=======
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# JIREHSPORTS
>>>>>>> f3694a83b40d88ff7eed278f6e0b6eae69069ec1
