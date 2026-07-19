const request = require('supertest');
const app = require('../app');

describe('POST /api/payment', () => {
  it('should process payment successfully', async () => {
    const res = await request(app).post('/api/payment').send({
      cartId: 1,
      paymentMethod: 'credit_card',
      cardNumber: '4111111111111111',
      expiry: '12/25',
      cvv: '123'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('transactionId');
  });

  it('should fail with invalid card number', async () => {
    const res = await request(app).post('/api/payment').send({
      cartId: 1,
      paymentMethod: 'credit_card',
      cardNumber: '1234',
      expiry: '12/25',
      cvv: '123'
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid card number');
  });

  it('should fail with missing fields', async () => {
    const res = await request(app).post('/api/payment').send({
      cartId: 1
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Missing required fields');
  });

  it('should fail with non-existent cart', async () => {
    const res = await request(app).post('/api/payment').send({
      cartId: 999,
      paymentMethod: 'credit_card',
      cardNumber: '4111111111111111',
      expiry: '12/25',
      cvv: '123'
    });
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Cart not found');
  });
});
