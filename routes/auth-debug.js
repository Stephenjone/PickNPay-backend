const express = require("express");
const router = express.Router();
const User = require("../models/User");

// ✅ Debug endpoint to check FCM token
router.get("/fcm-debug/:email", async (req, res) => {
  try {
    const { email } = req.params;
    console.log("🔍 Checking FCM token for:", email);
    
    const user = await User.findOne({ email }).select("email fcmToken");
    if (!user) {
      console.warn("❌ User not found:", email);
      return res.status(404).json({ error: "User not found", email });
    }

    const hasFcmToken = !!user.fcmToken;
    console.log(`${hasFcmToken ? "✅" : "❌"} FCM token status for ${email}:`, {
      exists: hasFcmToken,
      preview: hasFcmToken ? `${user.fcmToken.substring(0, 20)}...` : null
    });

    return res.json({
      email: user.email,
      hasFcmToken,
      fcmTokenPreview: hasFcmToken ? `${user.fcmToken.substring(0, 20)}...` : null
    });
  } catch (err) {
    console.error("❌ FCM debug error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Validate FCM token format
router.post("/validate-fcm", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "No token provided" });
    }

    // Basic format validation (FCM tokens are ~150-160 chars)
    const isValidFormat = token.length > 100 && token.length < 200;
    
    // Try test message if format looks good
    let canSend = false;
    if (isValidFormat) {
      try {
        const { admin } = require("../server");
        await admin.messaging().send({
          token,
          notification: { title: "Test" }
        });
        canSend = true;
      } catch (err) {
        console.warn("Token validation failed:", err.message);
      }
    }

    res.json({
      isValidFormat,
      canSend,
      tokenPreview: `${token.substring(0, 20)}...`
    });
  } catch (err) {
    console.error("❌ Token validation error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;