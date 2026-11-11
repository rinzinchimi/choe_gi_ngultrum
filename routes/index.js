const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

// Controllers
const homeController = require('../controllers/homeController');
const aboutController = require('../controllers/aboutController');
const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const expenditureController = require('../controllers/expenditureController');
const analyticsController = require('../controllers/analyticsController');
const eventController = require('../controllers/eventController');
const questionController = require('../controllers/questionController');
const notificationController = require('../controllers/notificationController');
const adminController = require('../controllers/adminController');
const auditorController = require('../controllers/auditorController');
const roleDashboardController = require('../controllers/roleDashboardController');

// Middleware
const { requireAuth, requireRole, csrfProtection, validateCsrf } = require('../middleware/auth');

// Generate CSRF tokens for rendered forms and validate ordinary form posts.
router.use(csrfProtection);

// Multer storage configuration for receipts & documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'doc-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF, JPG, and PNG files are accepted.'));
    }
  }
});

// ---------------------------------------------------------------------------
// Public Pages & Authentication
// ---------------------------------------------------------------------------
router.get('/', homeController.getIndex);
router.get('/about', aboutController.getAbout);

router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/resend-verification', authController.getResendVerification);
router.post('/resend-verification', validateCsrf, authController.postResendVerification);
router.post('/logout', authController.postLogout);

router.get('/signup', authController.getSignup);
router.post('/signup', authController.postSignup);
router.get('/signup-success', authController.getSignupSuccess);

router.get('/verify/:token', authController.getVerify);
router.get('/verify-success', (req, res) => res.render('verify-success', { title: 'Email Verified', page: 'verify' }));

router.get('/forgot-password', authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);
router.get('/reset-password/:token', authController.getResetPassword);
router.post('/reset-password/:token', authController.postResetPassword);

// ---------------------------------------------------------------------------
// Student & General Transparency Routes (Student, Leader, Finance, Admin, Auditor)
// ---------------------------------------------------------------------------
router.get('/dashboard', requireAuth, dashboardController.getDashboard);
router.get('/leader/dashboard', requireRole('student_leader'), roleDashboardController.getLeaderDashboard);
router.get('/auditor/dashboard', requireRole('auditor'), roleDashboardController.getAuditorDashboard);
router.get('/expenditures', expenditureController.getExpenditures); // Publicly viewable, richer if logged in
router.get('/expenditures/:id', expenditureController.getExpenditureDetail);
router.post('/expenditures/:id/question', requireAuth, questionController.postQuestion);

router.get('/analytics', analyticsController.getAnalytics);
router.get('/events', eventController.getEvents);

router.get('/notifications', requireAuth, notificationController.getNotifications);
router.post('/notifications/:id/read', requireAuth, notificationController.markRead);

// Auditor shortcut route
router.get('/audit-log', requireRole('auditor', 'admin'), auditorController.getAuditLog);

// ---------------------------------------------------------------------------
// Admin & Finance Officer Routes
// ---------------------------------------------------------------------------
// Admin overview
router.get('/admin/dashboard', requireRole('admin', 'finance_officer'), adminController.getDashboard);

// Manage expenditures
router.get('/admin/expenditures', requireRole('admin', 'finance_officer', 'student_leader'), adminController.getExpenditures);
router.post('/admin/expenditures', requireRole('admin', 'finance_officer', 'student_leader'), upload.single('document'), validateCsrf, adminController.postCreateExpenditure);
router.post('/admin/expenditures/:id/edit', requireRole('admin', 'finance_officer'), adminController.postEditExpenditure);
router.post('/admin/expenditures/:id/upload', requireRole('admin', 'finance_officer'), upload.single('document'), validateCsrf, adminController.postUploadDocument);

// Manage budgets
router.get('/admin/budgets', requireRole('admin', 'finance_officer'), adminController.getBudgets);
router.post('/admin/budgets', requireRole('admin'), adminController.postUpdateBudget);

// Verification and Approvals queue
router.get('/admin/approvals', requireRole('admin'), adminController.getApprovals);
router.post('/admin/approvals/:id/approve', requireRole('admin'), adminController.postApprove);
router.post('/admin/approvals/:id/reject', requireRole('admin'), adminController.postReject);
router.post('/admin/approvals/:id/flag', requireRole('admin'), adminController.postFlag);

// Questions inbox
router.get('/admin/questions', requireRole('admin', 'finance_officer'), adminController.getQuestions);
router.post('/admin/questions/:id/answer', requireRole('admin', 'finance_officer'), questionController.answerQuestion);

// Users management (Admin only)
router.get('/admin/users', requireRole('admin'), adminController.getUsers);
router.post('/admin/users/:id/role', requireRole('admin'), adminController.postUpdateUserRole);
router.get('/admin/role-approvals', requireRole('admin'), adminController.getRoleApprovals);
router.post('/admin/role-approvals/:id/approve', requireRole('admin'), validateCsrf, adminController.postApproveRoleApplication);
router.post('/admin/role-approvals/:id/reject', requireRole('admin'), validateCsrf, adminController.postRejectRoleApplication);

// Reports & CSV export
router.get('/admin/reports', requireRole('admin', 'finance_officer', 'auditor'), adminController.getReports);
router.get('/admin/reports/csv', requireRole('admin', 'finance_officer', 'auditor'), adminController.getReportsCsv);

// Audit log in admin panel
router.get('/admin/audit-log', requireRole('admin', 'auditor'), auditorController.getAuditLog);

module.exports = router;

