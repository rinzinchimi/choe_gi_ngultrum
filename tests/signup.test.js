const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

describe('User Registration & Verification Flow', () => {
  afterAll(async () => {
    // Clean up test user
    await db.none("DELETE FROM users WHERE email = 'newstudent@sherubtse.rub.edu.bt'");
    if (db.$pgp) db.$pgp.end();
  });

  it('GET /signup returns 200 with registration form', async () => {
    const res = await request(app).get('/signup');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Create an Account');
    expect(res.text).toContain('Student Leader Applicant');
    expect(res.text).toContain('Auditor Applicant');
  });

  it('POST /signup fails when required fields are missing', async () => {
    const res = await request(app)
      .post('/signup')
      .send({
        name: '',
        email: 'invalid-email',
        password: '123',
        confirmPassword: '456'
      });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Please enter a valid email address.');
  });

  it('POST /signup rejects mismatched passwords', async () => {
    const res = await request(app)
      .post('/signup')
      .send({
        name: 'Tandin Wangmo',
        email: 'tandin@sherubtse.rub.edu.bt',
        password: 'Password123!',
        confirmPassword: 'Different123!'
      });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Passwords do not match.');
  });

  it('POST /signup successfully registers a new student', async () => {
    const res = await request(app)
      .post('/signup')
      .send({
        name: 'New College Student',
        email: 'newstudent@sherubtse.rub.edu.bt',
        department: 'Science',
        password: 'Transparency@2026',
        confirmPassword: 'Transparency@2026'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/signup-success');

    // Verify user exists in database
    const user = await db.oneOrNone("SELECT * FROM users WHERE email = 'newstudent@sherubtse.rub.edu.bt'");
    expect(user).not.toBeNull();
    expect(user.role).toBe('student');
    expect(user.is_verified).toBe(false);
    expect(user.verification_token).toBeDefined();
    expect(user.verification_token_expires.getTime()).toBeGreaterThan(Date.now());

    const originalToken = user.verification_token;
    await db.none(
      `UPDATE users SET verification_email_last_sent_at = NOW() - INTERVAL '2 minutes'
       WHERE id = $1`,
      [user.id]
    );

    // Existing unverified accounts can request a fresh link without registering again.
    const resendRes = await request(app)
      .post('/resend-verification')
      .send({ email: user.email, password: 'Transparency@2026' });
    expect(resendRes.status).toBe(200);
    expect(resendRes.text).toContain('Verify Account');
    expect(resendRes.text).toContain('development-only link');

    const resentUser = await db.one('SELECT * FROM users WHERE id = $1', [user.id]);
    expect(resentUser.verification_token).not.toBe(originalToken);
    expect(resentUser.verification_token_expires.getTime()).toBeGreaterThan(Date.now());

    // Replaced tokens cannot be reused; the fresh token verifies the account.
    const oldVerifyRes = await request(app).get(`/verify/${originalToken}`);
    expect(oldVerifyRes.status).toBe(400);

    const verifyRes = await request(app).get(`/verify/${resentUser.verification_token}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.text).toContain('Email Verified Successfully');

    const updatedUser = await db.one("SELECT is_verified FROM users WHERE id = $1", [user.id]);
    expect(updatedUser.is_verified).toBe(true);
  });

  it('POST /signup rejects duplicate registered email', async () => {
    const res = await request(app)
      .post('/signup')
      .send({
        name: 'Duplicate Student',
        email: 'student@sherubtse.rub.edu.bt', // Already in seed
        password: 'Transparency@2026',
        confirmPassword: 'Transparency@2026'
      });

    expect(res.status).toBe(400);
    expect(res.text).toContain('already exists');
  });
});

