const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

describe('Public JSON API Tests', () => {
  afterAll(async () => {
    if (db.$pgp) db.$pgp.end();
  });

  it('GET /api/stats returns reconciled KPI metrics', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stats = res.body.data;
    expect(Number(stats.totalBudget)).toBe(4800000);
    expect(Number(stats.totalSpent)).toBe(3120000);
    expect(Number(stats.remaining)).toBe(1680000);
    expect(stats.activeProjects).toBe(12);
    expect(stats.pendingCount).toBe(7);
    expect(stats.reviewCount).toBe(2);
    expect(stats.openQuestions).toBe(4);
  });

  it('GET /api/categories returns all categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(8);
  });

  it('GET /api/expenditures returns only published approved records', async () => {
    const res = await request(app).get('/api/expenditures');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Ensure none of the returned items are pending or unapproved
    res.body.data.forEach(item => {
      expect(item.status).toBe('approved');
      expect(item.is_published).toBe(true);
    });
  });

  it('GET /api/expenditures/:id returns detail with relations for published record', async () => {
    // Record #31: Cultural Festival stage & sound (approved, published)
    const res = await request(app).get('/api/expenditures/31');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.purpose).toBe('Cultural Festival stage & sound');
    expect(Array.isArray(res.body.data.documents)).toBe(true);
    expect(Array.isArray(res.body.data.auditTrail)).toBe(true);
    expect(Array.isArray(res.body.data.questions)).toBe(true);
  });

  it('GET /api/expenditures/:id returns 404 for pending unapproved record', async () => {
    // Record #37: Library furniture (pending, unpublished)
    const res = await request(app).get('/api/expenditures/37');
    expect(res.status).toBe(404);
  });

  it('GET /api/analytics returns charts dataset', async () => {
    const res = await request(app).get('/api/analytics');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.categories).toBeDefined();
    expect(res.body.data.monthlySpend).toBeDefined();
  });
});

