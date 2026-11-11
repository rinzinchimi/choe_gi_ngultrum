-- ============================================================================
-- Choe Gi Ngultrum (ཁྱོད་ཀྱི་དངུལ་ཀྲམ།) — Database Schema
-- Financial transparency and expenditure-tracking for colleges in Bhutan
-- All monetary amounts are NUMERIC(14,2). All timestamps TIMESTAMPTZ.
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS clubs (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'student'
                         CHECK (role IN ('student','student_leader','finance_officer','admin','auditor')),
  is_verified          BOOLEAN NOT NULL DEFAULT false,
  requested_role       TEXT CHECK (requested_role IS NULL OR requested_role IN ('student_leader','auditor')),
  approval_status      TEXT NOT NULL DEFAULT 'approved'
                         CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  verification_token   TEXT,
  verification_token_expires TIMESTAMPTZ,
  verification_email_last_sent_at TIMESTAMPTZ,
  institution_id       TEXT,
  designation          TEXT,
  approved_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at          TIMESTAMPTZ,
  reviewed_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMPTZ,
  rejection_reason     TEXT,
  reset_token          TEXT,
  reset_token_expires  TIMESTAMPTZ,
  department           TEXT,
  club_id              INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additions for databases created before expiring verification links/resends.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_email_last_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS requested_role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
UPDATE users
SET verification_token_expires = NOW() + INTERVAL '24 hours'
WHERE verification_token IS NOT NULL AND verification_token_expires IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_requested_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_requested_role_check
      CHECK (requested_role IS NULL OR requested_role IN ('student_leader','auditor'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_approval_status_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_approval_status_check
      CHECK (approval_status IN ('pending','approved','rejected','suspended'));
  END IF;
END $$;

-- Existing databases keep their original role CHECK when users is not recreated.
-- Replace role-only CHECK constraints so newly supported auditor accounts can be approved.
DO $$
DECLARE role_constraint RECORD;
BEGIN
  FOR role_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~* '\mrole\M'
      AND pg_get_constraintdef(oid) !~* '\m(requested_role|approval_status)\M'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', role_constraint.conname);
  END LOOP;

  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('student','student_leader','finance_officer','admin','auditor'));
END $$;

CREATE TABLE IF NOT EXISTS events (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  club_id        INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  budget_amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id                SERIAL PRIMARY KEY,
  fiscal_year       TEXT NOT NULL DEFAULT '2025-2026',
  category_id       INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  department        TEXT,
  club_id           INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  event_id          INTEGER REFERENCES events(id) ON DELETE SET NULL,
  allocated_amount  NUMERIC(14,2) NOT NULL CHECK (allocated_amount >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenditures (
  id            SERIAL PRIMARY KEY,
  spent_on      DATE NOT NULL,
  purpose       TEXT NOT NULL,
  category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  department    TEXT NOT NULL DEFAULT 'General',
  club_id       INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  event_id      INTEGER REFERENCES events(id) ON DELETE SET NULL,
  amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'requires_review')),
  is_published  BOOLEAN NOT NULL DEFAULT false,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  approved_by   INTEGER REFERENCES users(id),
  rejection_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id              SERIAL PRIMARY KEY,
  expenditure_id  INTEGER NOT NULL REFERENCES expenditures(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'invoice'
                    CHECK (type IN ('invoice', 'approval_letter', 'receipt', 'other')),
  file_url        TEXT NOT NULL,
  original_name   TEXT,
  stored_name     TEXT,
  mime            TEXT,
  size            INTEGER,
  uploaded_by     INTEGER REFERENCES users(id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only audit trail
CREATE TABLE IF NOT EXISTS audit_log (
  id           SERIAL PRIMARY KEY,
  entity_type  TEXT NOT NULL,
  entity_id    INTEGER NOT NULL,
  action       TEXT NOT NULL
                 CHECK (action IN ('created', 'edited', 'flagged', 'approved', 'rejected', 'published', 'role_updated')),
  actor_id     INTEGER REFERENCES users(id),
  before       JSONB,
  after        JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend the existing audit action allowlist for auditable user role changes.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN ('created', 'edited', 'flagged', 'approved', 'rejected', 'published', 'role_updated'));

CREATE TABLE IF NOT EXISTS questions (
  id              SERIAL PRIMARY KEY,
  expenditure_id  INTEGER NOT NULL REFERENCES expenditures(id) ON DELETE CASCADE,
  asked_by        INTEGER NOT NULL REFERENCES users(id),
  text            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
  answer_text     TEXT,
  answered_by     INTEGER REFERENCES users(id),
  answered_at     TIMESTAMPTZ,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  document_url    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  link        TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_flags (
  id              SERIAL PRIMARY KEY,
  expenditure_id  INTEGER NOT NULL REFERENCES expenditures(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  raised_by       INTEGER REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes for performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_expenditures_spent_on    ON expenditures (spent_on);
CREATE INDEX IF NOT EXISTS idx_expenditures_category    ON expenditures (category_id);
CREATE INDEX IF NOT EXISTS idx_expenditures_status      ON expenditures (status);
CREATE INDEX IF NOT EXISTS idx_expenditures_published   ON expenditures (is_published);
CREATE INDEX IF NOT EXISTS idx_expenditures_created_by  ON expenditures (created_by);
CREATE INDEX IF NOT EXISTS idx_audit_entity             ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor              ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_questions_expenditure    ON questions (expenditure_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user       ON notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_review_flags_expenditure ON review_flags (expenditure_id);
CREATE INDEX IF NOT EXISTS idx_users_role_applications ON users (approval_status, requested_role, is_verified);

-- ---------------------------------------------------------------------------
-- Append-only trigger for audit_log
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION forbid_audit_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: rows cannot be changed or removed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();

-- ---------------------------------------------------------------------------
-- Default Category Seeds
-- ---------------------------------------------------------------------------
INSERT INTO categories (name) VALUES
  ('Student Activities'),
  ('Sports'),
  ('Events'),
  ('Clubs'),
  ('Infrastructure'),
  ('Academic'),
  ('Maintenance'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

