const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const router = express.Router();

/* =========================================================
   ✅ REGISTER
========================================================= */
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: "Please fill all fields." });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Email already registered." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    console.log(`✅ Registered new user: ${email}`);
    return res.status(201).json({ message: "Registration successful!" });
  } catch (err) {
    console.error("❌ Register error:", err.message);
    return res.status(500).json({ error: "Server error. Please try again later." });
  }
});

/* =========================================================
   ✅ LOGIN
========================================================= */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Please fill all fields." });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ error: "Invalid credentials." });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "Login successful!",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

/* =========================================================
   🔐 Reset Password Flow
========================================================= */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found." });

    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hr
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Password Reset",
      html: `
        <p>You requested a password reset.</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link is valid for 1 hour.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Password reset link sent!" });
  } catch (err) {
    console.error("❌ Forgot password error:", err.message);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and new password required." });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found." });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.status(200).json({ message: "Password reset successful." });
  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});

// Add this new route to auth.js
router.get("/fcm-token/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email }).select("email fcmToken");
    
    if (!user) {
      return res.status(404).json({ 
        error: "User not found",
        email 
      });
    }

    return res.json({
      email: user.email,
      hasFcmToken: !!user.fcmToken,
      fcmTokenPreview: user.fcmToken ? `${user.fcmToken.substring(0, 20)}...` : null
    });
  } catch (err) {
    console.error("FCM token debug error:", err);
    res.status(500).json({ error: err.message });
  }
});
/* =========================================================
   🔔 Save / Update FCM Token
========================================================= */

// ✅ Save FCM token (called from frontend/firebase.js)
router.post("/save-fcm-token", async (req, res) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ error: "Email and token are required" });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { fcmToken: token },
      { new: true, upsert: false }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`✅ FCM token saved for ${email}: ${token.substring(0, 20)}...`);
    res.json({ success: true, message: "FCM token saved successfully" });
  } catch (err) {
    console.error("❌ Error saving FCM token:", err);
    res.status(500).json({ error: "Failed to save FCM token" });
  }
});


/* =========================================================
   🔔 Save / Update Expo Token (for mobile push)
========================================================= */

module.exports = router;
