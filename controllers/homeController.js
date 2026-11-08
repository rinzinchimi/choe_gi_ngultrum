const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');

exports.getIndex = async (req, res) => {
  try {
    const stats = await Expenditure.getSummaryStats();
    const categories = await Category.getAll();
    const recent = await Expenditure.getAll({
      publishedOnly: true,
      limit: 6,
      sortBy: 'spent_on',
      sortOrder: 'DESC'
    });

    res.render('index', {
      title: 'Choe Gi Ngultrum (ཁྱོད་ཀྱི་དངུལ་ཀྲམ།) - Your Money, Our Transparency',
      page: 'home',
      stats,
      categories,
      recentExpenses: recent.rows,
      demoNotice: true
    });
  } catch (err) {
    console.error('Home controller error:', err);
    res.status(500).render('about', {
      title: 'Server Error',
      page: 'error',
      errorMessage: 'Could not load homepage data. Please try again later.'
    });
  }
};
