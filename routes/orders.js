// routes/orders.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User");

// Helpers
function generateOrderId() {
  return "ORD-" + Math.floor(100000 + Math.random() * 900000);
}
function generateToken() {
  return String(Math.floor(1 + Math.random() * 999)).padStart(3, "0");
}

/* Get all orders (Admin) */
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find({ adminDeleted: false }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching all orders:", err);
    res.status(500).json({ message: "Error fetching all orders", error: err.message });
  }
});

/* Create new order */
router.post("/", async (req, res) => {
  try {
    console.log("📦 POST /api/orders:", req.body);
    const { username, email, items } = req.body;

    if (!email || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    let uname = username;
    if (!uname) {
      const userFromDb = await User.findOne({ email });
      uname = userFromDb ? userFromDb.name : "Guest";
    }

    const totalAmount = items.reduce(
      (sum, it) => sum + (it.price || 0) * (it.quantity || 0),
      0
    );

    const newOrder = new Order({
      username: uname,
      email,
      items,
      totalAmount,
      orderId: generateOrderId(),
      token: generateToken(),
      userStatus: "Food is getting prepared",
      adminStatus: "Pending",
      notification: "",
      adminDeleted: false,
    });

    await newOrder.save();
    console.log("✅ Order saved:", newOrder);

    req.io.emit("newOrder", newOrder);
    req.io.to(email).emit("orderUpdated", newOrder);

    res.status(201).json({ message: "Order placed", order: newOrder });
  } catch (err) {
    console.error("❌ Error placing order:", err);
    res.status(500).json({ message: "Error placing order", error: err.message });
  }
});

/* Get orders for specific user */
router.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const orders = await Order.find({ email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching user orders:", err);
    res.status(500).json({ message: "Error fetching user orders", error: err.message });
  }
});

/* Admin Accept Order */
router.put("/:id/accept", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.adminStatus = "Accepted";
    order.userStatus = "Your order is accepted and being prepared";
    order.token = generateToken();
    await order.save();

    console.log("🔄 Order accepted:", order);

    req.io.to(order.email).emit("orderAccepted", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order accepted", order });
  } catch (err) {
    console.error("❌ Error accepting order:", err);
    res.status(500).json({ message: "Error accepting order", error: err.message });
  }
});

/* Admin Ready */
router.put("/:id/ready", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        userStatus: "Your order is ready! Please collect it.",
        adminStatus: "Ready to Serve",
        notification: "Your order is ready for pickup",
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    console.log("🔄 Mark order ready:", order);
    req.io.to(order.email).emit("orderUpdated", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order marked as ready", order });
  } catch (err) {
    console.error("❌ Error marking ready:", err);
    res.status(500).json({ message: "Error marking order ready", error: err.message });
  }
});

/* Admin Collected */
router.put("/:id/collected", async (req, res) => {
  try {
    const { collected } = req.body;
    const update = collected
      ? {
          userStatus: "Thank you for your order!",
          adminStatus: "Collected",
          notification: "Your order has been collected",
        }
      : {
          userStatus: "Order is waiting, please collect from the counter",
          adminStatus: "Waiting for pickup",
          notification: "Order is waiting, please collect from counter",
        };

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });

    console.log("🔄 Collected update:", order);
    req.io.to(order.email).emit("orderUpdated", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order status updated", order });
  } catch (err) {
    console.error("❌ Error updating collected:", err);
    res.status(500).json({ message: "Error updating collected", error: err.message });
  }
});

/* Feedback on item in order */
router.put("/:id/item/feedback", async (req, res) => {
  try {
    const { itemId, rating, feedback } = req.body;
    if (!itemId || rating == null || feedback == null) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const item = order.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.rating = rating;
    item.feedback = feedback;

    await order.save();
    console.log("⭐ Feedback saved:", order);
    req.io.to(order.email).emit("orderUpdated", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Feedback saved", order });
  } catch (err) {
    console.error("❌ Error saving feedback:", err);
    res.status(500).json({ message: "Error saving feedback", error: err.message });
  }
});

/* Reject (Don't Accept) Order */
/* Reject (Don't Accept) Order */
router.delete("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const email = order.email;

    // Notify the user via socket
    if (req.io && email) {
      req.io.to(email).emit("orderRejected", {
        _id: order._id,
        message: "Oops! your order cannot be accepted now, please try again later.",
      });
    }

    await order.deleteOne();

    // Notify admin UI
    req.io.emit("orderDeleted", { _id: order._id });

    console.log("🗑️ Order rejected and deleted:", order._id);
    res.json({ message: "Order rejected and deleted successfully" });
  } catch (err) {
    console.error("❌ Error rejecting order:", err);
    res.status(500).json({ message: "Error rejecting order", error: err.message });
  }
});

module.exports = router;
