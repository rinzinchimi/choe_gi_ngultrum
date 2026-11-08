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
    expect(res.text).toContain('Student Registration');
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

    // Test email verification endpoint
    const verifyRes = await request(app).get(`/verify/${user.verification_token}`);
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

