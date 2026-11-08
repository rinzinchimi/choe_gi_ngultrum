const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

describe('Role-Based Access Control (RBAC) Enforcement', () => {
  let studentAgent;
  let leaderAgent;
  let financeAgent;
  let adminAgent;
  let auditorAgent;

  beforeAll(async () => {
    // 1. Student
    studentAgent = request.agent(app);
    await studentAgent
      .post('/login')
      .send({ email: 'student@sherubtse.rub.edu.bt', password: 'Transparency@2026' });

    // 2. Student Leader
    leaderAgent = request.agent(app);
    await leaderAgent
      .post('/login')
      .send({ email: 'leader@sherubtse.rub.edu.bt', password: 'Transparency@2026' });

    // 3. Finance Officer
    financeAgent = request.agent(app);
    await financeAgent
      .post('/login')
      .send({ email: 'finance@sherubtse.rub.edu.bt', password: 'Transparency@2026' });

    // 4. Admin
    adminAgent = request.agent(app);
    await adminAgent
      .post('/login')
      .send({ email: 'admin@sherubtse.rub.edu.bt', password: 'Transparency@2026' });

    // 5. Auditor
    auditorAgent = request.agent(app);
    await auditorAgent
      .post('/login')
      .send({ email: 'auditor@sherubtse.rub.edu.bt', password: 'Transparency@2026' });
  });

  afterAll(async () => {
    if (db.$pgp) db.$pgp.end();
  });

  describe('Unauthenticated Access', () => {
    it('redirects unauthenticated user from protected routes to /login', async () => {
      const res = await request(app).get('/dashboard');
      expect(res.status).toBe(302);
      expect(res.header.location).toBe('/login');

      const adminRes = await request(app).get('/admin/dashboard');
      expect(adminRes.status).toBe(302);
      expect(adminRes.header.location).toBe('/login');
    });
  });

  describe('Student Access Restrictions', () => {
    it('allows student to access /dashboard', async () => {
      const res = await studentAgent.get('/dashboard');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Student Dashboard');
    });

    it('returns 403 Forbidden when student tries to access /admin/dashboard', async () => {
      const res = await studentAgent.get('/admin/dashboard');
      expect(res.status).toBe(403);
      expect(res.text).toContain('403 Forbidden');
    });

    it('returns 403 Forbidden when student tries to access /admin/users', async () => {
      const res = await studentAgent.get('/admin/users');
      expect(res.status).toBe(403);
    });

    it('returns 403 Forbidden when student tries to access /admin/approvals', async () => {
      const res = await studentAgent.get('/admin/approvals');
      expect(res.status).toBe(403);
    });
  });

  describe('Auditor Read-Only Access', () => {
    it('allows auditor to view the audit log (/audit-log)', async () => {
      const res = await auditorAgent.get('/audit-log');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Audit Trail Log');
    });

    it('allows auditor to view reports', async () => {
      const res = await auditorAgent.get('/admin/reports');
      expect(res.status).toBe(200);
    });

    it('forbids auditor from writing or creating expenditures (POST /api/expenditures returns 403)', async () => {
      const res = await auditorAgent
        .post('/api/expenditures')
        .send({
          spent_on: '2026-07-28',
          purpose: 'Auditor Attempted Write',
          category_id: 1,
          amount: 1000
        });
      expect(res.status).toBe(403);
    });

    it('forbids auditor from accessing the approval queue (/admin/approvals)', async () => {
      const res = await auditorAgent.get('/admin/approvals');
      expect(res.status).toBe(403);
    });
  });

  describe('Finance Officer vs Administrator Scoping', () => {
    it('allows finance officer to access /admin/dashboard and /admin/expenditures', async () => {
      const resDash = await financeAgent.get('/admin/dashboard');
      expect(resDash.status).toBe(200);

      const resExp = await financeAgent.get('/admin/expenditures');
      expect(resExp.status).toBe(200);
    });

    it('forbids finance officer from approval queue (/admin/approvals is admin only)', async () => {
      const res = await financeAgent.get('/admin/approvals');
      expect(res.status).toBe(403);
    });

    it('forbids finance officer from user role management (/admin/users is admin only)', async () => {
      const res = await financeAgent.get('/admin/users');
      expect(res.status).toBe(403);
    });

    it('allows administrator to access all admin portals', async () => {
      const resDash = await adminAgent.get('/admin/dashboard');
      expect(resDash.status).toBe(200);

      const resAppr = await adminAgent.get('/admin/approvals');
      expect(resAppr.status).toBe(200);

      const resUsers = await adminAgent.get('/admin/users');
      expect(resUsers.status).toBe(200);
    });
  });
});
