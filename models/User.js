const db = require('../config/db');
const AuditLog = require('./AuditLog');

const User = {
  async findByEmail(email) {
    if (!email) return null;
    return db.oneOrNone('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
  },

  async findById(id) {
    if (!id) return null;
    return db.oneOrNone(
      `SELECT u.id, u.name, u.email, u.role, u.is_verified, u.requested_role, u.approval_status,
              u.institution_id, u.designation, u.approved_by, u.approved_at, u.rejection_reason,
              u.department, u.club_id, u.created_at,
              c.name AS club_name
       FROM users u
       LEFT JOIN clubs c ON c.id = u.club_id
       WHERE u.id = $1`,
      [id]
    );
  },

  async findByVerificationToken(token) {
    if (!token) return null;
    return db.oneOrNone(
      `SELECT * FROM users
       WHERE verification_token = $1 AND verification_token_expires > NOW()`,
      [token]
    );
  },

  async findByResetToken(token) {
    if (!token) return null;
    return db.oneOrNone(
      `SELECT * FROM users 
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
  },

  async create({
    name,
    email,
    passwordHash,
    role = 'student',
    requestedRole = null,
    approvalStatus = 'approved',
    isVerified = false,
    verificationToken = null,
    verificationTokenExpiresAt = null,
    department = null,
    institutionId = null,
    designation = null,
    clubId = null
  }) {
    return db.one(
      `INSERT INTO users (
         name, email, password_hash, role, requested_role, approval_status,
         verification_token,
         verification_token_expires, verification_email_last_sent_at,
         is_verified, department, institution_id, designation, club_id, created_at
       )
       VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, $8,
               CASE WHEN $7 IS NULL THEN NULL ELSE NOW() END,
               $9, $10, $11, $12, $13, NOW())
       RETURNING id, name, email, role, is_verified, created_at`,
      [
        name,
        email.trim(),
        passwordHash,
        role,
        requestedRole,
        approvalStatus,
        verificationToken,
        verificationTokenExpiresAt,
        isVerified,
        department,
        institutionId,
        designation,
        clubId
      ]
    );
  },

  async verifyEmail(id, token) {
    const result = await db.result(
      `UPDATE users 
       SET is_verified = true, verification_token = NULL, verification_token_expires = NULL
       WHERE id = $1 AND verification_token = $2 AND verification_token_expires > NOW()`,
      [id, token]
    );
    return result.rowCount > 0;
  },

  async setVerificationToken(id, token, expiresAt, cooldownSeconds = 60) {
    const updated = await db.oneOrNone(
      `UPDATE users
       SET verification_token = $1,
           verification_token_expires = $2,
           verification_email_last_sent_at = NOW()
       WHERE id = $3
         AND is_verified = false
         AND (
           verification_email_last_sent_at IS NULL OR
           verification_email_last_sent_at <= NOW() - ($4 * INTERVAL '1 second')
         )
       RETURNING id`,
      [token, expiresAt, id, cooldownSeconds]
    );
    return Boolean(updated);
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
      SELECT u.id, u.name, u.email, u.role, u.is_verified, u.requested_role,
             u.approval_status, u.department, u.institution_id, u.designation,
             u.club_id, u.created_at,
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

  async updateRole(id, role, actorId) {
    if (!['student', 'finance_officer'].includes(role)) {
      throw Object.assign(new Error('This role can only be assigned through its approved provisioning workflow.'), {
        code: 'ROLE_CHANGE_RESTRICTED'
      });
    }
    return db.tx(async t => {
      const before = await t.oneOrNone('SELECT id, role, approval_status, requested_role FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!before || before.approval_status !== 'approved' || before.requested_role || before.role === 'admin' || Number(before.id) === Number(actorId)) {
        throw Object.assign(new Error('This account cannot be changed through general role management.'), { code: 'ROLE_CHANGE_RESTRICTED' });
      }
      const updated = await t.one(
        `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role`,
        [role, id]
      );
      await AuditLog.record(t, {
        entityType: 'user_role',
        entityId: updated.id,
        action: 'role_updated',
        actorId,
        before: { role: before.role },
        after: { role: updated.role }
      });
      return updated;
    });
  },

  async getRoleApprovalStats() {
    return db.one(`
      SELECT COUNT(*)::int AS total_users,
             COUNT(*) FILTER (WHERE requested_role = 'student_leader' AND approval_status = 'pending')::int AS pending_leaders,
             COUNT(*) FILTER (WHERE requested_role = 'auditor' AND approval_status = 'pending')::int AS pending_auditors,
             COUNT(*) FILTER (WHERE requested_role IS NOT NULL AND approval_status = 'approved')::int AS approved_applications,
             COUNT(*) FILTER (WHERE requested_role IS NOT NULL AND approval_status = 'rejected')::int AS rejected_applications,
             COUNT(*) FILTER (WHERE requested_role IS NOT NULL AND is_verified = false)::int AS unverified_applications
      FROM users
    `);
  },

  async getRoleApplications({ status = null, role = null } = {}) {
    let sql = `
      SELECT u.id, u.name, u.email, u.role, u.requested_role, u.approval_status,
             u.is_verified, u.institution_id, u.department, u.designation,
             u.club_id, u.created_at, u.approved_by, u.approved_at,
             u.rejection_reason, u.reviewed_at,
             reviewer.name AS reviewer_name, c.name AS club_name
      FROM users u
      LEFT JOIN users reviewer ON reviewer.id = u.reviewed_by
      LEFT JOIN clubs c ON c.id = u.club_id
      WHERE u.requested_role IN ('student_leader', 'auditor')
    `;
    const params = [];
    let idx = 1;

    if (status && ['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      sql += ` AND u.approval_status = $${idx++}`;
      params.push(status);
    }
    if (role && ['student_leader', 'auditor'].includes(role)) {
      sql += ` AND u.requested_role = $${idx++}`;
      params.push(role);
    }

    sql += ` ORDER BY CASE WHEN u.approval_status = 'pending' THEN 0 ELSE 1 END, u.created_at DESC`;
    return db.any(sql, params);
  },

  async approveRoleApplication(id, adminId, clubId = null) {
    return db.tx(async t => {
      const applicant = await t.oneOrNone('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!applicant || !['student_leader', 'auditor'].includes(applicant.requested_role)) {
        throw Object.assign(new Error('Role application not found.'), { code: 'ROLE_APPLICATION_NOT_FOUND' });
      }
      if (Number(applicant.id) === Number(adminId)) {
        throw Object.assign(new Error('Administrators cannot approve their own application.'), { code: 'SELF_APPROVAL' });
      }
      if (applicant.requested_role === 'student_leader' && !clubId) {
        throw Object.assign(new Error('A club assignment is required for Student Leader approval.'), { code: 'CLUB_REQUIRED' });
      }
      if (applicant.approval_status !== 'pending') {
        throw Object.assign(new Error('This application is no longer pending.'), { code: 'APPLICATION_NOT_PENDING' });
      }
      if (applicant.requested_role === 'student_leader') {
        if (!Number.isInteger(Number(clubId)) || Number(clubId) < 1) {
          throw Object.assign(new Error('Choose a valid club for the Student Leader.'), { code: 'INVALID_CLUB' });
        }
        const club = await t.oneOrNone('SELECT id FROM clubs WHERE id = $1', [clubId]);
        if (!club) {
          throw Object.assign(new Error('The selected club no longer exists.'), { code: 'INVALID_CLUB' });
        }
      }

      const updated = await t.one(
        `UPDATE users
         SET role = requested_role, approval_status = 'approved',
             approved_by = $2, approved_at = NOW(),
             reviewed_by = $2, reviewed_at = NOW(), rejection_reason = NULL,
             club_id = CASE WHEN requested_role = 'student_leader' THEN $3 ELSE NULL END,
             is_verified = true, verification_token = NULL, verification_token_expires = NULL
         WHERE id = $1 AND approval_status = 'pending'
         RETURNING id, name, email, role, requested_role, approval_status`,
        [id, adminId, clubId]
      );

      await AuditLog.record(t, {
        entityType: 'role_application',
        entityId: applicant.id,
        action: 'approved',
        actorId: adminId,
        before: {
          role: applicant.role,
          requested_role: applicant.requested_role,
          approval_status: applicant.approval_status,
          is_verified: applicant.is_verified
        },
        after: {
          role: updated.role,
          requested_role: updated.requested_role,
          approval_status: updated.approval_status,
          club_id: clubId,
          approved_at: new Date().toISOString()
        }
      });
      return updated;
    });
  },

  async rejectRoleApplication(id, adminId, reason) {
    return db.tx(async t => {
      const applicant = await t.oneOrNone('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!applicant || !['student_leader', 'auditor'].includes(applicant.requested_role)) {
        throw Object.assign(new Error('Role application not found.'), { code: 'ROLE_APPLICATION_NOT_FOUND' });
      }
      if (Number(applicant.id) === Number(adminId)) {
        throw Object.assign(new Error('Administrators cannot reject their own application.'), { code: 'SELF_APPROVAL' });
      }
      if (applicant.approval_status !== 'pending') {
        throw Object.assign(new Error('This application is no longer pending.'), { code: 'APPLICATION_NOT_PENDING' });
      }

      const updated = await t.one(
        `UPDATE users
         SET approval_status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), rejection_reason = $3
         WHERE id = $1 AND approval_status = 'pending'
         RETURNING id, name, email, role, requested_role, approval_status, rejection_reason`,
        [id, adminId, reason]
      );

      await AuditLog.record(t, {
        entityType: 'role_application',
        entityId: applicant.id,
        action: 'rejected',
        actorId: adminId,
        before: {
          role: applicant.role,
          requested_role: applicant.requested_role,
          approval_status: applicant.approval_status,
          is_verified: applicant.is_verified
        },
        after: {
          role: updated.role,
          requested_role: updated.requested_role,
          approval_status: updated.approval_status,
          rejection_reason: reason,
          reviewed_at: new Date().toISOString()
        }
      });
      return updated;
    });
  },

  async count() {
    const row = await db.one('SELECT COUNT(*)::int AS count FROM users');
    return row.count;
  }
};

module.exports = User;

