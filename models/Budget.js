const db = require('../config/db');

const Budget = {
  async getAll(fiscalYear = '2025-2026') {
    return db.any(
      `SELECT b.*, c.name AS category_name, cl.name AS club_name, e.name AS event_name
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       LEFT JOIN clubs cl ON cl.id = b.club_id
       LEFT JOIN events e ON e.id = b.event_id
       WHERE b.fiscal_year = $1
       ORDER BY c.id ASC`,
      [fiscalYear]
    );
  },

  async findById(id) {
    return db.oneOrNone(
      `SELECT b.*, c.name AS category_name
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       WHERE b.id = $1`,
      [id]
    );
  },

  async findByCategory(categoryId, fiscalYear = '2025-2026') {
    return db.oneOrNone(
      `SELECT b.*, c.name AS category_name
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       WHERE b.category_id = $1 AND b.fiscal_year = $2`,
      [categoryId, fiscalYear]
    );
  },

  async getTotalAllocated(fiscalYear = '2025-2026') {
    const row = await db.one(
      `SELECT COALESCE(SUM(allocated_amount), 0)::numeric AS total
       FROM budgets
       WHERE fiscal_year = $1`,
      [fiscalYear]
    );
    return Number(row.total);
  },

  async update(id, allocatedAmount) {
    return db.one(
      `UPDATE budgets
       SET allocated_amount = $1
       WHERE id = $2
       RETURNING *`,
      [allocatedAmount, id]
    );
  },

  async create({ fiscalYear = '2025-2026', categoryId, department = 'General', clubId = null, eventId = null, allocatedAmount }) {
    return db.one(
      `INSERT INTO budgets (fiscal_year, category_id, department, club_id, event_id, allocated_amount)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [fiscalYear, categoryId, department, clubId, eventId, allocatedAmount]
    );
  }
};

module.exports = Budget;

