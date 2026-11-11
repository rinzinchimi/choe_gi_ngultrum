# Choe Gi Ngultrum (ཁྱོད་ཀྱི་དངུལ་ཀྲམ།)
> **Tagline:** *"Your Money, Our Transparency."*  
> **Closing Line:** *"Your Money. Our Transparency. Our Accountability."*

A full-stack financial transparency and expenditure-tracking web platform built for tertiary colleges in Bhutan (Royal University of Bhutan constituent colleges such as Sherubtse College, CST, GCBS, and JNEC).

Finance officers log verified expenditure records and upload digital vouchers. Administrators review, approve, and publish transactions to an immutable ledger. Students view itemized spending, inspect audit trails, search projects, and submit respectful clarification inquiries answered directly by finance staff.

## Account setup and role applications

Copy `.env.example` to `.env` and configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `SESSION_SECRET`, `APP_BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GMAIL_USER`, and `GMAIL_APP_PASSWORD`. Keep `.env` private and never commit it. `APP_BASE_URL` must be reachable by the person opening verification links (for another device on the same network, use the server's reachable IP instead of `localhost`).

Enable 2-Step Verification on the Gmail account, create an App Password in Google Account security settings, then put the complete 16-character value in `GMAIL_APP_PASSWORD`. Spaces shown by Google may be included; the app removes ordinary spaces. Do not use your regular Gmail password.

Apply the schema and provision the one configured administrator account from PowerShell:

```powershell
npm.cmd run migrate
npm.cmd run setup:admin
npm.cmd start
```

If an account already exists for `ADMIN_EMAIL`, setup grants that account administrator role and keeps its current password. Otherwise, setup creates it using `ADMIN_PASSWORD`. Public signup can request Student Leader or Auditor access; those accounts must verify their email and await approval under **Admin → Role Approvals**. Existing unverified accounts can request a fresh link at `/resend-verification`.

## Deploying on Render

The root `render.yaml` defines a Node web service and PostgreSQL database. In the Render dashboard, choose **New → Blueprint**, connect this GitHub repository, and select the `master` branch. During setup, enter `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GMAIL_USER`, and the complete `GMAIL_APP_PASSWORD` as secret values. Render generates `SESSION_SECRET`. The service applies the database schema before starting. After the first deploy, open the web service shell and run `npm run setup:admin` once, then open the service's public `onrender.com` URL. Verification links use Render's public hostname unless `APP_BASE_URL` is set explicitly.

The included Blueprint uses Render's free plans to avoid creating billable resources automatically. It is for preview/testing only: Render Free web services block outbound SMTP on port 587, so Gmail verification email cannot work on that plan. Use a paid web plan for Gmail SMTP. Free Postgres expires after 30 days, so use a paid database for durable account data. Uploaded files are stored on the service filesystem, so use persistent storage or external object storage before relying on uploads in production.

---

## 🏛️ Institutional Principles
- **Visibility, Not Accusation:** Choe Gi Ngultrum is a tool for openness, civic engagement, and institutional clarity, not a presumption of misuse.
- **Neutral Review Checkpoints:** A **"Requires Review"** badge is an automated rule or precautionary checkpoint, **never** an accusation.
- **Constructive Dialogue:** Student inquiries foster mutual understanding and transparent communication through pre-formatted, polite templates.
- **Calm, Respectful Language:** Measured, objective wording is maintained across all UI copy, audit logs, and official responses.

---

## ⚙️ Tech Stack & Architecture

- **Runtime & Language:** Node.js (CommonJS, `"type": "commonjs"`)
- **Web Framework:** Express 5 (`^5.2.1`)
- **Templating Engine:** EJS with reusable partials (`views/partials/header.ejs`, `views/partials/footer.ejs`, `views/partials/admin-sidebar.ejs`)
- **Primary Database:** PostgreSQL via `pg-promise` (parameterized queries, `NUMERIC(14,2)` for financial precision, database-level append-only audit trigger)
- **Optional Document Store:** MongoDB via native `mongodb` driver (mirrors questions & feedback when available)
- **Session & Auth:** `express-session`, `bcrypt` password hashing, RBAC middleware, and token-based email verification
- **Security & Utilities:** `helmet` (configured Content Security Policy), `express-rate-limit`, CSRF session protection, `multer` file upload validation
- **Visualization:** Chart.js (CDN) in responsive vanilla JS modules
- **Testing:** Jest + Supertest test suite with comprehensive unit, integration, and RBAC coverage

---

## 📁 Required Project Structure

```
choe_gi_ngultrum/
├── app.js                 # Builds & exports Express app (no app.listen)
├── server.js              # Entrypoint starting HTTP server (app.listen)
├── package.json           # Dependencies, scripts, and package metadata
├── nodemon.json           # Nodemon watch configuration
├── jest.config.js         # Jest test environment & coverage thresholds
├── jest.setup.js          # Test bootstrap loading .env.test
├── Dockerfile             # Multi-stage production container definition
├── .dockerignore          # Build context exclusions
├── .gitignore             # Git exclusions (.env, node_modules, coverage, uploads)
├── .env.example           # Reference environment template
├── .env.test              # Dedicated test database environment
├── README.md              # Complete system documentation
├── db/
│   ├── schema.sql         # PostgreSQL schema (tables, foreign keys, append-only trigger)
│   ├── seed.sql           # Verified, reconciled seed data
│   ├── migrate.js         # Database migration runner script
│   └── seed.js            # Database seeder script
├── config/
│   ├── db.js              # pg-promise PostgreSQL pool configuration
│   ├── mongo.js           # Optional MongoDB client integration
│   └── mailer.js          # Nodemailer Gmail transport / dev console logger
├── middleware/
│   └── auth.js            # requireAuth, requireRole, requireAuthApi, CSRF token validation
├── models/
│   ├── User.js            # User authentication, profiles, and role management
│   ├── Category.js        # Spending categories with live aggregate spend
│   ├── Budget.js          # Category and departmental budget allocations
│   ├── Expenditure.js     # Expenditure lifecycle, filters, and transaction mutations
│   ├── Document.js        # Voucher / invoice attachments
│   ├── AuditLog.js        # Append-only immutable trail records
│   ├── Question.js        # Student inquiries and staff answers
│   └── Notification.js    # In-app notifications and read tracking
├── controllers/
│   ├── homeController.js          # Public landing page with reconciled snapshot
│   ├── aboutController.js         # Institutional principles and error pages
│   ├── authController.js          # Signup, verification, login, password reset
│   ├── dashboardController.js     # Student KPI cards & donut chart
│   ├── expenditureController.js   # Ledger browsing, filters, pagination, detail page
│   ├── analyticsController.js     # Spending trends, budget vs actual charts
│   ├── eventController.js         # Projects & student club allocations
│   ├── questionController.js      # Student inquiry submission and staff replies
│   ├── notificationController.js  # User activity alerts
│   ├── adminController.js         # Approvals queue, budgets, users, reports & CSV
│   ├── auditorController.js       # Filterable audit log viewer
│   └── apiController.js           # JSON REST API endpoints
├── routes/
│   ├── index.js           # SSR HTML views and form post routes
│   └── api.js             # JSON API routes (public, authenticated, staff)
├── views/
│   ├── partials/header.ejs
│   ├── partials/footer.ejs
│   ├── partials/admin-sidebar.ejs
│   ├── index.ejs
│   ├── about.ejs
│   ├── login.ejs
│   ├── signup.ejs
│   ├── signup-success.ejs
│   ├── verify-success.ejs
│   ├── forgot-password.ejs
│   ├── reset-password.ejs
│   ├── dashboard.ejs
│   ├── expenditures.ejs
│   ├── expenditure-detail.ejs
│   ├── analytics.ejs
│   ├── events.ejs
│   ├── notifications.ejs
│   ├── admin-dashboard.ejs
│   ├── admin-expenditures.ejs
│   ├── admin-budgets.ejs
│   ├── admin-approvals.ejs
│   ├── admin-questions.ejs
│   ├── admin-users.ejs
│   ├── admin-reports.ejs
│   └── audit-log.ejs
├── public/
│   ├── css/styles.css     # CSS custom variables, typography, responsive design
│   ├── js/main.js         # UI notifications, dialogs, form helpers
│   └── uploads/           # Attached voucher documents (with .gitkeep)
├── utils/
│   ├── validators.js      # Input sanitization and validation functions
│   ├── validators.test.js # Unit test suite for validators
│   ├── flags.js           # 4-rule automated flagging engine
│   └── flags.test.js      # Unit test suite for flagging rules
└── tests/
    ├── signup.test.js           # Registration and token verification tests
    ├── api.public.test.js       # Public stats, categories, and ledger API tests
    ├── api.expenditures.test.js # Staff expenditure creation & admin approvals
    ├── questions.test.js        # Q&A workflow and notifications tests
    ├── rbac.test.js             # Role-based access control tests
    └── pages.test.js            # Full controller rendering & CSV export tests
```

---

## 👥 Role-Based Access Control (RBAC)

| Role | Access Scope |
|---|---|
| `student` | Inspects published/approved records, performs multi-filter searches, asks clarification questions, views notifications. |
| `student_leader` | All student capabilities plus budget visibility for their respective club or project. |
| `finance_officer` | Creates expenditure entries, uploads vouchers, monitors balances, answers student questions. |
| `admin` | Approves or rejects expenditures with constructive reasons, sets budgets, manages user roles, exports reports. |
| `auditor` | Read-only oversight across all financial records and the tamper-proof append-only audit trail. |

---

## 🚩 Rule-Based Flagging System (`utils/flags.js`)

When an expenditure is created or edited, it is evaluated by an automated 4-rule engine. If any condition triggers, status is set to `requires_review` and an audit entry is created:

1. **Post-Creation Edit Check:** The amount was modified after the initial record was created.
2. **Category Threshold Check:** The amount meets or exceeds category review thresholds (e.g., Nu. 50,000 for Events, Nu. 45,000 for Sports).
3. **Duplicate Prevention Check:** Identical purpose and amount exist in other records.
4. **Budget Ceiling Check:** Category spending exceeds the annual allocated budget.

---

## 📊 Seed Data & Target Reconciled Numbers

Figures computed directly from the PostgreSQL seed:
- **Total College Budget:** Nu. 4,800,000.00
- **Total Verified Spent:** Nu. 3,120,000.00 (65.0%)
- **Remaining Surplus:** Nu. 1,680,000.00
- **Active Projects & Events:** 12 Active Projects
- **Pending Approvals Queue:** Exactly 7 records
- **Requires Review (Flagged):** Exactly 2 records
- **Open Inquiries:** Exactly 4 questions

### Budget vs. Actual Breakdown (Nu. in Thousands)
- Student Activities: 600 allocated / 480 spent
- Sports: 500 allocated / 430 spent
- Events: 800 allocated / 690 spent
- Clubs: 400 allocated / 310 spent
- Infrastructure: 900 allocated / 560 spent
- Academic: 700 allocated / 380 spent
- Maintenance: 500 allocated / 190 spent
- Other: 400 allocated / 80 spent

### Monthly Outflow (Nu. in Thousands)
- Feb: 380 | Mar: 470 | Apr: 520 | May: 610 | Jun: 640 | Jul: 500 *(Total = 3,120)*

---

## 🔑 Demo User Accounts

All demo accounts share the password: **`Transparency@2026`**

| Email | Role | Portal Landing |
|---|---|---|
| `student@sherubtse.rub.edu.bt` | `student` | `/dashboard` |
| `leader@sherubtse.rub.edu.bt` | `student_leader` | `/dashboard` |
| `finance@sherubtse.rub.edu.bt` | `finance_officer` | `/admin/dashboard` |
| `admin@sherubtse.rub.edu.bt` | `admin` | `/admin/dashboard` |
| `auditor@sherubtse.rub.edu.bt` | `auditor` | `/audit-log` |

*(Convenient one-click fill buttons are available directly on the `/login` screen).*

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js:** v18.0.0 or later (tested on v24)
- **PostgreSQL:** v14 or later (running on port 5432)
- **MongoDB:** *(Optional)* running on `localhost:27017`

### 2. Database Creation
In your PostgreSQL shell or GUI:
```sql
CREATE DATABASE choe_gi_ngultrum_db;
CREATE DATABASE choe_gi_ngultrum_test;
```

### 3. Environment Configuration
Copy the template and configure your credentials:
```bash
cp .env.example .env
```
Ensure `DB_USER` and `DB_PASS` correspond to your local PostgreSQL server:
```ini
PORT=3000
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=choe-gi-ngultrum-dev-super-secret-key-32chars

DB_HOST=localhost
DB_PORT=5432
DB_NAME=choe_gi_ngultrum_db
DB_USER=postgres
DB_PASS=your_postgres_password

MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=choe_gi_ngultrum_db
FLAG_AMOUNT_THRESHOLD=50000
```
*(If `GMAIL_USER` and `GMAIL_APP_PASSWORD` are left blank, verification and reset links are conveniently logged to the console).*

### 4. Install Dependencies
```bash
npm install
```

### 5. Run Migrations & Seeding
```bash
npm run migrate
npm run seed
```

### 6. Start Application
Development mode with automatic reload:
```bash
npm run dev
```
Production start:
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Running Automated Tests

Run the full Jest + Supertest test suite:
```bash
npm test
```
To generate coverage reports:
```bash
npm run test:coverage
```
*Coverage exceeds the 70%+ requirement across models, controllers, middleware, and utils with 69 passing test cases.*

---

## 🐳 Docker Deployment

Build and run using the included Dockerfile:
```bash
# Build the Docker image
docker build -t choe-gi-ngultrum .

# Run the container
docker run -p 3000:3000 --env-file .env choe-gi-ngultrum
```

---

## 📡 REST API Reference

### Public Endpoints
- `GET /api/stats` — Overall KPI figures (budget, spent, remaining, project count)
- `GET /api/categories` — List of all 8 categories
- `GET /api/expenditures` — Filterable and paginated list of published/approved records
- `GET /api/expenditures/:id` — Full details of a published expenditure, including vouchers, audit trail, and Q&A
- `GET /api/analytics` — Reconciled category and monthly data for charting

### Authenticated Endpoints
- `POST /api/questions` — Submit a question on an expenditure (requires login)
- `GET /api/notifications` — Retrieve user notifications

### Staff Endpoints
- `POST /api/expenditures` — Log a new expenditure (Finance / Admin)
- `POST /api/expenditures/:id/approve` — Approve & publish an expenditure (Admin)
- `POST /api/expenditures/:id/reject` — Reject with a required constructive reason (Admin)

---

## 🔮 Future Enhancements & Limitations
1. **SMS & Mobile Push Alerts:** Integration with Bhutan Telecom (B-Mobile) and TashiCell SMS gateways for offline alerts when campus questions receive answers.
2. **Multi-College Tenancy:** Scaling from a single college instance to multi-campus tenancy supporting all colleges across the Royal University of Bhutan.
3. **Native Mobile App:** Flutter or React Native mobile client for student mobile receipt scanning.

---
**Choe Gi Ngultrum (ཁྱོད་ཀྱི་དངུལ་ཀྲམ།)**  
*"Your Money. Our Transparency. Our Accountability."*

