const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User");
const mongoose = require("mongoose");

/* =========================================================
   🔧 Helper Functions
========================================================= */
function generateOrderId() {
  return "ORD-" + Math.floor(100000 + Math.random() * 900000);
}
function generateToken() {
  return String(Math.floor(1 + Math.random() * 999)).padStart(3, "0");
}

/* =========================================================
   ✅ Admin: Get All Orders
========================================================= */
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find({ adminDeleted: false }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching all orders:", err);
    res.status(500).json({ message: "Error fetching all orders", error: err.message });
  }
});

/* =========================================================
   ✅ Create a New Order
========================================================= */
router.post("/", async (req, res) => {
  console.log("🟢 POST /orders received:", JSON.stringify(req.body, null, 2));

  try {
    const { username, email, items } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "Items array must be non-empty" });

    let uname = username?.trim();
    if (!uname) {
      const user = await User.findOne({ email }).select("name").lean();
      uname = (user && user.name) || "Guest";
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0
    );

    const newOrder = new Order({
      username: uname,
      email,
      items: items.map((i) => ({
        ...i,
        rating: null,
        feedback: null,
      })),
      totalAmount,
      orderId: generateOrderId(),
      token: generateToken(),
      userStatus: "Food is getting prepared",
      adminStatus: "Pending",
      notification: "Your order is being processed",
      adminDeleted: false,
    });

    const savedOrder = await newOrder.save();
    console.log(`✅ Order saved successfully: ${savedOrder.orderId}`);

    // 🔔 Emit via Socket.io
    if (req.io) {
      req.io.emit("newOrder", savedOrder); // Notify Admin
      req.io.to(email).emit("orderUpdated", savedOrder); // Notify User
    }

    res.status(201).json({
      message: "Order placed successfully",
      order: savedOrder,
      token: savedOrder.token,
    });
  } catch (err) {
    console.error("❌ Full error placing order:", err);
    res.status(500).json({
      message: "Error placing order",
      error: err.message,
    });
  }
});

/* =========================================================
   ✅ Get Orders by User
========================================================= */
router.get("/user/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    if (!email) return res.status(400).json({ message: "Email is required" });

    const orders = await Order.find({ email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching user orders:", err);
    res.status(500).json({ message: "Error fetching user orders", error: err.message });
  }
});

/* =========================================================
   ✅ Admin: Accept Order
========================================================= */
router.put("/:id/accept", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.adminStatus = "Accepted";
    order.userStatus = "Your order is accepted and is being prepared";
    order.notification = "Food is being prepared";
    order.token = generateToken();

    await order.save();

    if (req.io) {
      req.io.to(order.email).emit("orderUpdated", order);
      req.io.emit("orderUpdatedAdmin", order);
    }

    res.json({ message: "Order accepted", order });
  } catch (err) {
    console.error("❌ Error accepting order:", err);
    res.status(500).json({ message: "Error accepting order", error: err.message });
  }
});

/* =========================================================
   ✅ Admin: Mark Order Ready
========================================================= */
router.put("/:id/ready", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        adminStatus: "Ready to Serve",
        userStatus: "Your order is ready! Please collect it.",
        notification: "Your order is ready for pickup",
      },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (req.io) {
      req.io.to(order.email).emit("orderUpdated", order);
      req.io.emit("orderUpdatedAdmin", order);
    }

    res.json({ message: "Order marked as ready", order });
  } catch (err) {
    console.error("❌ Error marking ready:", err);
    res.status(500).json({ message: "Error marking ready", error: err.message });
  }
});

/* =========================================================
   ✅ Admin: Update Collection Status
========================================================= */
router.put("/:id/collected", async (req, res) => {
  try {
    const { collected } = req.body;

    const update = collected
      ? {
          adminStatus: "Collected",
          userStatus: "Thank you for your order!",
          notification: "Your order has been collected. Thank you!",
        }
      : {
          adminStatus: "Waiting for pickup",
          userStatus: "Order is waiting, please collect from the counter",
          notification: "Order is waiting for collection",
        };

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (req.io) {
      req.io.to(order.email).emit("orderUpdated", order);
      req.io.emit("orderUpdatedAdmin", order);
    }

    res.json({ message: "Order collection status updated", order });
  } catch (err) {
    console.error("❌ Error updating collected:", err);
    res.status(500).json({ message: "Error updating collected", error: err.message });
  }
});

/* =========================================================
   ✅ User: Add Feedback for an Item
========================================================= */

/* =========================================================
   ✅ User: Add Feedback (Fixed & Verified)
========================================================= */
router.put("/:id/item/feedback", async (req, res) => {
  try {
    const { itemId, rating, feedback } = req.body;
    console.log("📩 Received feedback update:", { orderId: req.params.id, itemId, rating, feedback });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // ✅ Match the item safely by converting ObjectIds to strings
    const item = order.items.find(i => i._id.toString() === itemId.toString());
    if (!item) return res.status(404).json({ message: "Item not found in order" });

    // ✅ Update the feedback values
    item.rating = Number(rating);
    item.feedback = feedback?.trim() || "";

    // ✅ Mark modified and save
    order.markModified("items");
    const updatedOrder = await order.save();

    console.log("✅ Feedback saved successfully:", {
      itemName: item.name,
      rating: item.rating,
      feedback: item.feedback,
    });

    // ✅ Emit live update
    if (req.io) {
      req.io.to(order.email).emit("orderUpdated", updatedOrder);
      req.io.emit("orderUpdatedAdmin", updatedOrder);
    }

    res.json({
      message: "Item feedback saved successfully",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("❌ Error saving feedback:", err);
    res.status(500).json({
      message: "Error saving feedback",
      error: err.message,
    });
  }
});




/* =========================================================
   ✅ Admin: Delete (Reject) Order
========================================================= */
router.delete("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    await order.deleteOne();

    if (req.io) {
      req.io.to(order.email).emit("orderRejected", {
        message: "Oops! Your order cannot be accepted right now. Please try again later.",
        orderId: order.orderId,
      });
      req.io.emit("orderUpdatedAdmin", { deletedOrderId: order._id });
    }

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    res.status(500).json({ message: "Error deleting order", error: err.message });
  }
});

module.exports = router;
