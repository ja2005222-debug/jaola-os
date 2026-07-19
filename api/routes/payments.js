const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// All payment routes require authentication
router.use(auth);

// Process payment (only for own orders)
router.post('/pay', (req, res) => {
  const { orderId, paymentMethod } = req.body;
  if (!orderId || !paymentMethod) return res.status(400).json({ error: 'orderId and paymentMethod required' });
  const order = getOrderById(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  // Process payment securely (mock)
  processPayment(orderId, paymentMethod);
  res.json({ message: 'Payment successful' });
});

module.exports = router;