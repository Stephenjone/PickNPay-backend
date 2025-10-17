const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User");

// Helper: generate orderId & token
function generateOrderId() {
  return "ORD-" + Math.floor(100000 + Math.random() * 900000);
}
function generateToken() {
  return String(Math.floor(1 + Math.random() * 999)).padStart(3, "0");
}

/* ==============================================
   ✅ Admin: Get all orders (excluding adminDeleted)
============================================== */
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find({ adminDeleted: false }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching all orders:", err);
    res.status(500).json({ message: "Error fetching all orders", error: err.message });
  }
});

/* ==============================================
   ✅ Create new order
============================================== */
router.post("/", async (req, res) => {
  try {
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

    // Notify admin + user via sockets
    req.io.emit("newOrder", newOrder);
    req.io.to(email).emit("orderUpdated", newOrder);

    res.status(201).json({ message: "Order placed", order: newOrder });
  } catch (err) {
    console.error("❌ Error placing order:", err);
    res.status(500).json({ message: "Error placing order", error: err.message });
  }
});

/* ==============================================
   ✅ Get orders for a specific user
============================================== */
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

/* ==============================================
   ✅ Admin Accept Order
============================================== */
router.put("/:id/accept", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.adminStatus = "Accepted";
    order.userStatus = "Your order is accepted and being prepared";
    order.token = generateToken();

    await order.save();

    req.io.to(order.email).emit("orderAccepted", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order accepted", order });
  } catch (err) {
    console.error("❌ Error accepting order:", err);
    res.status(500).json({ message: "Error accepting order", error: err.message });
  }
});

/* ==============================================
   ✅ Admin Mark Ready
============================================== */
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

    req.io.to(order.email).emit("orderUpdated", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order marked as ready", order });
  } catch (err) {
    console.error("❌ Error marking order ready:", err);
    res.status(500).json({ message: "Error marking order ready", error: err.message });
  }
});

/* ==============================================
   ✅ Admin Mark Collected
============================================== */
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
          notification: "Order is waiting, please collect from the counter",
        };

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });

    req.io.to(order.email).emit("orderUpdated", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order status updated", order });
  } catch (err) {
    console.error("❌ Error updating collected:", err);
    res.status(500).json({ message: "Error updating collected", error: err.message });
  }
});

/* ==============================================
   ✅ User Feedback for Item
============================================== */
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

    req.io.to(order.email).emit("orderUpdated", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Feedback saved", order });
  } catch (err) {
    console.error("❌ Error saving item feedback:", err);
    res.status(500).json({ message: "Error saving feedback", error: err.message });
  }
});

/* ==============================================
   ✅ Admin Delete (Before Accept → Notify User)
============================================== */
router.delete("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const wasPending = order.adminStatus === "Pending";

    await order.deleteOne();

    // Notify user
    if (wasPending) {
      // 🟡 Deleted before acceptance
      req.io.to(order.email).emit("orderRejectedBeforeAccept", {
        message: "Oops! your order cannot be accepted now, please try later",
        orderId: order.orderId,
      });
    } else {
      // 🔵 Deleted after processing
      req.io.to(order.email).emit("orderRejected", order);
    }

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    res.status(500).json({ message: "Error deleting order", error: err.message });
  }
});

module.exports = router;
