const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');
const Notification = require('../models/Notification');

exports.getDashboard = async (req, res) => {
  try {
    const stats = await Expenditure.getSummaryStats();
    const categoriesWithSpend = await Category.getSummaryWithSpend();
    const recent = await Expenditure.getAll({
      publishedOnly: true,
      limit: 8,
      sortBy: 'spent_on',
      sortOrder: 'DESC'
    });

    const unreadNotifications = req.session.user
      ? await Notification.countUnread(req.session.user.id)
      : 0;

    res.render('dashboard', {
      title: 'Student Dashboard - Choe Gi Ngultrum',
      page: 'dashboard',
      stats,
      categories: categoriesWithSpend,
      recentExpenses: recent.rows,
      unreadNotifications,
      demoNotice: true
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('about', {
      title: 'Dashboard Error',
      page: 'error',
      errorMessage: 'Could not load dashboard data at this time.'
    });
  }
};
