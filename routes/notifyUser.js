// routes/notifyUser.js
const express = require("express");
const router = express.Router();
const { sendPushNotification } = require("../server");
const User = require("../models/User"); // Make sure you have an FCM token field in User model

// POST /api/notify-user
router.post("/", async (req, res) => {
  try {
    const { email, title, body } = req.body;

    if (!email || !title || !body) {
      return res.status(400).json({ error: "Missing email, title, or body" });
    }

    // ✅ Fetch user’s FCM token
    const user = await User.findOne({ email });
    if (!user || !user.fcmToken) {
      console.warn(`⚠️ No FCM token found for ${email}`);
      return res.status(404).json({ error: "User FCM token not found" });
    }

    // ✅ Send push notification
    await sendPushNotification(user.fcmToken, title, body);

    res.status(200).json({ success: true, message: "Notification sent!" });
  } catch (err) {
    console.error("❌ Error in /api/notify-user:", err.message);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

module.exports = router;
