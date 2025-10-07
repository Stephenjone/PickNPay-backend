const express = require('express');
const router = express.Router();
const { io } = require('../server'); // Adjust path to your server.js
const Order = require('../models/Order'); // Your Mongoose Order model

// Accept an order
router.put('/:orderId/accept', async (req, res) => {
  try {
    const { orderId } = req.params;
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status: 'Accepted' },
      { new: true }
    );

    if (!updatedOrder) return res.status(404).json({ message: 'Order not found' });

    // Emit event to the user room
    if (updatedOrder.userId) {
      io.to(updatedOrder.userId.toString()).emit('orderUpdated', {
        orderId: updatedOrder._id,
        status: updatedOrder.status,
        notification: "Your order has been accepted ✅",
      });
    }

    res.json(updatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
