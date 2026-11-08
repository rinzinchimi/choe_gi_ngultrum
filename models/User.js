const db = require('../config/db');

const User = {
  async findByEmail(email) {
    if (!email) return null;
    return db.oneOrNone('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
  },

  async findById(id) {
    if (!id) return null;
    return db.oneOrNone(
      `SELECT u.id, u.name, u.email, u.role, u.is_verified, u.department, u.club_id, u.created_at,
              c.name AS club_name
       FROM users u
       LEFT JOIN clubs c ON c.id = u.club_id
       WHERE u.id = $1`,
      [id]
    );
  },

  async findByVerificationToken(token) {
    if (!token) return null;
    return db.oneOrNone('SELECT * FROM users WHERE verification_token = $1', [token]);
  },

  async findByResetToken(token) {
    if (!token) return null;
    return db.oneOrNone(
      `SELECT * FROM users 
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
  },

  async create({ name, email, passwordHash, role = 'student', verificationToken = null, department = null, clubId = null }) {
    return db.one(
      `INSERT INTO users (name, email, password_hash, role, verification_token, is_verified, department, club_id, created_at)
       VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id, name, email, role, is_verified, created_at`,
      [name, email.trim(), passwordHash, role, verificationToken, false, department, clubId]
    );
  },

  async verifyEmail(id) {
    return db.none(
      `UPDATE users 
       SET is_verified = true, verification_token = NULL 
       WHERE id = $1`,
      [id]
    );
  },

  async setResetToken(id, token, expiresAt) {
    return db.none(
      `UPDATE users 
       SET reset_token = $1, reset_token_expires = $2 
       WHERE id = $3`,
      [token, expiresAt, id]
    );
  },

  async updatePassword(id, passwordHash) {
    return db.none(
      `UPDATE users 
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
       WHERE id = $2`,
      [passwordHash, id]
    );
  },

  async getAll({ role = null, search = null, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT u.id, u.name, u.email, u.role, u.is_verified, u.department, u.club_id, u.created_at,
             c.name AS club_name
      FROM users u
      LEFT JOIN clubs c ON c.id = u.club_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (role) {
      sql += ` AND u.role = $${idx++}`;
      params.push(role);
    }

    if (search) {
      sql += ` AND (u.name ILIKE $${idx} OR u.email ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    sql += ` ORDER BY u.id ASC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    return db.any(sql, params);
  },

  async updateRole(id, role) {
    return db.one(
      `UPDATE users 
       SET role = $1 
       WHERE id = $2 
       RETURNING id, name, email, role`,
      [role, id]
    );
  },

  async count() {
    const row = await db.one('SELECT COUNT(*)::int AS count FROM users');
    return row.count;
  }
};

module.exports = User;

