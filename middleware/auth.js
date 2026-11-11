/**
 * Authentication and Role-Based Access Control (RBAC) Middleware
 */
const User = require('../models/User');

async function getCurrentUser(req) {
  if (req.authenticatedUser) return req.authenticatedUser;
  if (!req.session || !req.session.user) return null;

  const user = await User.findById(req.session.user.id);
  if (!user) return null;

  // Refresh authorization facts from the database on every protected request;
  // do not trust a role stored in an old or modified session.
  Object.assign(req.session.user, {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_verified: user.is_verified,
    requested_role: user.requested_role,
    approval_status: user.approval_status,
    department: user.department,
    club_id: user.club_id,
    club_name: user.club_name,
    institution_id: user.institution_id,
    designation: user.designation
  });
  req.authenticatedUser = user;
  return user;
}

function accountAccessError(user) {
  if (!user.is_verified) return 'Verify your email before using protected account features.';
  if (user.approval_status === 'pending') return 'Your email is verified. Your role application is waiting for administrator approval.';
  if (user.approval_status === 'rejected') return `Your role application was rejected${user.rejection_reason ? `: ${user.rejection_reason}` : '.'}`;
  if (user.approval_status === 'suspended') return 'This account is suspended. Contact the administrator for assistance.';
  if (user.approval_status !== 'approved') return 'This account is not approved for access.';
  return null;
}

function isConfiguredAdministrator(user) {
  const configuredEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return Boolean(configuredEmail && user.role === 'admin' && user.email.toLowerCase() === configuredEmail);
}

function renderForbidden(res, message) {
  return res.status(403).render('about', {
    title: '403 Forbidden - Access Restricted',
    page: 'error',
    errorMessage: message,
    status: 403
  });
}

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.originalUrl && req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/login');
  }

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      delete req.session.user;
      return res.redirect('/login');
    }
    const blocked = accountAccessError(user);
    if (blocked) return renderForbidden(res, blocked);
    if (user.role === 'admin' && !isConfiguredAdministrator(user)) {
      return renderForbidden(res, 'Administrator access is reserved for the account configured by ADMIN_EMAIL.');
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.originalUrl && req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
        req.session.returnTo = req.originalUrl;
      }
      return res.redirect('/login');
    }

    try {
      const user = await getCurrentUser(req);
      if (!user) {
        delete req.session.user;
        return res.redirect('/login');
      }
      const blocked = accountAccessError(user);
      if (blocked) return renderForbidden(res, blocked);
      if (user.role === 'admin' && !isConfiguredAdministrator(user)) {
        return renderForbidden(res, 'Administrator access is reserved for the account configured by ADMIN_EMAIL.');
      }
      if (allowedRoles.includes(user.role)) return next();

      return renderForbidden(res, 'Access restricted: Your account role does not have authorization to view this resource.');
    } catch (error) {
      return next(error);
    }
  };
}

async function requireAuthApi(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.'
    });
  }
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      delete req.session.user;
      return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    }
    const blocked = accountAccessError(user);
    if (blocked) return res.status(403).json({ success: false, error: blocked });
    if (user.role === 'admin' && !isConfiguredAdministrator(user)) {
      return res.status(403).json({ success: false, error: 'Administrator access is not configured for this account.' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRoleApi(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    try {
      const user = await getCurrentUser(req);
      if (!user) {
        delete req.session.user;
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const blocked = accountAccessError(user);
      if (blocked) return res.status(403).json({ success: false, error: blocked });
      if (user.role === 'admin' && !isConfiguredAdministrator(user)) {
        return res.status(403).json({ success: false, error: 'Administrator access is not configured for this account.' });
      }
      if (allowedRoles.includes(user.role)) return next();
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions for this action.' });
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Lightweight CSRF token generator & validator
 */
function csrfProtection(req, res, next) {
  if (!req.session) {
    return next();
  }

  // Generate session CSRF token if absent
  if (!req.session.csrfToken) {
    const crypto = require('crypto');
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;

  // Skip CSRF validation during automated tests
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Validate on state-changing methods (POST, PUT, DELETE, PATCH)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Exempt API requests if API uses session or API key
    if (req.path.startsWith('/api/')) {
      return next();
    }

    // Defer multipart requests until after multer middleware parses form fields into req.body
    if (req.is('multipart/form-data')) {
      return next();
    }

    const submittedToken = (req.body && req.body._csrf) || req.query._csrf || req.headers['x-csrf-token'];
    if (!submittedToken || submittedToken !== req.session.csrfToken) {
      return res.status(403).render('about', {
        title: '403 - Invalid Session Token',
        page: 'error',
        errorMessage: 'Invalid or expired form session token. Please refresh the page and try again.',
        status: 403
      });
    }
  }

  next();
}

/**
 * Secondary CSRF validator applied after multer parses multipart/form-data bodies
 */
function validateCsrf(req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const submittedToken = (req.body && req.body._csrf) || req.query._csrf || req.headers['x-csrf-token'];
  if (!submittedToken || !req.session || submittedToken !== req.session.csrfToken) {
    // Clean up uploaded file if CSRF verification fails
    if (req.file && req.file.path) {
      const fs = require('fs');
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        // Ignore unlink error
      }
    }

    return res.status(403).render('about', {
      title: '403 - Invalid Session Token',
      page: 'error',
      errorMessage: 'Invalid or expired form session token. Please refresh the page and try again.',
      status: 403
    });
  }

  next();
}

module.exports = {
  requireAuth,
  requireRole,
  requireAuthApi,
  requireRoleApi,
  csrfProtection,
  validateCsrf
};
