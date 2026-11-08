const nodemailer = require('nodemailer');
require('dotenv').config();

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;
const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

let transporter = null;
if (gmailUser && gmailPass) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
}

function logDevelopmentLink(label, email, url, error = null) {
  if (error) {
    console.warn(`${label} email delivery failed (${error.code || 'SMTP error'}); using development link fallback.`);
  }
  console.log(`\n================ ${label.toUpperCase()} (DEVELOPMENT) ================`);
  console.log(`To: ${email}`);
  console.log(`${label} URL: ${url}`);
  console.log('====================================================================\n');
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${baseUrl}/verify/${token}`;
  if (!transporter) {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Email transport is not configured.');
    }
    logDevelopmentLink('Verification', email, verifyUrl);
    return { dev: true, url: verifyUrl };
  }

  const mailOptions = {
    from: `"Choe Gi Ngultrum" <${gmailUser}>`,
    to: email,
    subject: 'Verify your account - Choe Gi Ngultrum (ཁྱོད་ཀྱི་དངུལ་ཀྲམ།)',
    html: `
      <h2>Welcome to Choe Gi Ngultrum</h2>
      <p>Your Money, Our Transparency.</p>
      <p>Please click the link below to verify your college email address:</p>
      <p><a href="${verifyUrl}" style="background:#1d4ed8;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;display:inline-block;">Verify Email</a></p>
      <p>Or copy this link into your browser: <br>${verifyUrl}</p>
    `,
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    if (process.env.NODE_ENV !== 'development') throw err;
    logDevelopmentLink('Verification', email, verifyUrl, err);
    return { dev: true, url: verifyUrl, errorCode: err.code || 'SMTP_ERROR' };
  }
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${baseUrl}/reset-password/${token}`;
  if (!transporter) {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Email transport is not configured.');
    }
    logDevelopmentLink('Password reset', email, resetUrl);
    return { dev: true, url: resetUrl };
  }

  const mailOptions = {
    from: `"Choe Gi Ngultrum" <${gmailUser}>`,
    to: email,
    subject: 'Reset your password - Choe Gi Ngultrum (ཁྱོད་ཀྱི་དངུལ་ཀྲམ།)',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for Choe Gi Ngultrum.</p>
      <p>Please click the link below to set a new password (valid for 1 hour):</p>
      <p><a href="${resetUrl}" style="background:#0f766e;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;display:inline-block;">Reset Password</a></p>
      <p>Or copy this link into your browser: <br>${resetUrl}</p>
    `,
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    if (process.env.NODE_ENV !== 'development') throw err;
    logDevelopmentLink('Password reset', email, resetUrl, err);
    return { dev: true, url: resetUrl, errorCode: err.code || 'SMTP_ERROR' };
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};

