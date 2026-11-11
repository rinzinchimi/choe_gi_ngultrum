require('dotenv').config({ quiet: true });
const nodemailer = require('nodemailer');

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
const GMAIL_APP_PASSWORD_LENGTH = 16;
const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 20_000;

function createConfigError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeAppPassword(password = '') {
  // Google displays app passwords in groups. Remove only ordinary spaces;
  // do not trim, truncate, or otherwise rewrite credential characters.
  return String(password).replace(/ /g, '');
}

function getSmtpConfig(env = process.env) {
  const user = String(env.GMAIL_USER || '').trim();
  const password = normalizeAppPassword(env.GMAIL_APP_PASSWORD || '');

  if (!user && !password) return null;
  if (!user || !password) {
    throw createConfigError(
      'EMAIL_CONFIG_INCOMPLETE',
      'Set both GMAIL_USER and GMAIL_APP_PASSWORD.'
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
    throw createConfigError('EMAIL_CONFIG_INVALID_USER', 'GMAIL_USER must be a valid email address.');
  }
  if (password.length !== GMAIL_APP_PASSWORD_LENGTH) {
    throw createConfigError(
      'EMAIL_CONFIG_INVALID_APP_PASSWORD_LENGTH',
      `GMAIL_APP_PASSWORD must contain exactly ${GMAIL_APP_PASSWORD_LENGTH} characters after removing spaces.`
    );
  }

  return {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    requireTLS: true,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: { user, pass: password }
  };
}

function getBaseUrl(env = process.env) {
  const configured = String(env.APP_BASE_URL || 'http://localhost:3000').trim();
  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    return url.toString().replace(/\/$/, '');
  } catch {
    throw createConfigError('EMAIL_CONFIG_INVALID_BASE_URL', 'APP_BASE_URL must be a valid HTTP or HTTPS URL.');
  }
}

function safeErrorReason(error) {
  switch (error.code) {
    case 'EAUTH':
      return 'Gmail rejected SMTP authentication. Check 2-Step Verification and the Gmail App Password.';
    case 'ETIMEDOUT':
    case 'ESOCKET':
    case 'ECONNECTION':
    case 'ECONNECTIONTIMEOUT':
      return 'Could not connect to Gmail SMTP. Check network access and SMTP settings.';
    case 'EMAIL_CONFIG_INVALID_APP_PASSWORD_LENGTH':
      return 'GMAIL_APP_PASSWORD has the wrong length; use the complete 16-character Gmail App Password.';
    case 'EMAIL_CONFIG_INCOMPLETE':
    case 'EMAIL_CONFIG_INVALID_USER':
    case 'EMAIL_CONFIG_INVALID_BASE_URL':
      return error.message;
    case 'EMAIL_RECIPIENT_REJECTED':
      return 'Gmail did not accept the recipient address.';
    default:
      return `SMTP delivery failed${error.code ? ` (${error.code})` : ''}.`;
  }
}

function recipientWasAccepted(info, recipient) {
  const target = recipient.trim().toLowerCase();
  const accepted = Array.isArray(info && info.accepted) ? info.accepted : [];
  const rejected = Array.isArray(info && info.rejected) ? info.rejected : [];
  const matches = address => String(address).trim().toLowerCase() === target;
  return accepted.some(matches) && !rejected.some(matches);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function createMailer({ env = process.env, nodemailerClient = nodemailer, logger = console } = {}) {
  const isDevelopment = env.NODE_ENV === 'development';
  const isTest = env.NODE_ENV === 'test';
  const baseUrl = getBaseUrl(env);
  let smtpConfig = null;
  let configurationError = null;
  let transporter = null;
  let smtpVerification = null;

  // Automated tests never contact a real SMTP service, even if a developer's
  // machine has production credentials in its environment.
  if (!isTest) {
    try {
      smtpConfig = getSmtpConfig(env);
      if (smtpConfig) transporter = nodemailerClient.createTransport(smtpConfig);
    } catch (error) {
      configurationError = error;
    }
  }

  function logFallback(label, email, url, error) {
    const reason = safeErrorReason(error);
    const diagnostics = [
      error.code && `code=${error.code}`,
      error.command && `command=${error.command}`,
      error.responseCode && `responseCode=${error.responseCode}`
    ].filter(Boolean).join(' ');
    logger.error(`[email] ${label} was not delivered to ${email}: ${reason}${diagnostics ? ` (${diagnostics})` : ''}`);
    logger.warn(`[email] Development verification fallback URL: ${url}`);
  }

  async function verifyTransport() {
    if (typeof transporter.verify !== 'function') return;
    if (!smtpVerification) {
      smtpVerification = transporter.verify().catch(error => {
        smtpVerification = null;
        throw error;
      });
    }
    await smtpVerification;
  }

  async function deliver({ label, email, subject, html, text, fallbackUrl = null }) {
    const recipient = String(email || '').trim();

    try {
      if (configurationError) throw configurationError;
      if (!transporter) {
        throw createConfigError('EMAIL_CONFIG_MISSING', 'Gmail SMTP is not configured.');
      }

      await verifyTransport();
      const info = await transporter.sendMail({
        from: `"Choe Gi Ngultrum" <${smtpConfig.auth.user}>`,
        to: recipient,
        subject,
        html,
        text
      });

      if (!recipientWasAccepted(info, recipient)) {
        throw createConfigError('EMAIL_RECIPIENT_REJECTED', 'Recipient was not accepted by the SMTP server.');
      }

      return {
        dev: false,
        delivered: true,
        accepted: recipient,
        messageId: info.messageId || null
      };
    } catch (error) {
      if (isDevelopment || isTest) {
        if (isDevelopment) {
          if (fallbackUrl) logFallback(label, recipient, fallbackUrl, error);
          else logger.error(`[email] ${label} was not delivered to ${recipient}: ${safeErrorReason(error)}`);
        }
        return {
          dev: true,
          delivered: false,
          url: fallbackUrl,
          errorCode: error.code || 'SMTP_ERROR'
        };
      }

      // Do not propagate raw SMTP messages; they can include server details.
      const safeError = createConfigError(error.code || 'SMTP_ERROR', safeErrorReason(error));
      throw safeError;
    }
  }

  function sendWithLink({ label, email, token, route, subject, html, text }) {
    const url = new URL(`${route}/${encodeURIComponent(token)}`, `${baseUrl}/`).toString();
    return deliver({ label, email, subject, html, text, fallbackUrl: url });
  }

  return {
    sendVerificationEmail(email, token, expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      const url = new URL(`/verify/${encodeURIComponent(token)}`, `${baseUrl}/`).toString();
      const expiration = new Date(expiresAt);
      const expirationText = expiration.toUTCString();
      return sendWithLink({
        label: 'Verification email',
        email,
        token,
        route: '/verify',
        subject: 'Verify Your Choe Gi Ngultrum Account',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:600px;margin:auto">
            <h2>Welcome to Choe Gi Ngultrum!</h2>
            <p>Thank you for registering. Please verify your email address by clicking the button below.</p>
            <p style="margin:28px 0"><a href="${url}" style="background:#145586;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold">Verify My Email</a></p>
            <p>This verification link expires at ${expirationText}.</p>
            <p>If the button does not work, copy this link into your browser:<br><a href="${url}">${url}</a></p>
            <p>If you did not create this account, you can ignore this message.</p>
          </div>
        `,
        text: [
          'Welcome to Choe Gi Ngultrum!',
          'Thank you for registering. Please verify your email address by opening this link:',
          url,
          `This verification link expires at ${expirationText}.`,
          'If you did not create this account, you can ignore this message.'
        ].join('\n\n')
      });
    },
    sendPasswordResetEmail(email, token) {
      const url = new URL(`/reset-password/${encodeURIComponent(token)}`, `${baseUrl}/`).toString();
      return sendWithLink({
        label: 'Password reset email',
        email,
        token,
        route: '/reset-password',
        subject: 'Reset your password - Choe Gi Ngultrum',
        html: `
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for Choe Gi Ngultrum.</p>
          <p>Please click the link below to set a new password (valid for 1 hour):</p>
          <p><a href="${url}" style="background:#0f766e;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;display:inline-block;">Reset Password</a></p>
          <p>Or copy this link into your browser: <br>${url}</p>
        `,
        text: `Reset your Choe Gi Ngultrum password using this link (valid for 1 hour): ${url}`
      });
    },
    sendAdminApplicationEmail(adminEmail, applicant) {
      const reviewUrl = new URL('/admin/role-approvals', `${baseUrl}/`).toString();
      return deliver({
        label: 'Administrator role application notification',
        email: adminEmail,
        subject: `New ${applicant.requestedRole === 'auditor' ? 'Auditor' : 'Student Leader'} Application`,
        html: `<h2>New role application</h2><p>${escapeHtml(applicant.name)} (${escapeHtml(applicant.email)}) submitted a ${escapeHtml(applicant.requestedRole.replace('_', ' '))} application.</p><p><a href="${reviewUrl}">Review application</a></p>`,
        text: `${applicant.name} (${applicant.email}) submitted a ${applicant.requestedRole.replace('_', ' ')} application. Review it at ${reviewUrl}`
      });
    },
    sendRoleDecisionEmail(email, name, decision, rejectionReason = null) {
      const approved = decision === 'approved';
      const loginUrl = new URL('/login', `${baseUrl}/`).toString();
      const subject = approved
        ? 'Your Choe Gi Ngultrum role application was approved'
        : 'Update on your Choe Gi Ngultrum role application';
      const message = approved
        ? 'Your role application has been approved. Sign in to access your assigned dashboard.'
        : `Your role application was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;
      return deliver({
        label: 'Role application decision notification',
        email,
        subject,
        html: `<h2>Hello ${escapeHtml(name)},</h2><p>${escapeHtml(message)}</p><p><a href="${loginUrl}">Sign in to Choe Gi Ngultrum</a></p>`,
        text: `Hello ${name},\n\n${message}\n\nSign in: ${loginUrl}`
      });
    }
  };
}

const mailer = createMailer();

module.exports = {
  ...mailer,
  createMailer,
  getSmtpConfig,
  normalizeAppPassword,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_GREETING_TIMEOUT_MS,
  SMTP_SOCKET_TIMEOUT_MS
};
