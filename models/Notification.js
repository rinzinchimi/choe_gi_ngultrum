const db = require('../config/db');

const Notification = {
  async create({ userId, type = 'info', message, link = null }) {
    return db.one(
      `INSERT INTO notifications (user_id, type, message, link, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [userId, type, message, link]
    );
  },

  async getByUser(userId, limit = 50) {
    return db.any(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  },

  async markAsRead(id, userId) {
    return db.none(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  },

  async markAllAsRead(userId) {
    return db.none(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
  },

  async countUnread(userId) {
    if (!userId) return 0;
    const row = await db.one(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return row.count;
  }
};

module.exports = Notification;

