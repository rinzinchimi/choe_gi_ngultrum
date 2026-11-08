const db = require('../config/db');
const { getMongoDb } = require('../config/mongo');

const Question = {
  async create({ expenditureId, askedBy, text, isPublic = true }) {
    const question = await db.one(
      `INSERT INTO questions (expenditure_id, asked_by, text, status, is_public, created_at)
       VALUES ($1, $2, $3, 'open', $4, NOW())
       RETURNING *`,
      [expenditureId, askedBy, text, isPublic]
    );

    // If MongoDB is connected, mirror for fast search/analytics
    try {
      const mongo = getMongoDb();
      if (mongo) {
        await mongo.collection('questions').insertOne({
          pg_id: question.id,
          expenditure_id: expenditureId,
          asked_by: askedBy,
          text,
          status: 'open',
          is_public: isPublic,
          created_at: new Date()
        });
      }
    } catch (mErr) {
      // Non-blocking fallback
      console.warn('Mongo mirror write skipped:', mErr.message);
    }

    return question;
  },

  async findById(id) {
    return db.oneOrNone(
      `SELECT q.*, 
              asker.name AS asker_name, asker.email AS asker_email,
              answerer.name AS answerer_name,
              e.purpose AS expenditure_purpose, e.amount AS expenditure_amount
       FROM questions q
       JOIN users asker ON asker.id = q.asked_by
       LEFT JOIN users answerer ON answerer.id = q.answered_by
       JOIN expenditures e ON e.id = q.expenditure_id
       WHERE q.id = $1`,
      [id]
    );
  },

  async findByExpenditureId(expenditureId, publicOnly = true) {
    let sql = `
      SELECT q.*, 
             asker.name AS asker_name,
             answerer.name AS answerer_name,
             answerer.role AS answerer_role
      FROM questions q
      JOIN users asker ON asker.id = q.asked_by
      LEFT JOIN users answerer ON answerer.id = q.answered_by
      WHERE q.expenditure_id = $1
    `;
    if (publicOnly) {
      sql += ' AND q.is_public = true';
    }
    sql += ' ORDER BY q.created_at ASC';
    return db.any(sql, [expenditureId]);
  },

  async answer(id, { answerText, answeredBy, documentUrl = null }) {
    const question = await db.one(
      `UPDATE questions
       SET answer_text = $1, answered_by = $2, answered_at = NOW(), status = 'answered', document_url = $3
       WHERE id = $4
       RETURNING *`,
      [answerText, answeredBy, documentUrl, id]
    );

    try {
      const mongo = getMongoDb();
      if (mongo) {
        await mongo.collection('questions').updateOne(
          { pg_id: Number(id) },
          { $set: { answer_text: answerText, answered_by: answeredBy, answered_at: new Date(), status: 'answered', document_url: documentUrl } }
        );
      }
    } catch (mErr) {
      console.warn('Mongo mirror update skipped:', mErr.message);
    }

    return question;
  },

  async getAll({ status = null, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT q.*, 
             asker.name AS asker_name, asker.email AS asker_email,
             answerer.name AS answerer_name,
             e.purpose AS expenditure_purpose, e.amount AS expenditure_amount,
             c.name AS category_name
      FROM questions q
      JOIN users asker ON asker.id = q.asked_by
      LEFT JOIN users answerer ON answerer.id = q.answered_by
      JOIN expenditures e ON e.id = q.expenditure_id
      JOIN categories c ON c.id = e.category_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (status) {
      sql += ` AND q.status = $${idx++}`;
      params.push(status);
    }

    sql += ` ORDER BY q.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    return db.any(sql, params);
  },

  async countOpen() {
    const row = await db.one("SELECT COUNT(*)::int AS count FROM questions WHERE status = 'open'");
    return row.count;
  }
};

module.exports = Question;

