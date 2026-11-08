const db = require('../config/db');

const Category = {
  async getAll() {
    return db.any('SELECT * FROM categories ORDER BY id ASC');
  },

  async findById(id) {
    return db.oneOrNone('SELECT * FROM categories WHERE id = $1', [id]);
  },

  async findByName(name) {
    return db.oneOrNone('SELECT * FROM categories WHERE LOWER(name) = LOWER($1)', [name.trim()]);
  },

  async getSummaryWithSpend() {
    return db.any(`
      SELECT 
        c.id,
        c.name,
        COALESCE(b.allocated_amount, 0) AS allocated_amount,
        COALESCE(s.spent_amount, 0) AS spent_amount,
        (COALESCE(b.allocated_amount, 0) - COALESCE(s.spent_amount, 0)) AS remaining_amount,
        CASE 
          WHEN COALESCE(b.allocated_amount, 0) > 0 
          THEN ROUND((COALESCE(s.spent_amount, 0) / b.allocated_amount * 100), 1)
          ELSE 0 
        END AS percentage_spent
      FROM categories c
      LEFT JOIN (
        SELECT category_id, SUM(allocated_amount) AS allocated_amount
        FROM budgets
        GROUP BY category_id
      ) b ON b.category_id = c.id
      LEFT JOIN (
        SELECT category_id, SUM(amount) AS spent_amount
        FROM expenditures
        WHERE is_published = true AND status = 'approved'
        GROUP BY category_id
      ) s ON s.category_id = c.id
      ORDER BY c.id ASC
    `);
  }
};

module.exports = Category;

