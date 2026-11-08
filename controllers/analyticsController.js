const Category = require('../models/Category');
const Expenditure = require('../models/Expenditure');

exports.getAnalytics = async (req, res) => {
  try {
    const stats = await Expenditure.getSummaryStats();
    const categoriesWithSpend = await Category.getSummaryWithSpend();
    const monthlySpend = await Expenditure.getMonthlySpend();

    res.render('analytics', {
      title: 'Financial Analytics - Choe Gi Ngultrum',
      page: 'analytics',
      stats,
      categories: categoriesWithSpend,
      monthlySpend,
      demoNotice: true
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).render('about', {
      title: 'Analytics Error',
      page: 'error',
      errorMessage: 'Could not load analytics charts.'
    });
  }
};

