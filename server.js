// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const admin = require("firebase-admin");

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
  admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
  console.log("✅ Firebase Admin initialized from environment variables");
}

const io = socketIo(server, {
  transports: ["websocket", "polling"],
  cors: {
    origin: [process.env.FRONTEND_URL, process.env.CLIENT_URL],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});


app.get("/", (req, res) => {
  res.status(200).send("✅ PickNPay API is running successfully...");
});



const authRoutes = require("./routes/auth");
const itemsRoutes = require("./routes/items");
const cartRoutes = require("./routes/cart");
const uploadRoutes = require("./routes/upload");
const ordersRoutes = require("./routes/orders");



app.use((req, res, next) => {
  req.io = io;
  next();
});

const allowedOrigins = [process.env.FRONTEND_URL, process.env.CLIENT_URL];

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

// JSON + URL parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.use("/api/auth", authRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", ordersRoutes);



app.get("/", (req, res) => {
  res.status(200).send("✅ PickNPay API is running successfully...");
});


io.on("connection", (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  // Join user room
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


if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "client", "build");
  app.use(express.static(clientBuildPath));

  // Catch-all route for SPA
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}


app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.message);
  if (err.message.startsWith("❌ CORS policy")) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal Server Error" });
});


mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });


module.exports = admin;
