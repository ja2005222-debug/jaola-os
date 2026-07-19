const request = require('supertest');
const app = require('../app');

describe('Cart API', () => {
  let cartId;

  it('should create a new cart', async () => {
    const res = await request(app).post('/api/cart').send({});
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    cartId = res.body.id;
  });

  it('should add item to cart', async () => {
    const res = await request(app).post(`/api/cart/${cartId}/items`).send({
      menuItemId: 1,
      quantity: 2
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].quantity).toBe(2);
  });

  it('should update item quantity', async () => {
    const res = await request(app).put(`/api/cart/${cartId}/items/1`).send({
      quantity: 3
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.items[0].quantity).toBe(3);
  });

  it('should remove item from cart', async () => {
    const res = await request(app).delete(`/api/cart/${cartId}/items/1`);
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(0);
  });

  it('should return 400 for invalid quantity', async () => {
    const res = await request(app).post(`/api/cart/${cartId}/items`).send({
      menuItemId: 1,
      quantity: -1
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid quantity');
  });
});
