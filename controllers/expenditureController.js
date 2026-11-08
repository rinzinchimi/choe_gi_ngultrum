const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const Question = require('../models/Question');
const db = require('../config/db');

exports.getExpenditures = async (req, res) => {
  try {
    const user = req.session.user;
    const isStaff = user && ['admin', 'finance_officer', 'auditor'].includes(user.role);

    // Regular students and public only see approved and published records
    const publishedOnly = !isStaff;

    const {
      search,
      category_id,
      department,
      club_id,
      event_id,
      start_date,
      end_date,
      min_amount,
      max_amount,
      status,
      page = 1
    } = req.query;

    const result = await Expenditure.getAll({
      publishedOnly,
      status: isStaff ? status : null,
      categoryId: category_id,
      department,
      clubId: club_id,
      eventId: event_id,
      startDate: start_date,
      endDate: end_date,
      minAmount: min_amount,
      maxAmount: max_amount,
      search,
      page: parseInt(page, 10) || 1,
      limit: 12
    });

    const categories = await Category.getAll();
    const clubs = await db.any('SELECT id, name FROM clubs ORDER BY name ASC');
    const events = await db.any('SELECT id, name FROM events ORDER BY name ASC');

    res.render('expenditures', {
      title: 'Expenditure Tracking - Choe Gi Ngultrum',
      page: 'expenditures',
      expenditures: result.rows,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        limit: result.limit
      },
      filters: req.query,
      categories,
      clubs,
      events,
      isStaff
    });
  } catch (err) {
    console.error('Expenditures list error:', err);
    res.status(500).render('about', {
      title: 'Expenditure Tracking Error',
      page: 'error',
      errorMessage: 'Could not retrieve expenditure records.'
    });
  }
};

exports.getExpenditureDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const expenditure = await Expenditure.findById(id);

    if (!expenditure) {
      return res.status(404).render('about', {
        title: 'Expenditure Not Found',
        page: 'error',
        errorMessage: 'The requested expenditure record does not exist or may have been relocated.'
      });
    }

    const user = req.session.user;
    const isStaff = user && ['admin', 'finance_officer', 'auditor'].includes(user.role);

    // If record is not published/approved and viewer is not staff, return 404
    if (!expenditure.is_published && !isStaff) {
      return res.status(404).render('about', {
        title: 'Record Unavailable',
        page: 'error',
        errorMessage: 'This expenditure record is currently under review or verification and is not yet published.'
      });
    }

    const documents = await Document.findByExpenditureId(id);
    const auditTrail = await AuditLog.findByEntity('expenditure', id);
    const questions = await Question.findByExpenditureId(id, !isStaff);
    const reviewFlags = await Expenditure.getFlags(id);

    // Polite question template as required:
    // "I would like clarification about the Nu. {amount} expenditure under the {category} category."
    const questionTemplate = `I would like clarification about the Nu. ${Number(expenditure.amount).toLocaleString()} expenditure under the ${expenditure.category_name} category.`;

    res.render('expenditure-detail', {
      title: `${expenditure.purpose} - Choe Gi Ngultrum`,
      page: 'expenditures',
      expenditure,
      documents,
      auditTrail,
      questions,
      reviewFlags,
      questionTemplate,
      isStaff,
      user
    });
  } catch (err) {
    console.error('Expenditure detail error:', err);
    res.status(500).render('about', {
      title: 'Record Error',
      page: 'error',
      errorMessage: 'Could not load expenditure details.'
    });
  }
};
