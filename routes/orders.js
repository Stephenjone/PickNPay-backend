const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// Generate unique Order ID
function generateOrderId() {
  return 'ORD-' + Math.floor(100000 + Math.random() * 900000);
}

// Generate 3-digit unique token
async function generateUniqueToken() {
  let token;
  let exists = true;
  while (exists) {
    token = Math.floor(1 + Math.random() * 999).toString().padStart(3, '0');
    exists = await Order.findOne({ token });
  }
  return token;
}

// ✅ Place new order
router.post('/place', async (req, res) => {
  try {
    const { email, items, totalAmount } = req.body;

    if (!email || !items || !totalAmount) {
      return res.status(400).json({ error: 'Missing order data' });
    }

    const newOrder = new Order({
      email,
      items,
      totalAmount,
      orderId: generateOrderId(),
      status: 'Pending',
      received: null,
      token: null
    });

    await newOrder.save();

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// ✅ Get all orders (always array)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(Array.isArray(orders) ? orders : []); // always return array
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ✅ Accept order
router.put('/:id/accept', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'Accepted') {
      return res.status(400).json({ error: 'Order already accepted' });
    }

    const token = await generateUniqueToken();
    order.status = 'Accepted';
    order.token = token;

    await order.save();

    res.json({
      message: 'Order accepted',
      token: order.token,
      orderId: order.orderId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

// ✅ Update received status
router.put('/:id/received', async (req, res) => {
  try {
    const { received } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.received = received;
    await order.save();

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update received status' });
  }
});

// ✅ Delete order
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

module.exports = router;
