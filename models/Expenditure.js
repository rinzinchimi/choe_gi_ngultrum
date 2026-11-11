const db = require('../config/db');
const { evaluateFlags, recordFlags } = require('../utils/flags');
const AuditLog = require('./AuditLog');

const Expenditure = {
  /**
   * Find by ID with full relations
   */
  async findById(id) {
    return db.oneOrNone(
      `SELECT e.*, 
              c.name AS category_name,
              cl.name AS club_name,
              ev.name AS event_name,
              creator.name AS creator_name, creator.role AS creator_role,
              approver.name AS approver_name
       FROM expenditures e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN clubs cl ON cl.id = e.club_id
       LEFT JOIN events ev ON ev.id = e.event_id
       LEFT JOIN users creator ON creator.id = e.created_by
       LEFT JOIN users approver ON approver.id = e.approved_by
       WHERE e.id = $1`,
      [id]
    );
  },

  /**
   * Get expenditures with comprehensive filtering & server-side pagination
   * @param {Object} options
   */
  async getAll({
    publishedOnly = false,
    status = null,
    categoryId = null,
    department = null,
    clubId = null,
    eventId = null,
    createdBy = null,
    createdByOrClubId = false,
    startDate = null,
    endDate = null,
    minAmount = null,
    maxAmount = null,
    search = null,
    page = 1,
    limit = 10,
    sortBy = 'spent_on',
    sortOrder = 'DESC'
  } = {}) {
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (publishedOnly) {
      where += ` AND e.is_published = true AND e.status = 'approved'`;
    } else if (status) {
      where += ` AND e.status = $${idx++}`;
      params.push(status);
    }

    if (categoryId) {
      where += ` AND e.category_id = $${idx++}`;
      params.push(parseInt(categoryId, 10));
    }

    if (department) {
      where += ` AND e.department ILIKE $${idx++}`;
      params.push(department);
    }

    if (createdByOrClubId) {
      where += ` AND (e.created_by = $${idx++} OR ($${idx}::int IS NOT NULL AND (e.club_id = $${idx} OR e.event_id IN (SELECT id FROM events WHERE club_id = $${idx}))))`;
      params.push(parseInt(createdBy, 10), clubId ? parseInt(clubId, 10) : null);
      idx++;
    } else if (clubId) {
      where += ` AND e.club_id = $${idx++}`;
      params.push(parseInt(clubId, 10));
    }

    if (eventId) {
      where += ` AND e.event_id = $${idx++}`;
      params.push(parseInt(eventId, 10));
    }

    if (!createdByOrClubId && createdBy) {
      where += ` AND e.created_by = $${idx++}`;
      params.push(parseInt(createdBy, 10));
    }

    if (startDate) {
      where += ` AND e.spent_on >= $${idx++}`;
      params.push(startDate);
    }

    if (endDate) {
      where += ` AND e.spent_on <= $${idx++}`;
      params.push(endDate);
    }

    if (minAmount !== null && minAmount !== undefined && minAmount !== '') {
      where += ` AND e.amount >= $${idx++}`;
      params.push(Number(minAmount));
    }

    if (maxAmount !== null && maxAmount !== undefined && maxAmount !== '') {
      where += ` AND e.amount <= $${idx++}`;
      params.push(Number(maxAmount));
    }

    if (search) {
      where += ` AND (e.purpose ILIKE $${idx} OR c.name ILIKE $${idx} OR e.department ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    // Total count query
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM expenditures e
      JOIN categories c ON c.id = e.category_id
      ${where}
    `;
    const countRow = await db.one(countSql, params);
    const total = countRow.count;

    // Sorting & pagination
    const validSortCols = ['spent_on', 'amount', 'id', 'created_at'];
    const sortCol = validSortCols.includes(sortBy) ? `e.${sortBy}` : 'e.spent_on';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    const safePage = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(100, Math.max(1, parsedLimit))
      : 10;
    const offset = (safePage - 1) * safeLimit;

    const querySql = `
      SELECT e.*, 
             c.name AS category_name,
             cl.name AS club_name,
             ev.name AS event_name,
             creator.name AS creator_name,
             approver.name AS approver_name
      FROM expenditures e
      JOIN categories c ON c.id = e.category_id
      LEFT JOIN clubs cl ON cl.id = e.club_id
      LEFT JOIN events ev ON ev.id = e.event_id
      LEFT JOIN users creator ON creator.id = e.created_by
      LEFT JOIN users approver ON approver.id = e.approved_by
      ${where}
      ORDER BY ${sortCol} ${order}, e.id DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(safeLimit, offset);

    const rows = await db.any(querySql, params);

    return {
      rows,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    };
  },

  /**
   * Create expenditure within a transaction, apply flags, and write audit log
   */
  async create({ spent_on, purpose, category_id, department = 'General', club_id = null, event_id = null, amount, created_by }) {
    return db.tx(async t => {
      const creator = await t.oneOrNone('SELECT role, club_id FROM users WHERE id = $1 FOR SHARE', [created_by]);
      if (!creator) throw Object.assign(new Error('Authenticated user was not found.'), { code: 'CREATOR_NOT_FOUND' });
      if (creator.role === 'student_leader') {
        if (!creator.club_id) {
          throw Object.assign(new Error('A club assignment is required before recording expenses.'), { code: 'LEADER_CLUB_NOT_ASSIGNED' });
        }
        if (club_id && Number(club_id) !== Number(creator.club_id)) {
          throw Object.assign(new Error('Student Leaders may only create records for their assigned club.'), { code: 'LEADER_SCOPE_DENIED' });
        }
        if (event_id) {
          const event = await t.oneOrNone('SELECT id FROM events WHERE id = $1 AND club_id = $2', [event_id, creator.club_id]);
          if (!event) {
            throw Object.assign(new Error('Student Leaders may only select projects assigned to their club.'), { code: 'LEADER_SCOPE_DENIED' });
          }
        }
        club_id = creator.club_id;
      }

      // 1. Insert record as pending
      const exp = await t.one(
        `INSERT INTO expenditures (spent_on, purpose, category_id, department, club_id, event_id, amount, status, is_published, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', false, $8, NOW(), NOW())
         RETURNING *`,
        [spent_on, purpose, category_id, department, club_id, event_id, amount, created_by]
      );

      // 2. Audit log for creation
      await AuditLog.record(t, {
        entityType: 'expenditure',
        entityId: exp.id,
        action: 'created',
        actorId: created_by,
        before: null,
        after: {
          spent_on,
          purpose,
          category_id,
          department,
          club_id,
          event_id,
          amount: Number(amount),
          status: 'pending'
        }
      });

      // 3. Evaluate Rule Flags:
      // Check duplicate count
      const dupCountRow = await t.one(
        `SELECT COUNT(*)::int AS count 
         FROM expenditures 
         WHERE id != $1 AND LOWER(purpose) = LOWER($2) AND amount = $3`,
        [exp.id, purpose.trim(), amount]
      );

      // Check current category spend and budget
      const spendRow = await t.one(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total 
         FROM expenditures 
         WHERE category_id = $1 AND is_published = true AND status = 'approved'`,
        [category_id]
      );

      const budgetRow = await t.one(
        `SELECT COALESCE(SUM(allocated_amount), 0)::numeric AS allocated_amount
         FROM budgets 
         WHERE category_id = $1`,
        [category_id]
      );

      const flagResult = evaluateFlags({
        isEdit: false,
        newAmount: amount,
        categoryId: category_id,
        purpose,
        duplicateCount: dupCountRow.count,
        currentCategorySpend: Number(spendRow.total),
        categoryBudget: Number(budgetRow.allocated_amount)
      });

      if (flagResult.shouldFlag) {
        await recordFlags(t, exp.id, flagResult.reasons, created_by);
        exp.status = 'requires_review';
      }

      return exp;
    });
  },

  /**
   * Edit expenditure with audit log and re-evaluation of flags
   */
  async update(id, { spent_on, purpose, category_id, department, club_id, event_id, amount, actor_id }) {
    return db.tx(async t => {
      const prev = await t.oneOrNone('SELECT * FROM expenditures WHERE id = $1', [id]);
      if (!prev) throw new Error('Expenditure record not found');

      // Update basic fields
      const updated = await t.one(
        `UPDATE expenditures
         SET spent_on = $1, purpose = $2, category_id = $3, department = $4,
             club_id = $5, event_id = $6, amount = $7, updated_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [
          spent_on || prev.spent_on,
          purpose || prev.purpose,
          category_id || prev.category_id,
          department || prev.department,
          club_id !== undefined ? club_id : prev.club_id,
          event_id !== undefined ? event_id : prev.event_id,
          amount || prev.amount,
          id
        ]
      );

      // Audit log edit
      await AuditLog.record(t, {
        entityType: 'expenditure',
        entityId: id,
        action: 'edited',
        actorId: actor_id,
        before: {
          spent_on: prev.spent_on,
          purpose: prev.purpose,
          category_id: prev.category_id,
          amount: Number(prev.amount),
          status: prev.status
        },
        after: {
          spent_on: updated.spent_on,
          purpose: updated.purpose,
          category_id: updated.category_id,
          amount: Number(updated.amount),
          status: updated.status
        }
      });

      // Re-evaluate flags on edit
      const dupCountRow = await t.one(
        `SELECT COUNT(*)::int AS count 
         FROM expenditures 
         WHERE id != $1 AND LOWER(purpose) = LOWER($2) AND amount = $3`,
        [id, updated.purpose.trim(), updated.amount]
      );

      const spendRow = await t.one(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total 
         FROM expenditures 
         WHERE category_id = $1 AND is_published = true AND status = 'approved' AND id != $2`,
        [updated.category_id, id]
      );

      const budgetRow = await t.one(
        `SELECT COALESCE(SUM(allocated_amount), 0)::numeric AS allocated_amount
         FROM budgets 
         WHERE category_id = $1`,
        [updated.category_id]
      );

      const flagResult = evaluateFlags({
        isEdit: true,
        previousAmount: Number(prev.amount),
        newAmount: Number(updated.amount),
        categoryId: updated.category_id,
        purpose: updated.purpose,
        duplicateCount: dupCountRow.count,
        currentCategorySpend: Number(spendRow.total),
        categoryBudget: Number(budgetRow.allocated_amount)
      });

      if (flagResult.shouldFlag) {
        await recordFlags(t, id, flagResult.reasons, actor_id);
        updated.status = 'requires_review';
        updated.is_published = false;
      }

      return updated;
    });
  },

  /**
   * Approve expenditure & publish
   */
  async approve(id, approverId) {
    return db.tx(async t => {
      const prev = await t.one('SELECT * FROM expenditures WHERE id = $1', [id]);

      const updated = await t.one(
        `UPDATE expenditures
         SET status = 'approved', is_published = true, approved_by = $1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [approverId, id]
      );

      // Resolve review flags if any
      await t.none('UPDATE review_flags SET resolved_at = NOW() WHERE expenditure_id = $1', [id]);

      await AuditLog.record(t, {
        entityType: 'expenditure',
        entityId: id,
        action: 'approved',
        actorId: approverId,
        before: { status: prev.status, is_published: prev.is_published },
        after: { status: 'approved', is_published: true }
      });

      await AuditLog.record(t, {
        entityType: 'expenditure',
        entityId: id,
        action: 'published',
        actorId: approverId,
        before: { is_published: false },
        after: { is_published: true }
      });

      return updated;
    });
  },

  /**
   * Reject expenditure with required reason
   */
  async reject(id, rejectorId, reason) {
    return db.tx(async t => {
      const prev = await t.one('SELECT * FROM expenditures WHERE id = $1', [id]);

      const updated = await t.one(
        `UPDATE expenditures
         SET status = 'rejected', is_published = false, approved_by = $1, rejection_reason = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [rejectorId, reason, id]
      );

      await AuditLog.record(t, {
        entityType: 'expenditure',
        entityId: id,
        action: 'rejected',
        actorId: rejectorId,
        before: { status: prev.status },
        after: { status: 'rejected', reason }
      });

      return updated;
    });
  },

  /**
   * Mark expenditure as requires_review with a reason
   */
  async flag(id, actorId, reason) {
    return db.tx(async t => {
      await recordFlags(t, id, [reason], actorId);
      return t.one('SELECT * FROM expenditures WHERE id = $1', [id]);
    });
  },

  /**
   * Get KPI Summary Stats
   */
  async getSummaryStats() {
    const budgetRow = await db.one('SELECT COALESCE(SUM(allocated_amount), 0)::numeric AS total FROM budgets');
    const spentRow = await db.one(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total 
       FROM expenditures 
       WHERE is_published = true AND status = 'approved'`
    );
    const projectsRow = await db.one("SELECT COUNT(*)::int AS count FROM events WHERE status = 'active'");
    const pendingRow = await db.one("SELECT COUNT(*)::int AS count FROM expenditures WHERE status = 'pending'");
    const reviewRow = await db.one("SELECT COUNT(*)::int AS count FROM expenditures WHERE status = 'requires_review'");
    const openQRow = await db.one("SELECT COUNT(*)::int AS count FROM questions WHERE status = 'open'");

    const totalBudget = Number(budgetRow.total);
    const totalSpent = Number(spentRow.total);
    const remaining = totalBudget - totalSpent;
    const percentSpent = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : '0.0';

    return {
      totalBudget,
      totalSpent,
      remaining,
      percentSpent,
      activeProjects: projectsRow.count,
      pendingCount: pendingRow.count,
      reviewCount: reviewRow.count,
      openQuestions: openQRow.count
    };
  },

  /**
   * Monthly spend for charts
   */
  async getMonthlySpend() {
    return db.any(
      `SELECT 
         TO_CHAR(spent_on, 'Mon YYYY') AS month_label,
         DATE_TRUNC('month', spent_on) AS month_date,
         SUM(amount) AS total_amount
       FROM expenditures
       WHERE is_published = true AND status = 'approved'
       GROUP BY DATE_TRUNC('month', spent_on), TO_CHAR(spent_on, 'Mon YYYY')
       ORDER BY month_date ASC`
    );
  },

  /**
   * Get review flags for an expenditure
   */
  async getFlags(expenditureId) {
    return db.any(
      `SELECT rf.*, u.name AS raised_by_name
       FROM review_flags rf
       LEFT JOIN users u ON u.id = rf.raised_by
       WHERE rf.expenditure_id = $1
       ORDER BY rf.created_at ASC`,
      [expenditureId]
    );
  }
};

module.exports = Expenditure;

