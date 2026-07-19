const request = require('supertest');
const app = require('../app');

describe('GET /api/restaurants', () => {
  it('should return all restaurants', async () => {
    const res = await request(app).get('/api/restaurants');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should filter restaurants by name', async () => {
    const res = await request(app).get('/api/restaurants?name=بيتزا');
    expect(res.statusCode).toBe(200);
    res.body.forEach(r => {
      expect(r.name).toMatch(/بيتزا/);
    });
  });

  it('should return 404 for non-existent restaurant', async () => {
    const res = await request(app).get('/api/restaurants/999');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Restaurant not found');
  });
});
