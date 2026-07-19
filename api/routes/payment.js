const express = require('express');
const router = express.Router();

router.post('/payment', (req, res) => {
  const { cartId, paymentMethod, cardNumber, expiry, cvv } = req.body;

  if (!cartId || !paymentMethod || !cardNumber || !expiry || !cvv) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate card number (simple Luhn check or length)
  if (!/^\d{13,19}$/.test(cardNumber)) {
    return res.status(400).json({ error: 'Invalid card number' });
  }

  // Validate expiry: format MM/YY or MM/YYYY
  const expiryRegex = /^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/;
  if (!expiryRegex.test(expiry)) {
    return res.status(400).json({ error: 'Invalid expiry format (MM/YY or MM/YYYY)' });
  }

  const [month, year] = expiry.split('/');
  const expMonth = parseInt(month, 10);
  const expYear = parseInt(year, 10) + (year.length === 2 ? 2000 : 0);

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return res.status(400).json({ error: 'Card has expired' });
  }

  // Validate CVV
  if (!/^\d{3,4}$/.test(cvv)) {
    return res.status(400).json({ error: 'Invalid CVV' });
  }

  // Simulate payment processing
  const transactionId = 'txn_' + Date.now();
  res.json({ success: true, transactionId });
});

module.exports = router;
