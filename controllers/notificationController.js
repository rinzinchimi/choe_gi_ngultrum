const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const notifications = await Notification.getByUser(userId, 50);
    const unreadCount = await Notification.countUnread(userId);

    res.render('notifications', {
      title: 'Notifications - Choe Gi Ngultrum',
      page: 'notifications',
      notifications,
      unreadCount
    });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).render('about', {
      title: 'Notifications Error',
      page: 'error',
      errorMessage: 'Could not load notifications.'
    });
  }
};

exports.markRead = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;

    if (id === 'all') {
      await Notification.markAllAsRead(userId);
    } else {
      await Notification.markAsRead(parseInt(id, 10), userId);
    }

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({ success: true });
    }
    res.redirect('/notifications');
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).redirect('/notifications');
  }
};
