const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

exports.getAuditLog = async (req, res) => {
  try {
    const { action, entityType, actorId, page = 1 } = req.query;
    const limit = 25;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * limit;

    const logs = await AuditLog.getAll({
      action: action || null,
      entityType: entityType || null,
      actorId: actorId ? parseInt(actorId, 10) : null,
      limit,
      offset
    });

    const total = await AuditLog.count({
      action: action || null,
      entityType: entityType || null
    });

    const users = await User.getAll({ limit: 100 });

    res.render('audit-log', {
      title: 'Audit Trail Log - Choe Gi Ngultrum',
      page: 'audit-log',
      logs,
      pagination: {
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit) || 1,
        total
      },
      filters: req.query,
      users
    });
  } catch (err) {
    console.error('Audit log controller error:', err);
    res.status(500).render('about', {
      title: 'Audit Log Error',
      page: 'error',
      errorMessage: 'Could not load audit log records.'
    });
  }
};

