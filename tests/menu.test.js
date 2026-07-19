const request = require('supertest');
const app = require('../app');

describe('GET /api/restaurants/:id/menu', () => {
  it('should return menu for a valid restaurant', async () => {
    const res = await request(app).get('/api/restaurants/1/menu');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should return 404 for invalid restaurant', async () => {
    const res = await request(app).get('/api/restaurants/999/menu');
    expect(res.statusCode).toBe(404);
  });

  it('should filter menu by category', async () => {
    const res = await request(app).get('/api/restaurants/1/menu?category=مقبلات');
    expect(res.statusCode).toBe(200);
    res.body.forEach(item => {
      expect(item.category).toBe('مقبلات');
    });
  });
});
