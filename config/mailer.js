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

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${baseUrl}/verify/${token}`;
  if (!transporter) {
    console.log('\n================ EMAIL VERIFICATION (DEV / CONSOLE) ================');
    console.log(`To: ${email}`);
    console.log(`Token: ${token}`);
    console.log(`Verification URL: ${verifyUrl}`);
    console.log('====================================================================\n');
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

  return transporter.sendMail(mailOptions);
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${baseUrl}/reset-password/${token}`;
  if (!transporter) {
    console.log('\n================ PASSWORD RESET (DEV / CONSOLE) ====================');
    console.log(`To: ${email}`);
    console.log(`Token: ${token}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('====================================================================\n');
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

  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};

