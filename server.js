// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

dotenv.config();

const authRoutes = require("./routes/auth");
const itemsRoutes = require("./routes/items");
const cartRoutes = require("./routes/cart");
const ordersRoutes = require("./routes/orders");
const uploadRoutes = require("./routes/upload");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  transports: ["websocket", "polling"],
  cors: {
    origin: ["http://localhost:3000", process.env.CLIENT_URL],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Make io accessible via req.app and req.io
app.set("io", io);
app.use((req, res, next) => {
  req.io = io;
  next();
});

// CORS
const allowedOrigins = ["http://localhost:3000", process.env.CLIENT_URL];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/upload", uploadRoutes);

// Root healthcheck
app.get("/", (req, res) => {
  res.send("✅ API is running successfully...");
});

// Socket connections
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);

  socket.on("joinRoom", (email) => {
    if (email) {
      socket.join(email);
      console.log(`🟢 Socket ${socket.id} joined room: ${email}`);
    }
  });

  socket.on("leaveRoom", (email) => {
    if (email) {
      socket.leave(email);
      console.log(`🔴 Socket ${socket.id} left room: ${email}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

// Serve React client in production
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "client", "build");
  app.use(express.static(clientBuildPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.message);
  if (err.message.startsWith("❌ CORS policy")) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
