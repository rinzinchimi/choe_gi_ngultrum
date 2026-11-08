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
      const verificationToken = crypto.randomBytes(32).toString('hex');
      await User.setVerificationToken(user.id, verificationToken);
      let verificationUrl = null;
      let verificationMessage = 'A new verification email was sent. Check your inbox and spam folder.';

      try {
        const emailResult = await sendVerificationEmail(user.email, verificationToken);
        if (emailResult.dev) {
          verificationUrl = emailResult.url;
          verificationMessage = 'The email service is unavailable in development. Use the button below to verify your account.';
        }
      } catch (emailErr) {
        console.error('Login verification email failed:', emailErr.code || emailErr.message);
        verificationMessage = emailErr.code === 'EAUTH'
          ? 'Gmail rejected the sender login. Correct the app password, or use the development verification link if available.'
          : 'The verification email could not be sent. Check the app server email configuration.';
      }

      return res.render('login', {
        title: 'Login - Choe Gi Ngultrum',
        page: 'login',
        error: verificationMessage,
        email,
        verificationUrl
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
    } else if (user.role === 'student_leader') {
      return res.redirect('/admin/expenditures');
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
      if (!existing.is_verified) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        await User.setVerificationToken(existing.id, verificationToken);

        try {
          const emailResult = await sendVerificationEmail(email, verificationToken);
          const delivery = emailResult.dev ? '&delivery=console' : '';
          return res.redirect('/signup-success?email=' + encodeURIComponent(email) + delivery);
        } catch (emailErr) {
          console.error('Verification email resend failed:', emailErr.code || emailErr.message);
          const emailErrorMessage = emailErr.code === 'EAUTH'
            ? 'Gmail rejected the configured email login. Update GMAIL_USER and GMAIL_APP_PASSWORD in .env, restart the app, and try again.'
            : 'Your account exists but the verification email could not be sent. Check the app server’s email configuration, then try again.';
          return res.status(502).render('signup', {
            title: 'Sign Up - Choe Gi Ngultrum',
            page: 'signup',
            errors: [emailErrorMessage],
            formData: req.body
          });
        }

      }

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

    try {
      const emailResult = await sendVerificationEmail(email, verificationToken);
      const delivery = emailResult.dev ? '&delivery=console' : '';
      return res.redirect('/signup-success?email=' + encodeURIComponent(email) + delivery);
    } catch (emailErr) {
      console.error('Verification email send failed:', emailErr.code || emailErr.message);
      const emailErrorMessage = emailErr.code === 'EAUTH'
        ? 'Gmail rejected the configured email login. Update GMAIL_USER and GMAIL_APP_PASSWORD in .env, restart the app, and try again.'
        : 'Your account was created, but the verification email could not be sent. Check the app server’s email configuration. You can submit this email address again to retry.';
      return res.status(502).render('signup', {
        title: 'Sign Up - Choe Gi Ngultrum',
        page: 'signup',
        errors: [emailErrorMessage],
        formData: req.body
      });
    }

  } catch (err) {
    console.error('Signup error:', err.code || err.message);
    const message = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND'
      ? 'Could not connect to the database. Check that PostgreSQL is running and the database settings are correct.'
      : err.code === '23505'
        ? 'An account with this email already exists. Try signing in or requesting another verification email.'
        : 'Registration failed because of a server error. Check the app server terminal for the signup error.';
    res.status(500).render('signup', {
      title: 'Sign Up - Choe Gi Ngultrum',
      page: 'signup',
      errors: [message],
      formData: req.body
    });
  }
};

exports.getSignupSuccess = (req, res) => {
  res.render('signup-success', {
    title: 'Registration Successful - Verify Email',
    page: 'signup',
    email: req.query.email || '',
    delivery: req.query.delivery === 'console'
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

