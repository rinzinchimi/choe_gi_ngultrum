const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');
const Question = require('../models/Question');
const Notification = require('../models/Notification');
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { validateExpenditure, validateQuestion } = require('../utils/validators');

// Public endpoints
exports.getStats = async (req, res) => {
  try {
    const stats = await Expenditure.getSummaryStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.getAll();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getExpenditures = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category_id,
      department,
      start_date,
      end_date,
      min_amount,
      max_amount,
      search
    } = req.query;

    const result = await Expenditure.getAll({
      publishedOnly: true, // Public API only sees approved and published
      categoryId: category_id,
      department,
      startDate: start_date,
      endDate: end_date,
      minAmount: min_amount,
      maxAmount: max_amount,
      search,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        limit: result.limit
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getExpenditureById = async (req, res) => {
  try {
    const { id } = req.params;
    const expenditure = await Expenditure.findById(id);

    if (!expenditure || !expenditure.is_published) {
      return res.status(404).json({ success: false, error: 'Expenditure record not found or not published' });
    }

    const documents = await Document.findByExpenditureId(id);
    const auditTrail = await AuditLog.findByEntity('expenditure', id);
    const questions = await Question.findByExpenditureId(id, true);

    res.json({
      success: true,
      data: {
        ...expenditure,
        documents,
        auditTrail,
        questions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const stats = await Expenditure.getSummaryStats();
    const categories = await Category.getSummaryWithSpend();
    const monthlySpend = await Expenditure.getMonthlySpend();

    res.json({
      success: true,
      data: {
        stats,
        categories,
        monthlySpend
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Authenticated endpoints
exports.postQuestion = async (req, res) => {
  try {
    const validation = validateQuestion(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const user = req.session.user;
    const { expenditure_id, text } = validation.data;

    const question = await Question.create({
      expenditureId: expenditure_id,
      askedBy: user.id,
      text,
      isPublic: req.body.is_public !== false
    });

    // Notify staff
    const staffMembers = await User.getAll({ limit: 100 });
    const financeStaff = staffMembers.filter(u => ['finance_officer', 'admin'].includes(u.role));
    for (const staff of financeStaff) {
      await Notification.create({
        userId: staff.id,
        type: 'question',
        message: `Student asked a clarification inquiry: "${text.substring(0, 50)}..."`,
        link: `/admin/questions`
      });
    }

    res.status(201).json({ success: true, data: question });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const user = req.session.user;
    const notifications = await Notification.getByUser(user.id, 50);
    const unreadCount = await Notification.countUnread(user.id);

    res.json({
      success: true,
      data: notifications,
      unreadCount
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Staff endpoints
exports.postExpenditure = async (req, res) => {
  try {
    const validation = validateExpenditure(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const user = req.session.user;
    const exp = await Expenditure.create({
      ...validation.data,
      created_by: user.id
    });

    res.status(201).json({ success: true, data: exp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.postApproveExpenditure = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.session.user;
    const exp = await Expenditure.approve(id, user.id);
    res.json({ success: true, data: exp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.postRejectExpenditure = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.session.user;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required (min 5 chars).' });
    }

    const exp = await Expenditure.reject(id, user.id, reason.trim());
    res.json({ success: true, data: exp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
