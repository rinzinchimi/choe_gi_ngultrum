const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const Question = require('../models/Question');
const User = require('../models/User');
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const db = require('../config/db');
const { validateExpenditure } = require('../utils/validators');

// 1. Admin Overview Dashboard
exports.getDashboard = async (req, res) => {
  try {
    const stats = await Expenditure.getSummaryStats();
    const categories = await Category.getSummaryWithSpend();
    const pendingList = await Expenditure.getAll({ status: 'pending', limit: 5 });
    const reviewList = await Expenditure.getAll({ status: 'requires_review', limit: 5 });
    const openQuestions = await Question.getAll({ status: 'open', limit: 5 });
    const recentAudit = await AuditLog.getAll({ limit: 6 });

    res.render('admin-dashboard', {
      title: 'Admin Overview - Choe Gi Ngultrum',
      page: 'admin-dashboard',
      stats,
      categories,
      pendingList: pendingList.rows,
      reviewList: reviewList.rows,
      openQuestions,
      recentAudit,
      demoNotice: true
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).render('about', {
      title: 'Admin Error',
      page: 'error',
      errorMessage: 'Could not load administrative overview.'
    });
  }
};

// 2. Admin Expenditures Management
exports.getExpenditures = async (req, res) => {
  try {
    const { status, category_id, search, page = 1 } = req.query;
    const result = await Expenditure.getAll({
      publishedOnly: false,
      status: status || null,
      categoryId: category_id || null,
      search: search || null,
      page: parseInt(page, 10) || 1,
      limit: 15
    });

    const categories = await Category.getAll();
    const clubs = await db.any('SELECT id, name FROM clubs ORDER BY name ASC');
    const events = await db.any('SELECT id, name FROM events ORDER BY name ASC');

    res.render('admin-expenditures', {
      title: 'Manage Expenditures - Choe Gi Ngultrum',
      page: 'admin-expenditures',
      expenditures: result.rows,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total
      },
      filters: req.query,
      categories,
      clubs,
      events,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Admin expenditures error:', err);
    res.status(500).render('about', {
      title: 'Admin Error',
      page: 'error',
      errorMessage: 'Could not load expenditures management.'
    });
  }
};

// Create expenditure (Finance Officer / Admin)
exports.postCreateExpenditure = async (req, res) => {
  try {
    const user = req.session.user;
    const validation = validateExpenditure(req.body);
    if (!validation.isValid) {
      return res.redirect('/admin/expenditures?error=' + encodeURIComponent(validation.errors.join(' ')));
    }

    const { spent_on, purpose, category_id, amount, department, club_id, event_id } = validation.data;

    const exp = await Expenditure.create({
      spent_on,
      purpose,
      category_id,
      department,
      club_id,
      event_id,
      amount,
      created_by: user.id
    });

    // Check if receipt file was uploaded
    if (req.file) {
      const fileUrl = `/uploads/${req.file.filename}`;
      await Document.create({
        expenditureId: exp.id,
        type: req.body.document_type || 'invoice',
        fileUrl,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mime: req.file.mimetype,
        size: req.file.size,
        uploadedBy: user.id
      });
    }

    const msg = exp.status === 'requires_review'
      ? 'Record saved. Note: A routine "Requires Review" status was assigned per guideline thresholds for administrative review.'
      : 'Expenditure created and submitted for verification approval.';

    res.redirect('/admin/expenditures?success=' + encodeURIComponent(msg));
  } catch (err) {
    console.error('Create expenditure error:', err);
    res.redirect('/admin/expenditures?error=' + encodeURIComponent('Failed to create expenditure: ' + err.message));
  }
};

// Edit expenditure
exports.postEditExpenditure = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.session.user;
    const validation = validateExpenditure(req.body);

    if (!validation.isValid) {
      return res.redirect(`/admin/expenditures?error=` + encodeURIComponent(validation.errors.join(' ')));
    }

    const { spent_on, purpose, category_id, amount, department, club_id, event_id } = validation.data;

    const updated = await Expenditure.update(id, {
      spent_on,
      purpose,
      category_id,
      department,
      club_id,
      event_id,
      amount,
      actor_id: user.id
    });

    const msg = updated.status === 'requires_review'
      ? 'Record updated. Flagged for review because the amount was modified or exceeds category threshold.'
      : 'Expenditure record updated successfully.';

    res.redirect('/admin/expenditures?success=' + encodeURIComponent(msg));
  } catch (err) {
    console.error('Edit expenditure error:', err);
    res.redirect('/admin/expenditures?error=' + encodeURIComponent(err.message));
  }
};

// Upload document / receipt
exports.postUploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.session.user;

    if (!req.file) {
      return res.redirect(`/expenditures/${id}?error=` + encodeURIComponent('Please select a valid document or receipt to upload.'));
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    await Document.create({
      expenditureId: parseInt(id, 10),
      type: req.body.type || 'invoice',
      fileUrl,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mime: req.file.mimetype,
      size: req.file.size,
      uploadedBy: user.id
    });

    res.redirect(`/expenditures/${id}?success=` + encodeURIComponent('Document uploaded and attached successfully.'));
  } catch (err) {
    console.error('Upload document error:', err);
    res.redirect(`/expenditures/${req.params.id}?error=` + encodeURIComponent('Upload failed: ' + err.message));
  }
};

// 3. Budgets Management
exports.getBudgets = async (req, res) => {
  try {
    const budgets = await Budget.getAll();
    const categories = await Category.getAll();
    const clubs = await db.any('SELECT id, name FROM clubs ORDER BY name ASC');
    const events = await db.any('SELECT id, name FROM events ORDER BY name ASC');
    const totalAllocated = await Budget.getTotalAllocated();

    res.render('admin-budgets', {
      title: 'Manage Budgets - Choe Gi Ngultrum',
      page: 'admin-budgets',
      budgets,
      categories,
      clubs,
      events,
      totalAllocated,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Budgets error:', err);
    res.status(500).render('about', {
      title: 'Budget Error',
      page: 'error',
      errorMessage: 'Could not load budget allocations.'
    });
  }
};

exports.postUpdateBudget = async (req, res) => {
  try {
    const { id, allocated_amount } = req.body;
    if (!id || !allocated_amount || Number(allocated_amount) < 0) {
      return res.redirect('/admin/budgets?error=' + encodeURIComponent('Valid budget ID and positive allocation amount required.'));
    }

    await Budget.update(id, Number(allocated_amount));
    res.redirect('/admin/budgets?success=' + encodeURIComponent('Budget allocation updated successfully.'));
  } catch (err) {
    console.error('Update budget error:', err);
    res.redirect('/admin/budgets?error=' + encodeURIComponent('Budget update failed.'));
  }
};

// 4. Approval Queue
exports.getApprovals = async (req, res) => {
  try {
    const pendingList = await Expenditure.getAll({ status: 'pending', limit: 50 });
    const reviewList = await Expenditure.getAll({ status: 'requires_review', limit: 50 });

    res.render('admin-approvals', {
      title: 'Approval & Review Queue - Choe Gi Ngultrum',
      page: 'admin-approvals',
      pendingList: pendingList.rows,
      reviewList: reviewList.rows,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Approvals error:', err);
    res.status(500).render('about', {
      title: 'Approvals Error',
      page: 'error',
      errorMessage: 'Could not load verification queue.'
    });
  }
};

exports.postApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.session.user;

    const exp = await Expenditure.approve(id, user.id);

    // Notify creator
    await Notification.create({
      userId: exp.created_by,
      type: 'approval',
      message: `Expenditure "${exp.purpose}" (Nu. ${Number(exp.amount).toLocaleString()}) was approved and published.`,
      link: `/expenditures/${exp.id}`
    });

    res.redirect('/admin/approvals?success=' + encodeURIComponent(`Record #${id} approved and published for college transparency.`));
  } catch (err) {
    console.error('Approve error:', err);
    res.redirect('/admin/approvals?error=' + encodeURIComponent('Approval failed: ' + err.message));
  }
};

exports.postReject = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const user = req.session.user;

    if (!rejection_reason || rejection_reason.trim().length < 5) {
      return res.redirect('/admin/approvals?error=' + encodeURIComponent('A constructive rejection reason is required (minimum 5 characters).'));
    }

    const exp = await Expenditure.reject(id, user.id, rejection_reason.trim());

    // Notify creator
    await Notification.create({
      userId: exp.created_by,
      type: 'rejection',
      message: `Expenditure "${exp.purpose}" was returned with note: ${rejection_reason.trim()}`,
      link: `/admin/expenditures`
    });

    res.redirect('/admin/approvals?success=' + encodeURIComponent(`Record #${id} marked as rejected with reason noted in audit trail.`));
  } catch (err) {
    console.error('Reject error:', err);
    res.redirect('/admin/approvals?error=' + encodeURIComponent('Rejection failed: ' + err.message));
  }
};

exports.postFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.session.user;

    if (!reason || reason.trim().length < 5) {
      return res.redirect('/admin/approvals?error=' + encodeURIComponent('A descriptive review reason is required.'));
    }

    await Expenditure.flag(id, user.id, reason.trim());
    res.redirect('/admin/approvals?success=' + encodeURIComponent(`Record #${id} marked for routine review.`));
  } catch (err) {
    console.error('Flag error:', err);
    res.redirect('/admin/approvals?error=' + encodeURIComponent(err.message));
  }
};

// 5. Questions Inbox
exports.getQuestions = async (req, res) => {
  try {
    const { status } = req.query;
    const questions = await Question.getAll({ status: status || null, limit: 100 });

    res.render('admin-questions', {
      title: 'Student Questions Inbox - Choe Gi Ngultrum',
      page: 'admin-questions',
      questions,
      filters: req.query,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Admin questions error:', err);
    res.status(500).render('about', {
      title: 'Inquiries Error',
      page: 'error',
      errorMessage: 'Could not load student questions.'
    });
  }
};

// 6. User and Role Management (Admin only)
exports.getUsers = async (req, res) => {
  try {
    const { role, search, page = 1 } = req.query;
    const users = await User.getAll({ role: role || null, search: search || null, limit: 50 });

    res.render('admin-users', {
      title: 'User Management - Choe Gi Ngultrum',
      page: 'admin-users',
      users,
      filters: req.query,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).render('about', {
      title: 'Users Error',
      page: 'error',
      errorMessage: 'Could not load user list.'
    });
  }
};

exports.postUpdateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const allowed = ['student', 'student_leader', 'finance_officer', 'admin', 'auditor'];

    if (!allowed.includes(role)) {
      return res.redirect('/admin/users?error=' + encodeURIComponent('Invalid role specified.'));
    }

    await User.updateRole(id, role);
    res.redirect('/admin/users?success=' + encodeURIComponent('User role updated successfully.'));
  } catch (err) {
    console.error('Update role error:', err);
    res.redirect('/admin/users?error=' + encodeURIComponent('Role update failed.'));
  }
};

// 7. Financial Reports & CSV Export
exports.getReports = async (req, res) => {
  try {
    const { category_id, period, club_id } = req.query;
    const categories = await Category.getSummaryWithSpend();
    const stats = await Expenditure.getSummaryStats();
    const clubs = await db.any('SELECT id, name FROM clubs ORDER BY name ASC');

    res.render('admin-reports', {
      title: 'Financial Reports - Choe Gi Ngultrum',
      page: 'admin-reports',
      categories,
      stats,
      clubs,
      filters: req.query
    });
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).render('about', {
      title: 'Reports Error',
      page: 'error',
      errorMessage: 'Could not generate report views.'
    });
  }
};

exports.getReportsCsv = async (req, res) => {
  try {
    const { category_id, status } = req.query;
    const expenditures = await Expenditure.getAll({
      publishedOnly: false,
      status: status || null,
      categoryId: category_id || null,
      limit: 1000
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="choe_gi_ngultrum_expenditures.csv"');

    // CSV Header
    let csv = 'ID,Date,Purpose,Category,Department,Club,Amount (Nu.),Status,Published,Created By\n';

    expenditures.rows.forEach(e => {
      const purposeEscaped = `"${(e.purpose || '').replace(/"/g, '""')}"`;
      const catEscaped = `"${(e.category_name || '').replace(/"/g, '""')}"`;
      const deptEscaped = `"${(e.department || '').replace(/"/g, '""')}"`;
      const clubEscaped = `"${(e.club_name || '').replace(/"/g, '""')}"`;
      const creatorEscaped = `"${(e.creator_name || '').replace(/"/g, '""')}"`;

      csv += `${e.id},${e.spent_on},${purposeEscaped},${catEscaped},${deptEscaped},${clubEscaped},${e.amount},${e.status},${e.is_published},${creatorEscaped}\n`;
    });

    res.send(csv);
  } catch (err) {
    console.error('CSV Export error:', err);
    res.status(500).send('Error generating CSV export.');
  }
};
