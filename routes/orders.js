const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// Function to generate unique order ID
function generateOrderId() {
  return "ORD-" + Math.floor(100000 + Math.random() * 900000);
}

// Function to generate a 3-digit token for orders
function generateToken() {
  return String(Math.floor(1 + Math.random() * 999)).padStart(3, "0");
}

// Create new order (User places an order)
router.post("/", async (req, res) => {
  try {
    console.log("📦 Incoming POST /orders body:", req.body);
    const { username, email, items } = req.body;

    if (!username || !email || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const totalAmount = items.reduce((sum, item) => {
      return sum + (item.price || 0) * (item.quantity || 0);
    }, 0);

    const newOrder = new Order({
      username,
      email,
      items,
      totalAmount,
      orderId: generateOrderId(),
      token: generateToken(),
      status: "Pending",
      isReceived: null,
      notification: "",
    });

    await newOrder.save();

    // Emit new order event to all connected clients (admin)
    const io = req.app.get('io');
    io.emit('newOrder', newOrder);

    res.status(201).json({ message: "✅ Order placed successfully", order: newOrder });
  } catch (err) {
    console.error("❌ Error creating order:", err);
    res.status(500).json({ message: "Error creating order", error: err.message });
  }
});

// (The rest of your existing order routes remain unchanged...)

module.exports = router;
