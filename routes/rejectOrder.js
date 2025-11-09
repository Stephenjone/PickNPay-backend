const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { admin } = require("../server");

router.post("/reject-order/:orderId", async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update order status instead of deleting
    order.adminStatus = "Rejected";
    order.userStatus = "Order Rejected";
    order.notification = "Your order cannot be accepted at the moment. Please try again later!";
    await order.save();

    // Send push notification
    if (order.email) {
      try {
        const user = await User.findOne({ email: order.email }).select("fcmToken");
        if (user?.fcmToken) {
          const message = {
            token: user.fcmToken,
            notification: {
              title: "Order Update",
              body: "Oops! Your order cannot be accepted at the moment. Please try again later!"
            }
          };
          await admin.messaging().send(message);
        }
      } catch (err) {
        console.error("Push notification error:", err);
      }
    }

    res.json({ message: "Order rejected", order });
  } catch (error) {
    console.error("Error rejecting order:", error);
    res.status(500).json({ message: "Error rejecting order", error: error.message });
  }
});

module.exports = router;