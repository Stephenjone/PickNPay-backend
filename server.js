// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const admin = require("firebase-admin");

// Initialize Express + HTTP server
const app = express();
const server = http.createServer(app);

/* =========================================================
   🔥 Initialize Firebase Admin using Environment Variables
========================================================= */
if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  console.warn(
    "⚠️ Missing Firebase environment variables. Push notifications may not work."
  );
} else {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process
          .env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    console.log("✅ Firebase Admin initialized from environment variables");
  } catch (err) {
    console.error("❌ Firebase Admin init failed:", err.message);
  }
}

/* =========================================================
   🔔 Helper function to send FCM notifications
========================================================= */
async function sendPushNotification(token, title, body) {
  try {
    if (!token) {
      console.warn("⚠️ No FCM token provided, skipping push notification.");
      return;
    }

    const message = {
      notification: { title, body },
      token,
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Push notification sent successfully: ${response}`);
  } catch (error) {
    console.error("❌ Error sending push notification:", error.message);
  }
}

/* =========================================================
   ⚡ Socket.io Configuration
========================================================= */
const io = socketIo(server, {
  transports: ["websocket", "polling"],
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      process.env.CLIENT_URL,
      "https://fcm.googleapis.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

/* =========================================================
   🌍 Express Middlewares
========================================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  "https://fcm.googleapis.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`⚠️ Blocked by CORS: ${origin}`);
      return callback(
        new Error(`❌ CORS policy does not allow access from origin: ${origin}`),
        false
      );
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Make io available in requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

/* =========================================================
   📦 Routes
========================================================= */
const authRoutes = require("./routes/auth");
const itemsRoutes = require("./routes/items");
const cartRoutes = require("./routes/cart");
const uploadRoutes = require("./routes/upload");
const ordersRoutes = require("./routes/orders");

app.use("/api/auth", authRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", ordersRoutes);

// File uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).send("✅ PickNPay API is running successfully...");
});

/* =========================================================
   ⚙️ Socket.io Events
========================================================= */
io.on("connection", (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  socket.on("joinRoom", (email) => {
    if (email) {
      socket.join(email);
      console.log(`🟢 Joined room: ${email}`);
    }
  });

  socket.on("leaveRoom", (email) => {
    if (email) {
      socket.leave(email);
      console.log(`🔴 Left room: ${email}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

/* =========================================================
   🌐 Production Static File Handling
========================================================= */
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "client", "build");
  app.use(express.static(clientBuildPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

/* =========================================================
   🧱 Global Error Handler
========================================================= */
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.message);
  if (err.message.startsWith("❌ CORS policy")) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

/* =========================================================
   🧩 Database + Server Start
========================================================= */
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

/* =========================================================
   🔁 Export Firebase Admin + Helper
========================================================= */
module.exports = { admin, sendPushNotification };
