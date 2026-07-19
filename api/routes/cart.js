const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Mock data functions (replace with actual DB calls)
const getCartByUserId = (userId) => ({ userId, items: [] });
const getMenuItemById = (id) => ({ id, name: 'Pizza', price: 10 });
const addToCart = (userId, menuItemId, quantity) => {};
const updateCartItem = (userId, itemId, quantity) => {};
const removeCartItem = (userId, itemId) => {};

// All cart routes require authentication and ownership check
router.use(auth);

// Get cart for current user
router.get('/', (req, res) => {
  const cart = getCartByUserId(req.user.id);
  if (!cart) return res.status(404).json({ error: 'Cart not found' });
  res.json(cart);
});

// Add item to cart
router.post('/items', (req, res) => {
  const { menuItemId, quantity } = req.body;
  if (!menuItemId || !quantity) return res.status(400).json({ error: 'menuItemId and quantity required' });
  const menuItem = getMenuItemById(menuItemId);
  if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });
  addToCart(req.user.id, menuItemId, quantity);
  res.status(201).json({ message: 'Item added to cart' });
});

// Update item quantity
router.put('/items/:itemId', (req, res) => {
  const { quantity } = req.body;
  if (!quantity) return res.status(400).json({ error: 'Quantity required' });
  updateCartItem(req.user.id, req.params.itemId, quantity);
  res.json({ message: 'Item quantity updated' });
});

// Remove item from cart
router.delete('/items/:itemId', (req, res) => {
  removeCartItem(req.user.id, req.params.itemId);
  res.json({ message: 'Item removed from cart' });
});

module.exports = router;