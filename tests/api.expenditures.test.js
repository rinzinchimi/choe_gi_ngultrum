const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

describe('Expenditures API & Workflow (Staff & Admin)', () => {
  let studentAgent;
  let financeAgent;
  let adminAgent;

  beforeAll(async () => {
    // Student agent
    studentAgent = request.agent(app);
    await studentAgent
      .post('/login')
      .send({ email: 'student@sherubtse.rub.edu.bt', password: 'Transparency@2026' });

    // Finance officer agent
    financeAgent = request.agent(app);
    await financeAgent
      .post('/login')
      .send({ email: 'finance@sherubtse.rub.edu.bt', password: 'Transparency@2026' });

    // Admin agent
    adminAgent = request.agent(app);
    await adminAgent
      .post('/login')
      .send({ email: 'admin@sherubtse.rub.edu.bt', password: 'Transparency@2026' });
  });

  afterAll(async () => {
    // Clean up created records from this test
    await db.none("DELETE FROM expenditures WHERE purpose LIKE 'Test %'");
    if (db.$pgp) db.$pgp.end();
  });

  it('unauthenticated request to POST /api/expenditures returns 401', async () => {
    const res = await request(app)
      .post('/api/expenditures')
      .send({
        spent_on: '2026-07-20',
        purpose: 'Test Unauth Expense',
        category_id: 1,
        amount: 5000
      });
    expect(res.status).toBe(401);
  });

  it('student request to POST /api/expenditures returns 403 Forbidden', async () => {
    const res = await studentAgent
      .post('/api/expenditures')
      .send({
        spent_on: '2026-07-20',
        purpose: 'Test Student Expense Submission',
        category_id: 1,
        amount: 5000
      });
    expect(res.status).toBe(403);
  });

  it('finance officer successfully creates expenditure record', async () => {
    const res = await financeAgent
      .post('/api/expenditures')
      .send({
        spent_on: '2026-07-25',
        purpose: 'Test Lab Equipment Replacement Handouts',
        category_id: 6, // Academic
        amount: 15000,
        department: 'Academic Affairs'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('pending');

    const createdId = res.body.data.id;

    // Verify audit log has 'created' action for this record
    const audit = await db.any(
      "SELECT * FROM audit_log WHERE entity_type = 'expenditure' AND entity_id = $1 AND action = 'created'",
      [createdId]
    );
    expect(audit.length).toBe(1);

    // Now test admin approval of this record
    const approveRes = await adminAgent
      .post(`/api/expenditures/${createdId}/approve`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');
    expect(approveRes.body.data.is_published).toBe(true);

    // Verify audit log has 'approved' and 'published' actions
    const approveAudit = await db.any(
      "SELECT * FROM audit_log WHERE entity_type = 'expenditure' AND entity_id = $1 ORDER BY id ASC",
      [createdId]
    );
    const actions = approveAudit.map(a => a.action);
    expect(actions).toContain('approved');
    expect(actions).toContain('published');
  });

  it('creates expenditure with amount exceeding category threshold -> triggers requires_review', async () => {
    const res = await financeAgent
      .post('/api/expenditures')
      .send({
        spent_on: '2026-07-25',
        purpose: 'Test High Value Lab Server System',
        category_id: 6, // Academic threshold is 50,000
        amount: 85000,
        department: 'Academic Affairs'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('requires_review');

    // Verify review_flags table has a row
    const flags = await db.any(
      'SELECT * FROM review_flags WHERE expenditure_id = $1',
      [res.body.data.id]
    );
    expect(flags.length).toBeGreaterThanOrEqual(1);
    expect(flags[0].reason).toContain('category review threshold');
  });

  it('admin rejects an expenditure with required constructive reason', async () => {
    // 1. Create temporary expenditure
    const createRes = await financeAgent
      .post('/api/expenditures')
      .send({
        spent_on: '2026-07-28',
        purpose: 'Test Incomplete Invoice Expense',
        category_id: 8,
        amount: 8000
      });
    const expId = createRes.body.data.id;

    // 2. Reject without reason -> 400
    const noReasonRes = await adminAgent
      .post(`/api/expenditures/${expId}/reject`)
      .send({ reason: '' });
    expect(noReasonRes.status).toBe(400);

    // 3. Reject with constructive reason -> 200
    const rejectRes = await adminAgent
      .post(`/api/expenditures/${expId}/reject`)
      .send({ reason: 'Official vendor receipt missing seal from merchant.' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('rejected');

    // Verify audit log contains rejection reason
    const audit = await db.one(
      "SELECT * FROM audit_log WHERE entity_type = 'expenditure' AND entity_id = $1 AND action = 'rejected'",
      [expId]
    );
    expect(audit.after.reason).toContain('Official vendor receipt missing seal');
  });
});

