const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectMongo } = require('./config/mongo');

const app = express();

// Render terminates HTTPS at its edge proxy. Trust that single proxy so
// express-session can detect X-Forwarded-Proto=https and issue secure cookies.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers with CSP tailored for Chart.js & Google Fonts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"]
      }
    }
  })
);

// Static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'dev-secret-key-at-least-32-characters-long',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
};

if (process.env.NODE_ENV === 'production') {
  const PgSession = require('connect-pg-simple')(session);
  const { Pool } = require('pg');
  const sessionDbConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS
      };
  sessionOptions.store = new PgSession({
    pool: new Pool({ ...sessionDbConfig, max: 5 }),
    createTableIfMissing: true
  });
}

app.use(session(sessionOptions));

// Global locals for views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  next();
});

// Rate limiting on sensitive endpoints (skip during automated tests)
if (process.env.NODE_ENV !== 'test') {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this network address. Please try again after 15 minutes.'
  });

  const verificationResendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many verification requests. Please wait before trying again.'
  });

  app.use('/login', authLimiter);
  app.use('/signup', authLimiter);
  app.use('/forgot-password', authLimiter);
  app.post('/resend-verification', verificationResendLimiter);
  app.use('/api/questions', authLimiter);

  // Initialize MongoDB connection asynchronously if enabled
  connectMongo().catch(err => {
    console.warn('Mongo initialization caught:', err.message);
  });
}

// Routes
app.use('/', require('./routes/index'));
app.use('/api', require('./routes/api'));

// 404 Handler
app.use((req, res) => {
  res.status(404).render('about', {
    title: '404 - Page Not Found',
    page: 'error',
    errorMessage: `The page at "${req.originalUrl}" could not be found.`,
    status: 404
  });
});

// 500 Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled application error:', err);
  if (res.headersSent) return next(err);

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }

  res.status(500).render('about', {
    title: '500 - Server Error',
    page: 'error',
    errorMessage: 'An unexpected server error occurred. Our technical staff has been notified.',
    status: 500
  });
});

module.exports = app;

