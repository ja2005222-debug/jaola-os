const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// All reservation routes require authentication
router.use(auth);

// POST /api/reservations
router.post('/', async (req, res) => {
  try {
    const { restaurantId, date, time, guests } = req.body;
    if (!restaurantId || !date || !time || !guests) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const reservation = { id: Date.now(), userId: req.user.id, restaurantId, date, time, guests };
    res.status(201).json(reservation);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reservations
router.get('/', async (req, res) => {
  try {
    const reservations = [];
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;