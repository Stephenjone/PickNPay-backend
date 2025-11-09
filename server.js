// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const admin = require("firebase-admin");
const fs = require("fs");

/* =========================================================
   🚀 Initialize Express + HTTP Server
========================================================= */
const app = express();
const server = http.createServer(app);

/* =========================================================
   🔥 Initialize Firebase Admin using Env Variables or Local JSON
========================================================= */
if (!admin.apps.length) {
  try {
    // Prefer env vars, fallback to local key file
    let serviceAccount;
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g, "\n"),
      };
    } else if (fs.existsSync(path.join(__dirname, "firebaseServiceAccountKey.json"))) {
      serviceAccount = require(path.join(__dirname, "firebaseServiceAccountKey.json"));
      console.warn("⚠️ Using local firebaseServiceAccountKey.json instead of env vars");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase Admin init failed:", err.message);
  }
}

/* =========================================================
   🔔 Helper function to send FCM Notifications
========================================================= */
async function sendPushNotification(expoPushToken, title, body) {
  try {
    if (!expoPushToken) {
      console.warn("⚠️ No Expo Push Token provided — skipping notification.");
      return;
    }

    const message = {
      to: expoPushToken,
      sound: 'default',
      title: title,
      body: body,
      data: { someData: 'goes here' },
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log(`✅ Push notification sent:`, result);
  } catch (error) {
    console.error("❌ Error sending push notification:", error.message);
  }
}


/* =========================================================
   ⚡ Socket.io Setup
========================================================= */
const io = socketIo(server, {
  transports: ["websocket", "polling"],
  cors: {
    origin: [
      "http://localhost:3000",
      "https://picknpay-frontend.onrender.com", // your deployed frontend
      "https://fcm.googleapis.com",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});


/* =========================================================
   🌍 Express Middleware
========================================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "https://picknpay-frontend.onrender.com",
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

// Attach io instance to every request
app.use((req, res, next) => {
  req.io = io;
  next();
});

/* =========================================================
   📦 Routes
========================================================= */
/* =========================================================
   📦 Routes
========================================================= */
const authRoutes = require("./routes/auth");
const itemsRoutes = require("./routes/items");
const cartRoutes = require("./routes/cart");
const uploadRoutes = require("./routes/upload");
const ordersRoutes = require("./routes/orders");
const notifyUserRoute = require("./routes/notifyUser");
const rejectRoute = require("./routes/reject");

// Register routes
app.use("/api/auth", authRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/notify-user", notifyUserRoute);
app.use("/api/reject", rejectRoute);

console.log("✅ Routes registered:", {
  auth: "/api/auth",
  items: "/api/items",
  cart: "/api/cart",
  upload: "/api/upload",
  orders: "/api/orders",
  notify: "/api/notify-user",
  reject: "/api/reject"
});

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
  console.log(`⚡ Socket connected: ${socket.id}`);

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
    console.log(`🔌 Disconnected: ${socket.id}`);
  });
});

/* =========================================================
   🌐 Production Static Files
========================================================= */
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "client", "build");
  app.use(express.static(clientBuildPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

/* =========================================================
   🧱 Error Handling
========================================================= */
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.message);
  if (err.message.startsWith("❌ CORS policy")) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

/* =========================================================
   🧩 Connect MongoDB + Start Server
========================================================= */

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
  const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

/* =========================================================
   🔁 Export Firebase Admin + Helper
========================================================= */
module.exports = { admin, sendPushNotification };
