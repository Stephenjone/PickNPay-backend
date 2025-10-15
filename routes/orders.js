const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User"); // import User model

// Helper functions
function generateOrderId() {
  return "ORD-" + Math.floor(100000 + Math.random() * 900000);
}
function generateToken() {
  return String(Math.floor(1 + Math.random() * 999)).padStart(3, "0");
}

/* CREATE NEW ORDER */
router.post("/", async (req, res) => {
  try {
    let { username, email, items } = req.body;

    if (!email || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    email = email.toLowerCase();

    // Fetch name from DB if not provided
    if (!username) {
      const userFromDB = await User.findOne({ email });
      username = userFromDB ? userFromDB.name : "Guest";
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0
    );

    const newOrder = new Order({
      username,
      email,
      items,
      totalAmount,
      orderId: generateOrderId(),
      token: generateToken(),
      userStatus: "Food is getting prepared",
      adminStatus: "Pending",
      notification: "",
    });

    await newOrder.save();

    req.io.emit("newOrder", newOrder); // notify admin
    req.io.to(email).emit("orderUpdated", newOrder); // notify user

    res.status(201).json({ message: "Order placed successfully", order: newOrder });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ message: "Error creating order", error: err.message });
  }
});

/* GET ALL ORDERS (ADMIN) */
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Error fetching orders", error: err.message });
  }
});

/* ACCEPT ORDER (ADMIN) */
router.put("/:id/accept", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.adminStatus = "Accepted";
    order.userStatus = "Order accepted and being prepared";
    order.token = generateToken();

    await order.save();

    req.io.to(order.email).emit("orderAccepted", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order accepted", order });
  } catch (err) {
    console.error("Error accepting order:", err);
    res.status(500).json({ message: "Error accepting order", error: err.message });
  }
});

/* MARK ORDER READY */
router.put("/:id/ready", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        userStatus:
          "Your order is ready! Please collect it from the counter and do the payment.",
        adminStatus: "Ready to Serve",
        notification:
          "Your order is ready! Please collect it from the counter and do the payment.",
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    req.io.to(order.email).emit("orderUpdated", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order marked as ready", order });
  } catch (err) {
    console.error("Error marking ready:", err);
    res.status(500).json({ message: "Error marking order as ready", error: err.message });
  }
});

/* MARK ORDER COLLECTED */
router.put("/:id/collected", async (req, res) => {
  try {
    const { collected } = req.body;
    let update = {};

    if (collected === true) {
      update = {
        userStatus: "Thank you for your order! Enjoy your meal.",
        adminStatus: "Collected",
        notification: "Your order has been collected successfully.",
      };
    } else {
      update = {
        userStatus: "Your order is waiting, please grab it soon.",
        adminStatus: "Waiting for pickup",
        notification: "Your order is waiting, please grab it soon.",
      };
    }

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });

    req.io.to(order.email).emit("orderUpdated", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order status updated", order });
  } catch (err) {
    console.error("Error updating collected status:", err);
    res.status(500).json({ message: "Error updating collected status", error: err.message });
  }
});

/* ADD ITEM FEEDBACK */
router.put("/:id/item/feedback", async (req, res) => {
  try {
    const { itemId, rating, feedback } = req.body;
    if (!itemId || rating == null || feedback == null) {
      return res.status(400).json({ message: "Missing itemId, rating, or feedback" });
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

    res.json({ message: "Item feedback added successfully", order });
  } catch (err) {
    console.error("Error adding item feedback:", err);
    res.status(500).json({ message: "Error adding item feedback", error: err.message });
  }
});

/* ADD ORDER FEEDBACK */
router.put("/:id/feedback", async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    if (rating == null || feedback == null) {
      return res.status(400).json({ message: "Missing feedback or rating" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { rating, feedback },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    req.io.to(order.email).emit("orderUpdated", order);
    req.io.emit("orderUpdatedAdmin", order);

    res.json({ message: "Order feedback added successfully", order });
  } catch (err) {
    console.error("Error adding order feedback:", err);
    res.status(500).json({ message: "Error adding order feedback", error: err.message });
  }
});

module.exports = router;
