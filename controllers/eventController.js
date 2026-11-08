const db = require('../config/db');

exports.getEvents = async (req, res) => {
  try {
    const events = await db.any(`
      SELECT 
        e.*,
        cl.name AS club_name,
        COALESCE(s.spent_total, 0) AS spent_total,
        (e.budget_amount - COALESCE(s.spent_total, 0)) AS remaining_amount,
        CASE 
          WHEN e.budget_amount > 0 
          THEN ROUND((COALESCE(s.spent_total, 0) / e.budget_amount * 100), 1)
          ELSE 0 
        END AS percent_spent
      FROM events e
      LEFT JOIN clubs cl ON cl.id = e.club_id
      LEFT JOIN (
        SELECT event_id, SUM(amount) AS spent_total
        FROM expenditures
        WHERE is_published = true AND status = 'approved' AND event_id IS NOT NULL
        GROUP BY event_id
      ) s ON s.event_id = e.id
      ORDER BY e.status ASC, e.id ASC
    `);

    res.render('events', {
      title: 'Events & Projects - Choe Gi Ngultrum',
      page: 'events',
      events,
      demoNotice: true
    });
  } catch (err) {
    console.error('Events error:', err);
    res.status(500).render('about', {
      title: 'Events & Projects Error',
      page: 'error',
      errorMessage: 'Could not retrieve events data.'
    });
  }
};

