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

// 📌 Create new order (User places an order)
router.post("/", async (req, res) => {
  try {
    console.log("📦 Incoming POST /orders body:", req.body);
    const { username, email, items } = req.body;

    // Validate the order data
    if (!username || !email || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    // Calculate total order amount
    const totalAmount = items.reduce((sum, item) => {
      return sum + (item.price || 0) * (item.quantity || 0);
    }, 0);

    // Create new order
    const newOrder = new Order({
      username,
      email,
      items,
      totalAmount,
      orderId: generateOrderId(),
      token: generateToken(),
      status: "Pending",
      isReceived: null, // Initially null, will be updated later
      notification: "",  // Notification for user
    });

    await newOrder.save();
    res.status(201).json({ message: "✅ Order placed successfully", order: newOrder });
  } catch (err) {
    console.error("❌ Error creating order:", err);
    res.status(500).json({ message: "Error creating order", error: err.message });
  }
});

// 📋 Get all orders (Admin)
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });  // Sorting by creation date
    res.json(orders.map((o) => ({ ...o.toObject(), notification: undefined }))); // Remove notification
  } catch (err) {
    res.status(500).json({ message: "Error fetching orders", error: err.message });
  }
});

// ✅ Accept order (Admin)
router.put("/:id/accept", async (req, res) => {
  try {
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) return res.status(404).json({ message: "Order not found" });

    // Update order to "Accepted" status
    let updatedFields = { 
      status: "Accepted", 
      notification: "✅ Order accepted! Please collect your food in 10 min." 
    };

    // Assign token if it doesn't already exist
    if (!existingOrder.token) updatedFields.token = generateToken();

    const order = await Order.findByIdAndUpdate(req.params.id, updatedFields, { new: true });
    res.json({ message: "✅ Order accepted", order });
  } catch (err) {
    res.status(500).json({ message: "Error accepting order", error: err.message });
  }
});

// ❌ Reject order (Admin)
router.put("/:id/reject", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status: "Rejected", 
        notification: "❌ Oops! Restaurant cannot accept your order now." 
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "✅ Order rejected", order });
  } catch (err) {
    res.status(500).json({ message: "Error rejecting order", error: err.message });
  }
});

// ✅ Mark order as received (Admin)
router.put("/:id/received", async (req, res) => {
  try {
    const { isReceived } = req.body;
    let notification = "";
    let status = "";

    // Update notification and status based on received state
    if (isReceived === true) {
      notification = "✅ Your food has been collected successfully.";
      status = "Collected";
    } else if (isReceived === false) {
      notification = "⏳ Your food is waiting, please grab it soon.";
      status = "Waiting";
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { isReceived, notification, status },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ message: "✅ Order status updated", order });
  } catch (err) {
    res.status(500).json({ message: "Error updating received status", error: err.message });
  }
});

// 📥 User fetches their own orders
router.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const orders = await Order.find({ email }).sort({ createdAt: -1 });  // Fetch orders of a specific user
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user orders", error: err.message });
  }
});

// 🗑️ Delete order (Admin)
router.delete("/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "🗑️ Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting order", error: err.message });
  }
});

module.exports = router;
