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

// 📌 Create new order (User places order)
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
      isReceived: null,
      notification: "",
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ message: "Error creating order" });
  }
});

// 📌 Get all orders (Admin view only — no notifications!)
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    // Remove notification field before sending to admin
    const adminOrders = orders.map((o) => {
      const obj = o.toObject();
      delete obj.notification;
      return obj;
    });

    res.json(adminOrders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

// 📌 Accept order (Admin)
router.put("/:id/accept", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "Accepted" },
      { new: true, projection: { notification: 0 } } // hide notification
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (err) {
    console.error("Error accepting order:", err);
    res.status(500).json({ message: "Error accepting order" });
  }
});

// 📌 Mark order received (Admin clicks Yes/No)
router.put("/:id/received", async (req, res) => {
  try {
    const { isReceived } = req.body;

    let notification = "";
    if (isReceived) {
      notification = "✅ Your order is collected from the restaurant.";
    } else {
      notification =
        "⏳ Your order is waiting at the restaurant, please collect it.";
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { isReceived, notification },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Hide notification when sending to admin
    const adminOrder = order.toObject();
    delete adminOrder.notification;

    res.json(adminOrder);
  } catch (err) {
    console.error("Error updating received status:", err);
    res.status(500).json({ message: "Error updating received status" });
  }
});

// 📌 User fetches their own orders (User side only — includes notifications!)
router.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const orders = await Order.find({ email }).sort({ createdAt: -1 });
    res.json(orders); // user gets notifications
  } catch (err) {
    console.error("Error fetching user orders:", err);
    res.status(500).json({ message: "Error fetching user orders" });
  }
});

// 📌 Delete order (Admin)
router.delete("/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted" });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ message: "Error deleting order" });
  }
});

module.exports = router;
