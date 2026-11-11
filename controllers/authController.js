const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const { validateSignup, isValidPassword, sanitizeText } = require('../utils/validators');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAdminApplicationEmail
} = require('../config/mailer');
const Notification = require('../models/Notification');

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
let dummyPasswordHashPromise = null;

function createVerificationToken() {
  return {
    token: crypto.randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)
  };
}

async function checkResendPassword(password, user) {
  if (user) return bcrypt.compare(password, user.password_hash);
  if (!dummyPasswordHashPromise) {
    const dummyPassword = crypto.randomBytes(32).toString('hex');
    dummyPasswordHashPromise = bcrypt.hash(dummyPassword, 10);
  }
  await bcrypt.compare(password, await dummyPasswordHashPromise);
  return false;
}

async function notifyAdministratorOfRoleApplication(applicant) {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
  if (!adminEmail) {
    console.error('Role application administrator notification skipped: ADMIN_EMAIL is not configured.');
    return;
  }

  try {
    const admin = await User.findByEmail(adminEmail);
    if (admin && admin.role === 'admin' && admin.email.toLowerCase() === adminEmail.toLowerCase()) {
      try {
        await Notification.create({
          userId: admin.id,
          type: 'approval',
          message: `New ${applicant.requestedRole.replace('_', ' ')} application from ${applicant.name}.`,
          link: '/admin/role-approvals'
        });
      } catch (notificationError) {
        console.error('Administrator application notification failed:', notificationError.code || 'NOTIFICATION_ERROR');
      }
    }
  } catch (lookupError) {
    console.error('Administrator notification lookup failed:', lookupError.code || 'DATABASE_ERROR');
  }

  try {
    await sendAdminApplicationEmail(adminEmail, applicant);
  } catch (emailError) {
    console.error('Administrator application email failed:', emailError.code || 'SMTP_ERROR');
  }
}

function getVerificationEmailErrorMessage(error) {
  if (error.code === 'EAUTH') {
    return 'Gmail rejected the sender login. Check that 2-Step Verification is enabled and configure a fresh Gmail App Password.';
  }
  if (error.code === 'EMAIL_CONFIG_INVALID_APP_PASSWORD_LENGTH') {
    return 'GMAIL_APP_PASSWORD must be the complete 16-character Gmail App Password. Update .env and restart the app.';
  }
  if (error.code === 'EMAIL_CONFIG_INCOMPLETE' || error.code === 'EMAIL_CONFIG_INVALID_USER') {
    return 'Set a valid GMAIL_USER and GMAIL_APP_PASSWORD in .env, then restart the app.';
  }
  return 'The verification email could not be sent. Check the app server email configuration and try again.';
}

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
        error: 'Your account is not verified yet. Use the resend verification option to request a new email.',
        email
      });
    }

    if (user.approval_status === 'pending') {
      return res.render('login', {
        title: 'Login - Choe Gi Ngultrum',
        page: 'login',
        error: 'Your email is verified. Your role application is waiting for administrator approval.',
        email
      });
    }
    if (user.approval_status === 'rejected') {
      return res.render('login', {
        title: 'Login - Choe Gi Ngultrum',
        page: 'login',
        error: `Your role application was rejected${user.rejection_reason ? `: ${user.rejection_reason}` : '.'}`,
        email
      });
    }
    if (user.approval_status === 'suspended') {
      return res.render('login', {
        title: 'Login - Choe Gi Ngultrum',
        page: 'login',
        error: 'This account is suspended. Contact the administrator for assistance.',
        email
      });
    }
    if (user.role === 'admin' && String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() !== user.email.toLowerCase()) {
      return res.render('login', {
        title: 'Login - Choe Gi Ngultrum',
        page: 'login',
        error: 'Administrator access is available only to the configured administrator account.',
        email
      });
    }

    // Set session user
    req.session.user = {
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
      return res.redirect('/auditor/dashboard');
    } else if (user.role === 'student_leader') {
      return res.redirect('/leader/dashboard');
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
    // Keep the address as entered for delivery; the database stores a
    // lowercase canonical address for case-insensitive account lookup.
    const deliveryEmail = String(req.body.email).trim();
    const requestedRole = typeof req.body.requestedRole === 'string' ? req.body.requestedRole : 'student';
    const supportedRequestedRoles = ['student', 'student_leader', 'auditor'];
    const institutionId = sanitizeText(req.body.institutionId || '').slice(0, 100);
    const designation = sanitizeText(req.body.designation || '').slice(0, 100);
    const department = sanitizeText(req.body.department || '').slice(0, 120);
    const applicationErrors = [];

    if (!supportedRequestedRoles.includes(requestedRole)) {
      applicationErrors.push('Select Student, Student Leader Applicant, or Auditor Applicant. Administrator accounts are provisioned privately.');
    } else if (requestedRole === 'student_leader') {
      if (!institutionId) applicationErrors.push('Student ID is required for a Student Leader application.');
      if (!designation) applicationErrors.push('Enter the leadership position you are applying for.');
    } else if (requestedRole === 'auditor' && !institutionId) {
      applicationErrors.push('Staff ID is required for an Auditor application.');
    }

    if (applicationErrors.length) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Choe Gi Ngultrum',
        page: 'signup',
        errors: applicationErrors,
        formData: req.body
      });
    }

    // Check duplicate email
    const existing = await User.findByEmail(email);
    if (existing) {
      if (!existing.is_verified) {
        return res.status(409).render('signup', {
          title: 'Sign Up - Choe Gi Ngultrum',
          page: 'signup',
          errors: ['An unverified account already exists for this email. Sign in or use the resend verification option; you do not need to register again.'],
          formData: req.body
        });
      }

      return res.status(400).render('signup', {
        title: 'Sign Up - Choe Gi Ngultrum',
        page: 'signup',
        errors: ['An account with this email address already exists.'],
        formData: req.body
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { token: verificationToken, expiresAt } = createVerificationToken();
    const isRoleApplication = requestedRole !== 'student';

    await User.create({
      name,
      email,
      passwordHash,
      role: 'student', // Self signup is always student
      requestedRole: isRoleApplication ? requestedRole : null,
      approvalStatus: isRoleApplication ? 'pending' : 'approved',
      verificationToken,
      verificationTokenExpiresAt: expiresAt,
      department: department || null,
      institutionId: institutionId || null,
      designation: designation || null
    });

    if (isRoleApplication) {
      await notifyAdministratorOfRoleApplication({
        name,
        email: deliveryEmail,
        requestedRole,
        institutionId,
        department,
        designation
      });
    }

    try {
      const emailResult = await sendVerificationEmail(deliveryEmail, verificationToken, expiresAt);
      const delivery = emailResult.dev ? '&delivery=console' : '';
      const application = isRoleApplication ? '&application=' + encodeURIComponent(requestedRole) : '';
      return res.redirect('/signup-success?email=' + encodeURIComponent(email) + delivery + application);
    } catch (emailErr) {
      console.error('Verification email send failed:', emailErr.code || emailErr.message);
      const emailErrorMessage = `Your account was created, but the verification email was not sent. ${getVerificationEmailErrorMessage(emailErr)} You can use Resend Verification Email without registering again.`;
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

exports.getResendVerification = (req, res) => {
  res.render('resend-verification', {
    title: 'Resend Verification Email',
    page: 'auth',
    email: '',
    message: null,
    verificationUrl: null
  });
};

exports.postResendVerification = async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const genericMessage = 'Request received. If these credentials match an unverified account and the resend limit allows it, a verification email will be sent. Check your inbox and spam folder, or try again later.';

  try {
    if (email && password) {
      const user = await User.findByEmail(email);
      const passwordMatches = await checkResendPassword(password, user);
      if (user && !user.is_verified && passwordMatches) {
        const { token, expiresAt } = createVerificationToken();
        const updated = await User.setVerificationToken(
          user.id,
          token,
          expiresAt,
          VERIFICATION_RESEND_COOLDOWN_SECONDS
        );

        if (updated) {
          const emailResult = await sendVerificationEmail(user.email, token, expiresAt);
          if (emailResult.dev) {
            return res.render('resend-verification', {
              title: 'Resend Verification Email',
              page: 'auth',
              email,
              message: 'The verification email was not sent. Use this development-only link to verify your account.',
              verificationUrl: emailResult.url
            });
          }
        }
      }
    }

    return res.render('resend-verification', {
      title: 'Resend Verification Email',
      page: 'auth',
      email,
      message: genericMessage,
      verificationUrl: null
    });
  } catch (err) {
    console.error('Resend verification request failed:', err.code || 'UNEXPECTED_ERROR');
    return res.status(200).render('resend-verification', {
      title: 'Resend Verification Email',
      page: 'auth',
      email,
      message: genericMessage,
      verificationUrl: null
    });
  }
};

exports.getSignupSuccess = (req, res) => {
  res.render('signup-success', {
    title: 'Registration Successful - Verify Email',
    page: 'signup',
    email: req.query.email || '',
    delivery: req.query.delivery === 'console',
    applicationRole: ['student_leader', 'auditor'].includes(req.query.application) ? req.query.application : null
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

    const verified = await User.verifyEmail(user.id, token);
    if (!verified) {
      return res.status(400).render('about', {
        title: 'Verification Failed',
        page: 'error',
        errorMessage: 'This verification link is invalid or expired. Request a new link from the resend verification page.'
      });
    }
    res.render('verify-success', {
      title: 'Email Verified Successfully',
      page: 'verify',
      applicationPending: user.requested_role && user.approval_status === 'pending'
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

