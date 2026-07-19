const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// All order routes require authentication
router.use(auth);

// POST /api/orders
router.post('/', async (req, res) => {
  try {
    const { restaurantId, items, total } = req.body;
    if (!restaurantId || !items || !total) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Create order in database
    const order = { id: Date.now(), userId: req.user.id, restaurantId, items, total, status: 'pending' };
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    // Fetch orders for the authenticated user
    const orders = [];
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = { id: req.params.id, userId: req.user.id, status: 'delivered' };
    if (order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
