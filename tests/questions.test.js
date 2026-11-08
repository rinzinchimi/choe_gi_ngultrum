const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

describe('Student Questions & Clarification Workflow', () => {
  let studentAgent;
  let financeAgent;

  beforeAll(async () => {
    studentAgent = request.agent(app);
    await studentAgent
      .post('/login')
      .send({ email: 'student@sherubtse.rub.edu.bt', password: 'Transparency@2026' });

    financeAgent = request.agent(app);
    await financeAgent
      .post('/login')
      .send({ email: 'finance@sherubtse.rub.edu.bt', password: 'Transparency@2026' });
  });

  afterAll(async () => {
    await db.none("DELETE FROM questions WHERE text LIKE 'Test inquiry %'");
    if (db.$pgp) db.$pgp.end();
  });

  it('unauthenticated question submission via API returns 401', async () => {
    const res = await request(app)
      .post('/api/questions')
      .send({
        expenditure_id: 31,
        text: 'Could you please clarify this expense?'
      });
    expect(res.status).toBe(401);
  });

  it('student submits clarification inquiry via API', async () => {
    const res = await studentAgent
      .post('/api/questions')
      .send({
        expenditure_id: 31,
        text: 'Test inquiry regarding sound engineer contractor rates.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('open');

    const qId = res.body.data.id;

    // Verify notification was sent to finance staff
    const notifs = await db.any(
      "SELECT * FROM notifications WHERE type = 'question' ORDER BY id DESC LIMIT 2"
    );
    expect(notifs.length).toBeGreaterThan(0);

    // Finance officer answers the question
    const answerRes = await financeAgent
      .post(`/admin/questions/${qId}/answer`)
      .send({
        answer_text: 'Sound engineer rates were approved under standard university technical services rates.',
        document_url: '/uploads/sample_stage_sound_invoice.pdf'
      });

    expect(answerRes.status).toBe(302); // Redirect back to questions list

    // Verify question is answered in database
    const answeredQ = await db.one("SELECT * FROM questions WHERE id = $1", [qId]);
    expect(answeredQ.status).toBe('answered');
    expect(answeredQ.answer_text).toContain('standard university technical services rates');

    // Verify public view reflects the answer
    const detailRes = await request(app).get('/api/expenditures/31');
    expect(detailRes.status).toBe(200);
    const found = detailRes.body.data.questions.find(q => q.id === qId);
    expect(found).toBeDefined();
    expect(found.answer_text).toContain('standard university technical services rates');
  });

  it('rejects inquiry shorter than minimum character requirement', async () => {
    const res = await studentAgent
      .post('/api/questions')
      .send({
        expenditure_id: 31,
        text: 'Why?'
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('Question must be at least 10 characters long.');
  });
});

