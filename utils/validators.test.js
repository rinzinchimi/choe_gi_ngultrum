const {
  isValidEmail,
  isValidCollegeEmail,
  isValidPassword,
  isValidAmount,
  sanitizeText,
  validateSignup,
  validateExpenditure,
  validateQuestion
} = require('./validators');

describe('Validators Unit Tests', () => {
  describe('isValidEmail', () => {
    it('accepts valid email addresses', () => {
      expect(isValidEmail('student@sherubtse.rub.edu.bt')).toBe(true);
      expect(isValidEmail('user.name+tag@example.com')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('isValidCollegeEmail', () => {
    it('verifies allowed suffixes when provided', () => {
      const suffixes = ['.rub.edu.bt', '.college.edu.bt'];
      expect(isValidCollegeEmail('student@sherubtse.rub.edu.bt', suffixes)).toBe(true);
      expect(isValidCollegeEmail('student@external.org', suffixes)).toBe(false);
    });

    it('allows any valid email if suffixes array is empty', () => {
      expect(isValidCollegeEmail('anyone@domain.com', [])).toBe(true);
    });
  });

  describe('isValidPassword', () => {
    it('validates strong passwords with upper, lower, and digit', () => {
      expect(isValidPassword('Transparency@2026')).toBe(true);
      expect(isValidPassword('ValidPass123')).toBe(true);
    });

    it('rejects passwords that are too short or lack character classes', () => {
      expect(isValidPassword('short1A')).toBe(false);
      expect(isValidPassword('alllowercase123')).toBe(false);
      expect(isValidPassword('ALLUPPERCASE123')).toBe(false);
      expect(isValidPassword('NoNumbersHere')).toBe(false);
    });
  });

  describe('isValidAmount', () => {
    it('accepts positive numeric amounts', () => {
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount('50000')).toBe(true);
      expect(isValidAmount(12.5)).toBe(true);
    });

    it('rejects zero, negative, or invalid amounts', () => {
      expect(isValidAmount(0)).toBe(false);
      expect(isValidAmount(-50)).toBe(false);
      expect(isValidAmount('abc')).toBe(false);
      expect(isValidAmount(null)).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    it('strips angle brackets to prevent basic HTML injection', () => {
      expect(sanitizeText('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
      expect(sanitizeText('  Hello World  ')).toBe('Hello World');
    });
  });

  describe('validateSignup', () => {
    it('passes on valid input', () => {
      const result = validateSignup({
        name: 'Sonam Dorji',
        email: 'sonam@rub.edu.bt',
        password: 'Password123',
        confirmPassword: 'Password123'
      });
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('detects mismatched passwords', () => {
      const result = validateSignup({
        name: 'Sonam Dorji',
        email: 'sonam@rub.edu.bt',
        password: 'Password123',
        confirmPassword: 'DifferentPassword123'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Passwords do not match.');
    });
  });

  describe('validateExpenditure', () => {
    it('passes for complete valid expenditure', () => {
      const result = validateExpenditure({
        spent_on: '2026-07-10',
        purpose: 'Inter-class sports kits',
        category_id: '2',
        amount: '50000',
        department: 'Sports'
      });
      expect(result.isValid).toBe(true);
      expect(result.data.amount).toBe(50000);
    });

    it('fails when purpose is too short', () => {
      const result = validateExpenditure({
        spent_on: '2026-07-10',
        purpose: 'kit',
        category_id: '2',
        amount: '50000'
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateQuestion', () => {
    it('accepts courteous respectful question', () => {
      const result = validateQuestion({
        expenditure_id: 31,
        text: 'I would like clarification about the Nu. 38,500 expenditure.'
      });
      expect(result.isValid).toBe(true);
    });

    it('rejects questions under minimum length', () => {
      const result = validateQuestion({
        expenditure_id: 31,
        text: 'Why?'
      });
      expect(result.isValid).toBe(false);
    });
  });
});

