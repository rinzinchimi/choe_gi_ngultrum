const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

describe('Full-Stack Page Rendering & Controllers Coverage', () => {
  let studentAgent;
  let adminAgent;

  beforeAll(async () => {
    studentAgent = request.agent(app);
    await studentAgent
      .post('/login')
      .send({ email: 'student@sherubtse.rub.edu.bt', password: 'Transparency@2026' });

    adminAgent = request.agent(app);
    await adminAgent
      .post('/login')
      .send({ email: 'admin@sherubtse.rub.edu.bt', password: 'Transparency@2026' });
  });

  afterAll(async () => {
    if (db.$pgp) db.$pgp.end();
  });

  it('GET / renders homepage with 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Your Money, Our Transparency.');
    expect(res.text).toContain('Cultural Festival');
  });

  it('GET /about renders about page with 200', async () => {
    const res = await request(app).get('/about');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Institutional Guiding Principles');
  });

  it('GET /expenditures renders list and search filters with 200', async () => {
    const res = await request(app).get('/expenditures?search=football&category_id=2');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Expenditure Tracking Ledger');
  });

  it('GET /expenditures/:id renders published record details and Q&A', async () => {
    const res = await studentAgent.get('/expenditures/31');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Cultural Festival stage');
    expect(res.text).toContain('Audit Trail');
    expect(res.text).toContain('Ask a Question');
  });

  it('GET /analytics renders charts and category breakdown', async () => {
    const res = await request(app).get('/analytics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Financial Analytics & Visualizations');
    expect(res.text).toContain('budgetVsActualChart');
  });

  it('GET /events renders active projects list', async () => {
    const res = await request(app).get('/events');
    expect(res.status).toBe(200);
    expect(res.text).toContain('College Projects & Events');
    expect(res.text).toContain('Annual Cultural Festival 2026');
  });

  it('GET /notifications renders user notifications', async () => {
    const res = await studentAgent.get('/notifications');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Notifications & Activity');
  });

  it('POST /notifications/all/read marks notifications read', async () => {
    const res = await studentAgent.post('/notifications/all/read');
    expect(res.status).toBe(302);
  });

  it('GET /admin/budgets renders budget allocations', async () => {
    const res = await adminAgent.get('/admin/budgets');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Budget Allocations Management');
  });

  it('POST /admin/budgets updates allocated amount', async () => {
    const res = await adminAgent
      .post('/admin/budgets')
      .send({ id: 1, allocated_amount: 650000 });
    expect(res.status).toBe(302);

    // Revert back to 600,000 for seed reconciliation
    await adminAgent
      .post('/admin/budgets')
      .send({ id: 1, allocated_amount: 600000 });
  });

  it('GET /admin/users renders user role management', async () => {
    const res = await adminAgent.get('/admin/users');
    expect(res.status).toBe(200);
    expect(res.text).toContain('User & Role Governance');
  });

  it('POST /admin/users/:id/role updates user role', async () => {
    const res = await adminAgent
      .post('/admin/users/4/role')
      .send({ role: 'student_leader' });
    expect(res.status).toBe(302);
  });

  it('GET /admin/reports renders summary reports', async () => {
    const res = await adminAgent.get('/admin/reports');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Financial Reports & Data Exports');
  });

  it('GET /admin/reports/csv downloads formatted CSV file', async () => {
    const res = await adminAgent.get('/admin/reports/csv');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/csv');
    expect(res.text).toContain('ID,Date,Purpose,Category,Department,Club,Amount (Nu.),Status,Published,Created By');
    expect(res.text).toContain('Cultural Festival stage & sound');
  });

  it('GET /forgot-password renders request form', async () => {
    const res = await request(app).get('/forgot-password');
    expect(res.status).toBe(200);
  });

  it('POST /forgot-password sends password reset token', async () => {
    const res = await request(app)
      .post('/forgot-password')
      .send({ email: 'student@sherubtse.rub.edu.bt' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('reset link has been dispatched');
  });

  it('GET /non-existent-route returns 404 with friendly error page', async () => {
    const res = await request(app).get('/some-non-existent-path');
    expect(res.status).toBe(404);
    expect(res.text).toContain('404 - Page Not Found');
  });
});
