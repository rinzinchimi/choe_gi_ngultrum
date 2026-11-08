/**
 * Authentication and Role-Based Access Control (RBAC) Middleware
 */

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  // Store return URL for redirect after login
  if (req.originalUrl && req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
    req.session.returnTo = req.originalUrl;
  }
  return res.redirect('/login');
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.originalUrl && req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
        req.session.returnTo = req.originalUrl;
      }
      return res.redirect('/login');
    }

    const userRole = req.session.user.role;
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Role mismatch: 403 Forbidden
    res.status(403);
    return res.render('about', {
      title: '403 Forbidden - Access Restricted',
      page: 'error',
      errorMessage: 'Access restricted: Your account role does not have authorization to view this resource.',
      status: 403
    });
  };
}

function requireAuthApi(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    error: 'Authentication required. Please log in.'
  });
}

function requireRoleApi(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    const userRole = req.session.user.role;
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Forbidden: Insufficient permissions for this action.'
    });
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
