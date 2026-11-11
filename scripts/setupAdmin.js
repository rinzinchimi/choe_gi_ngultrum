require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');
const db = require('../config/db');
const { isValidEmail, isValidPassword } = require('../utils/validators');

async function setupAdministrator() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!isValidEmail(email)) {
    throw Object.assign(new Error('Set a valid ADMIN_EMAIL in .env.'), { code: 'ADMIN_EMAIL_INVALID' });
  }

  return db.tx(async t => {
    await t.one("SELECT pg_advisory_xact_lock(hashtext('choe-gi-ngultrum-admin-setup'))");
    const existing = await t.oneOrNone(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) FOR UPDATE',
      [email]
    );

    if (existing) {
      await t.none(
        `UPDATE users
         SET role = 'admin', is_verified = true, approval_status = 'approved',
             requested_role = NULL, verification_token = NULL,
             verification_token_expires = NULL, rejection_reason = NULL
         WHERE id = $1`,
        [existing.id]
      );
      return 'existing';
    }

    if (password.length < 12 || !isValidPassword(password)) {
      throw Object.assign(new Error('ADMIN_PASSWORD must be at least 12 characters and include uppercase, lowercase, and a number.'), {
        code: 'ADMIN_PASSWORD_WEAK'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await t.none(
      `INSERT INTO users (name, email, password_hash, role, is_verified, approval_status, created_at)
       VALUES ('Configured Administrator', $1, $2, 'admin', true, 'approved', NOW())`,
      [email, passwordHash]
    );
    return 'created';
  });
}

if (require.main === module) {
  setupAdministrator()
    .then(result => {
      console.log(result === 'created'
        ? 'Configured administrator account created.'
        : 'Existing configured account is now the administrator; its password was left unchanged.');
    })
    .catch(error => {
      console.error(`Administrator setup failed (${error.code || 'SETUP_ERROR'}): ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => {
      if (db.$pgp) db.$pgp.end();
    });
}

module.exports = setupAdministrator;
