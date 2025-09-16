const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// Util: Generate unique order ID
function generateOrderId() {
  return "ORD-" + Math.floor(100000 + Math.random() * 900000);
}

// Util: Generate 3-digit token
function generateToken() {
  return String(Math.floor(1 + Math.random() * 999)).padStart(3, "0");
}

// ✅ SSE Client Registry
let clients = [];

// SSE route for Admin (subscribe to new orders)
router.get("/stream", (req, res) => {
  // Set headers for SSE
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  console.log(`📡 SSE client connected: ${clientId}`);

  // Heartbeat to keep the connection alive
  const keepAlive = setInterval(() => {
    res.write(":\n\n"); // SSE comment to keep connection alive
  }, 25000);

  req.on("close", () => {
    console.log(`❌ SSE client disconnected: ${clientId}`);
    clients = clients.filter((c) => c.id !== clientId);
    clearInterval(keepAlive);
  });
});

// 🔔 Broadcast to all SSE clients
function broadcastNewOrder(order) {
  clients.forEach((client) => {
    client.res.write(`data: ${JSON.stringify(order)}\n\n`);
  });
}

// 📌 Create new order (User places order)
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

    // Emit SSE event to all clients
    broadcastNewOrder(newOrder.toObject());

    console.log("🚀 Emitting newOrder via SSE:", newOrder._id);

    res.status(201).json({ message: "✅ Order placed successfully", order: newOrder });
  } catch (err) {
    console.error("❌ Error creating order:", err);
    res.status(500).json({ message: "Error creating order", error: err.message });
  }
});

// ✅ Accept order (Admin)
router.put("/:id/accept", async (req, res) => {
  try {
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) return res.status(404).json({ message: "Order not found" });

    let updatedFields = {
      status: "Accepted",
      notification: "✅ Order accepted! Please collect your food in 10 min.",
    };
    if (!existingOrder.token) updatedFields.token = generateToken();

    const order = await Order.findByIdAndUpdate(req.params.id, updatedFields, { new: true });
    res.json({ message: "✅ Order accepted", order });
  } catch (err) {
    res.status(500).json({ message: "Error accepting order" });
  }
});

// ❌ Reject order (Admin)
router.put("/:id/reject", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        status: "Rejected",
        notification: "❌ Oops! Restaurant cannot accept your order now.",
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "✅ Order rejected", order });
  } catch (err) {
    res.status(500).json({ message: "Error rejecting order" });
  }
});

// 📦 Mark order received / not received (Admin)
router.put("/:id/received", async (req, res) => {
  try {
    const { isReceived } = req.body;
    let notification = "";
    let status = "";

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
    res.status(500).json({ message: "Error updating received status" });
  }
});

// 🗑️ Delete order (Admin)
router.delete("/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "🗑️ Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting order" });
  }
});

module.exports = router;
