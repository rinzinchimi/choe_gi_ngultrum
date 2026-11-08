const db = require('../config/db');

const AuditLog = {
  async record(tOrDb, { entityType, entityId, action, actorId = null, before = null, after = null }) {
    const client = tOrDb || db;
    return client.one(
      `INSERT INTO audit_log (entity_type, entity_id, action, actor_id, before, after, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        entityType,
        entityId,
        action,
        actorId,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null
      ]
    );
  },

  async findByEntity(entityType, entityId) {
    return db.any(
      `SELECT a.*, u.name AS actor_name, u.role AS actor_role
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.entity_type = $1 AND a.entity_id = $2
       ORDER BY a.created_at ASC`,
      [entityType, entityId]
    );
  },

  async getAll({ action = null, entityType = null, actorId = null, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT a.*, u.name AS actor_name, u.role AS actor_role
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.actor_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (action) {
      sql += ` AND a.action = $${idx++}`;
      params.push(action);
    }

    if (entityType) {
      sql += ` AND a.entity_type = $${idx++}`;
      params.push(entityType);
    }

    if (actorId) {
      sql += ` AND a.actor_id = $${idx++}`;
      params.push(actorId);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    return db.any(sql, params);
  },

  async count({ action = null, entityType = null } = {}) {
    let sql = `SELECT COUNT(*)::int AS count FROM audit_log WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (action) {
      sql += ` AND action = $${idx++}`;
      params.push(action);
    }

    if (entityType) {
      sql += ` AND entity_type = $${idx++}`;
      params.push(entityType);
    }

    const row = await db.one(sql, params);
    return row.count;
  }
};

module.exports = AuditLog;

