const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const { validateSignup, isValidPassword } = require('../utils/validators');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../config/mailer');

exports.getLogin = (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    title: 'Login - Choe Gi Ngultrum',
    page: 'login',
    error: req.query.error || null,
    success: req.query.success || null
  });
};

exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.render('login', {
        title: 'Login - Choe Gi Ngultrum',
        page: 'login',
        error: 'Please provide both email and password.',
        email
      });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.render('login', {
        title: 'Login - Choe Gi Ngultrum',
        page: 'login',
        error: 'Invalid credentials. Please verify your email and password.',
        email
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.render('login', {
        title: 'Login - Choe Gi Ngultrum',
        page: 'login',
        error: 'Invalid credentials. Please verify your email and password.',
        email
      });
    }

    if (!user.is_verified) {
      return res.render('login', {
        title: 'Login - Choe Gi Ngultrum',
        page: 'login',
        error: 'Please verify your college email before logging in. Check your inbox or contact administration.',
        email
      });
    }

    // Set session user
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      club_id: user.club_id
    };

    const returnTo = req.session.returnTo;
    delete req.session.returnTo;

    if (returnTo) {
      return res.redirect(returnTo);
    }

    // Redirect based on role
    if (['admin', 'finance_officer'].includes(user.role)) {
      return res.redirect('/admin/dashboard');
    } else if (user.role === 'auditor') {
      return res.redirect('/audit-log');
    }
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('login', {
      title: 'Login - Choe Gi Ngultrum',
      page: 'login',
      error: 'An unexpected error occurred during login. Please try again.'
    });
  }
};

exports.postLogout = (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Logout error:', err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};

exports.getSignup = (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('signup', {
    title: 'Sign Up - Choe Gi Ngultrum',
    page: 'signup',
    errors: [],
    formData: {}
  });
};

exports.postSignup = async (req, res) => {
  try {
    const validation = validateSignup(req.body);
    if (!validation.isValid) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Choe Gi Ngultrum',
        page: 'signup',
        errors: validation.errors,
        formData: req.body
      });
    }

    const { name, email, password } = validation.data;

    // Check duplicate email
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Choe Gi Ngultrum',
        page: 'signup',
        errors: ['An account with this email address already exists.'],
        formData: req.body
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await User.create({
      name,
      email,
      passwordHash,
      role: 'student', // Self signup is always student
      verificationToken,
      department: req.body.department || null
    });

    await sendVerificationEmail(email, verificationToken);

    res.redirect('/signup-success?email=' + encodeURIComponent(email));
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).render('signup', {
      title: 'Sign Up - Choe Gi Ngultrum',
      page: 'signup',
      errors: ['Registration failed due to a server error. Please try again.'],
      formData: req.body
    });
  }
};

exports.getSignupSuccess = (req, res) => {
  res.render('signup-success', {
    title: 'Registration Successful - Verify Email',
    page: 'signup',
    email: req.query.email || ''
  });
};

exports.getVerify = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findByVerificationToken(token);
    if (!user) {
      return res.status(400).render('about', {
        title: 'Verification Failed',
        page: 'error',
        errorMessage: 'Invalid or expired verification token. Please request a new verification or sign up again.'
      });
    }

    await User.verifyEmail(user.id);
    res.render('verify-success', {
      title: 'Email Verified Successfully',
      page: 'verify'
    });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).render('about', {
      title: 'Verification Error',
      page: 'error',
      errorMessage: 'Could not complete email verification. Please contact support.'
    });
  }
};

exports.getForgotPassword = (req, res) => {
  res.render('forgot-password', {
    title: 'Forgot Password - Choe Gi Ngultrum',
    page: 'auth',
    message: null,
    error: null
  });
};

exports.postForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.render('forgot-password', {
        title: 'Forgot Password - Choe Gi Ngultrum',
        page: 'auth',
        message: null,
        error: 'Please enter your account email address.'
      });
    }

    const user = await User.findByEmail(email);
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await User.setResetToken(user.id, resetToken, expiresAt);
      await sendPasswordResetEmail(user.email, resetToken);
    }

    // Always show generic message to avoid email enumeration
    res.render('forgot-password', {
      title: 'Forgot Password - Choe Gi Ngultrum',
      page: 'auth',
      message: 'If an account exists with that email, a password reset link has been dispatched.',
      error: null
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).render('forgot-password', {
      title: 'Forgot Password',
      page: 'auth',
      message: null,
      error: 'Unable to process reset request at this time.'
    });
  }
};

exports.getResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findByResetToken(token);
    if (!user) {
      return res.status(400).render('about', {
        title: 'Reset Link Expired',
        page: 'error',
        errorMessage: 'This password reset link is invalid or has expired. Please request a new one.'
      });
    }

    res.render('reset-password', {
      title: 'Reset Password - Choe Gi Ngultrum',
      page: 'auth',
      token,
      error: null
    });
  } catch (err) {
    console.error('Reset password get error:', err);
    res.status(500).render('about', {
      title: 'Reset Error',
      page: 'error',
      errorMessage: 'Could not load password reset page.'
    });
  }
};

exports.postResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    const user = await User.findByResetToken(token);
    if (!user) {
      return res.status(400).render('about', {
        title: 'Reset Link Expired',
        page: 'error',
        errorMessage: 'This password reset link is invalid or has expired.'
      });
    }

    if (!isValidPassword(password)) {
      return res.render('reset-password', {
        title: 'Reset Password',
        page: 'auth',
        token,
        error: 'Password must be at least 8 characters with uppercase, lowercase, and numeric characters.'
      });
    }

    if (password !== confirmPassword) {
      return res.render('reset-password', {
        title: 'Reset Password',
        page: 'auth',
        token,
        error: 'Passwords do not match.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.updatePassword(user.id, passwordHash);

    res.redirect('/login?success=' + encodeURIComponent('Your password has been reset successfully. Please log in.'));
  } catch (err) {
    console.error('Reset password post error:', err);
    res.status(500).render('about', {
      title: 'Reset Error',
      page: 'error',
      errorMessage: 'Could not update password. Please try again.'
    });
  }
};
