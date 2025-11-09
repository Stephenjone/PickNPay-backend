const express = require("express");
const router = express.Router();
const User = require("../models/User");
const admin = require("firebase-admin");  // Import Firebase Admin directly

router.post("/", async (req, res) => {
  try {
    const { email, title, body } = req.body;

    if (!email || !title || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("🔍 Looking up user for notification:", email);
    const user = await User.findOne({ email });
    if (!user) {
      console.warn("❌ User not found:", email);
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.fcmToken) {
      console.warn("❌ No FCM token for user:", email);
      return res.status(404).json({ error: "User FCM token not found" });
    }

    const message = {
      token: user.fcmToken,
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: "/logo192.png",
          badge: "/logo192.png",
          requireInteraction: true,
          actions: [{ action: 'open', title: 'View Order' }]
        },
        fcm_options: {
          link: '/myorders'
        }
      }
    };
    if (!admin.apps.length) {
      throw new Error("Firebase Admin not initialized");
    }
    const response = await admin.messaging().send(message);
    console.log("✅ FCM push notification sent to:", email, "Response:", response);
    res.json({ success: true, message: "Notification sent successfully" });
  } catch (error) {
    console.error("❌ Push notification error:", error);
    res.status(500).json({ error: error.message || "Failed to send notification" });
  }
});

module.exports = router;