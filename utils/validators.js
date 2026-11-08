/**
 * Validation utilities for Choe Gi Ngultrum
 */

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  // Standard RFC 5322 regex
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(trimmed);
}

function isValidCollegeEmail(email, allowedSuffixes = []) {
  if (!isValidEmail(email)) return false;
  if (!allowedSuffixes || allowedSuffixes.length === 0) return true;
  const trimmed = email.trim().toLowerCase();
  return allowedSuffixes.some(suffix => trimmed.endsWith(suffix.toLowerCase()));
}

function isValidPassword(password) {
  if (!password || typeof password !== 'string') return false;
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 digit
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  return hasUpper && hasLower && hasDigit;
}

function isValidAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return false;
  const num = Number(amount);
  return !Number.isNaN(num) && num > 0 && num < 1000000000;
}

function sanitizeText(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/[<>]/g, '');
}

function validateSignup(data, allowedSuffixes = []) {
  const errors = [];
  const name = sanitizeText(data.name);
  const email = (data.email || '').trim().toLowerCase();
  const password = data.password || '';
  const confirmPassword = data.confirmPassword || '';

  if (!name || name.length < 2) {
    errors.push('Full name must be at least 2 characters.');
  }

  if (!isValidEmail(email)) {
    errors.push('Please enter a valid email address.');
  } else if (allowedSuffixes.length > 0 && !isValidCollegeEmail(email, allowedSuffixes)) {
    errors.push(`Email domain must match one of: ${allowedSuffixes.join(', ')}`);
  }

  if (!isValidPassword(password)) {
    errors.push('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.');
  }

  if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { name, email, password }
  };
}

function validateExpenditure(data) {
  const errors = [];
  const spent_on = data.spent_on ? String(data.spent_on).trim() : '';
  const purpose = sanitizeText(data.purpose);
  const category_id = parseInt(data.category_id, 10);
  const amount = Number(data.amount);

  if (!spent_on || Number.isNaN(Date.parse(spent_on))) {
    errors.push('Please provide a valid spending date.');
  }

  if (!purpose || purpose.length < 5) {
    errors.push('Purpose description must be at least 5 characters.');
  }

  if (!category_id || category_id <= 0) {
    errors.push('Please select a valid category.');
  }

  if (!isValidAmount(amount)) {
    errors.push('Amount must be a positive number.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      spent_on,
      purpose,
      category_id,
      amount,
      department: sanitizeText(data.department) || 'General',
      club_id: data.club_id ? parseInt(data.club_id, 10) : null,
      event_id: data.event_id ? parseInt(data.event_id, 10) : null
    }
  };
}

function validateQuestion(data) {
  const errors = [];
  const text = sanitizeText(data.text);
  const expenditure_id = parseInt(data.expenditure_id, 10);

  if (!expenditure_id || expenditure_id <= 0) {
    errors.push('Invalid expenditure reference.');
  }

  if (!text || text.length < 10) {
    errors.push('Question must be at least 10 characters long.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { text, expenditure_id }
  };
}

module.exports = {
  isValidEmail,
  isValidCollegeEmail,
  isValidPassword,
  isValidAmount,
  sanitizeText,
  validateSignup,
  validateExpenditure,
  validateQuestion
};

