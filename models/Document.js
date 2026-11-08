const db = require('../config/db');

const Document = {
  async findByExpenditureId(expenditureId) {
    return db.any(
      `SELECT d.*, u.name AS uploader_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.expenditure_id = $1
       ORDER BY d.uploaded_at ASC`,
      [expenditureId]
    );
  },

  async findById(id) {
    return db.oneOrNone('SELECT * FROM documents WHERE id = $1', [id]);
  },

  async create({ expenditureId, type = 'invoice', fileUrl, originalName = null, storedName = null, mime = null, size = null, uploadedBy = null }) {
    return db.one(
      `INSERT INTO documents (expenditure_id, type, file_url, original_name, stored_name, mime, size, uploaded_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [expenditureId, type, fileUrl, originalName, storedName, mime, size, uploadedBy]
    );
  },

  async delete(id) {
    return db.none('DELETE FROM documents WHERE id = $1', [id]);
  }
};

module.exports = Document;

