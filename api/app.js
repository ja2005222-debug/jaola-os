const express = require('express');
const securityHeaders = require('./middleware/securityHeaders');
const app = express();

// Security headers
app.use(securityHeaders);

// Body parser
app.use(express.json({ limit: '10kb' }));

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reservations', require('./routes/reservations'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;