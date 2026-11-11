const Expenditure = require('../models/Expenditure');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

exports.getLeaderDashboard = async (req, res) => {
  try {
    const user = req.session.user;
    const result = await Expenditure.getAll({
      createdBy: user.id,
      clubId: user.club_id,
      createdByOrClubId: true,
      limit: 10,
      page: 1,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });
    const unreadNotifications = await Notification.countUnread(user.id);

    return res.render('leader-dashboard', {
      title: 'Student Leader Dashboard - Choe Gi Ngultrum',
      page: 'leader-dashboard',
      clubName: user.club_name || null,
      expenditures: result.rows,
      total: result.total,
      unreadNotifications
    });
  } catch (error) {
    console.error('Leader dashboard failed:', error.code || 'DATABASE_ERROR');
    return res.status(500).render('about', {
      title: 'Leader Dashboard Error',
      page: 'error',
      errorMessage: 'Could not load your leader dashboard.'
    });
  }
};

exports.getAuditorDashboard = async (req, res) => {
  try {
    const [recentAudit, auditCount, stats] = await Promise.all([
      AuditLog.getAll({ limit: 8 }),
      AuditLog.count(),
      Expenditure.getSummaryStats()
    ]);
    return res.render('auditor-dashboard', {
      title: 'Auditor Dashboard - Choe Gi Ngultrum',
      page: 'auditor-dashboard',
      recentAudit,
      auditCount,
      stats
    });
  } catch (error) {
    console.error('Auditor dashboard failed:', error.code || 'DATABASE_ERROR');
    return res.status(500).render('about', {
      title: 'Auditor Dashboard Error',
      page: 'error',
      errorMessage: 'Could not load the auditor dashboard.'
    });
  }
};
