// routes/orders.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// Generate unique Order ID
function generateOrderId() {
  return "ORD-" + Math.floor(100000 + Math.random() * 900000);
}

// Generate 3-digit token
function generateToken() {
  return String(Math.floor(1 + Math.random() * 999)).padStart(3, "0");
}

// 📌 Create new order
router.post("/", async (req, res) => {
  try {
    const { username, email, items } = req.body;

    const newOrder = new Order({
      username,
      email,
      items,
      orderId: generateOrderId(),
      token: generateToken(),
      status: "Pending",
      isReceived: false,
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ message: "Error creating order" });
  }
});

// 📌 Get all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

// 📌 Accept order
// Should be in routes/orders.js
router.put("/:id/accept", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "Accepted" },
      { new: true }
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Error accepting order" });
  }
});




// 📌 Mark order received
router.put("/:id/received", async (req, res) => {
  try {
    const { isReceived } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { isReceived },
      { new: true }
    );
    res.json(order);
  } catch (err) {
    console.error("Error updating received status:", err);
    res.status(500).json({ message: "Error updating received status" });
  }
});


// 📌 Delete order
router.delete("/:id", async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Order deleted" });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ message: "Error deleting order" });
  }
});

module.exports = router;
