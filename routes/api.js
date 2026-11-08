const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const { requireAuthApi, requireRoleApi } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// Public API Endpoints
// ---------------------------------------------------------------------------
router.get('/stats', apiController.getStats);
router.get('/categories', apiController.getCategories);
router.get('/expenditures', apiController.getExpenditures);
router.get('/expenditures/:id', apiController.getExpenditureById);
router.get('/analytics', apiController.getAnalytics);

// ---------------------------------------------------------------------------
// Authenticated API Endpoints
// ---------------------------------------------------------------------------
router.post('/questions', requireAuthApi, apiController.postQuestion);
router.get('/notifications', requireAuthApi, apiController.getNotifications);

// ---------------------------------------------------------------------------
// Staff API Endpoints (Finance Officer / Admin)
// ---------------------------------------------------------------------------
router.post(
  '/expenditures',
  requireRoleApi('admin', 'finance_officer', 'student_leader'),
  apiController.postExpenditure
);

router.post(
  '/expenditures/:id/approve',
  requireRoleApi('admin'),
  apiController.postApproveExpenditure
);

router.post(
  '/expenditures/:id/reject',
  requireRoleApi('admin'),
  apiController.postRejectExpenditure
);

module.exports = router;

