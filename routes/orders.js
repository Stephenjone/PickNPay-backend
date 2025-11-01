const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User");
const mongoose = require("mongoose");

// ✅ Use the initialized Firebase Admin from server.js
const admin = require("../server"); // 🔑 ensures we use the env-configured Firebase Admin

/* =========================================================
   🔧 Helper Functions
========================================================= */
function generateOrderId() {
  return "ORD-" + Math.floor(100000 + Math.random() * 900000);
}

function generateToken() {
  return String(Math.floor(1 + Math.random() * 999)).padStart(3, "0");
}

// ✅ Helper: Send Push Notification
async function sendPushNotification(email, title, body) {
  try {
    const user = await User.findOne({ email }).select("fcmToken");
    if (!user || !user.fcmToken) {
      console.warn(`⚠️ No FCM token found for ${email}`);
      return;
    }

    const message = {
      notification: { title, body },
      token: user.fcmToken,
    };

    await admin.messaging().send(message);
    console.log(`✅ Push sent to ${email}: ${title}`);
  } catch (err) {
    console.error("❌ Error sending push notification:", err);
  }
}

// Save FCM token
router.post('/fcm-token', async (req, res) => {
  try {
    const { email, fcmToken } = req.body;
    if (!email || !fcmToken) {
      return res.status(400).json({ message: 'Missing email or token' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { fcmToken },
      { new: true, upsert: true }
    );

    console.log(`💾 FCM token stored for ${email}`);
    res.status(200).json({ message: 'Token saved successfully' });
  } catch (err) {
    console.error('❌ Error saving FCM token:', err);
    res.status(500).json({ message: 'Failed to save token' });
  }
});


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

    // 🔔 Push Notification
    await sendPushNotification(email, "Order Placed", "Your order is being processed.");

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
// Accept order
router.put("/:id/accept", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.adminStatus = "Accepted";
    order.userStatus = "Your order is accepted and being prepared";
    order.notification = "Food is being prepared";
    order.token = generateToken();

    await order.save();

    // Socket.io notification
    if (req.io) {
      req.io.to(order.email).emit("orderUpdated", order);
      req.io.emit("orderUpdatedAdmin", order);
    }

    // Push notification
    await sendPushNotification(order.email, "Order Accepted", order.notification);

    res.json({ message: "Order accepted", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Ready
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

    await sendPushNotification(order.email, "Order Ready", order.notification);
    res.json({ message: "Order marked ready", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Collected / Waiting
router.put("/:id/collected", async (req, res) => {
  try {
    const { collected } = req.body;
    const update = collected
      ? {
          adminStatus: "Collected",
          userStatus: "Thank you! Your order has been collected",
          notification: "Your order has been collected",
        }
      : {
          adminStatus: "Waiting for pickup",
          userStatus: "Order is waiting, please collect",
          notification: "Order is waiting for collection",
        };

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (req.io) {
      req.io.to(order.email).emit("orderUpdated", order);
      req.io.emit("orderUpdatedAdmin", order);
    }

    await sendPushNotification(order.email, "Order Update", order.notification);
    res.json({ message: "Order collection status updated", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* =========================================================
   ✅ User: Add Feedback
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

    const item = order.items.find(i => i._id.toString() === itemId.toString());
    if (!item) return res.status(404).json({ message: "Item not found in order" });

    item.rating = Number(rating);
    item.feedback = feedback?.trim() || "";

    order.markModified("items");
    const updatedOrder = await order.save();

    console.log("✅ Feedback saved successfully:", {
      itemName: item.name,
      rating: item.rating,
      feedback: item.feedback,
    });

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

    await sendPushNotification(
      order.email,
      "Order Rejected",
      "Sorry! Your order could not be accepted at the moment."
    );

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    res.status(500).json({ message: "Error deleting order", error: err.message });
  }
});

module.exports = router;
