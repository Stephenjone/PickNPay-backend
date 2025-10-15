const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();

// Import route handlers
const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');
const cartRoutes = require('./routes/cart');
const uploadRoutes = require('./routes/upload');
const ordersRoutes = require('./routes/orders');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  transports: ['websocket'],
  cors: {
    origin: ['http://localhost:3000', process.env.CLIENT_URL],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  }
});

// Middleware to attach io to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// CORS configuration
const allowedOrigins = ['http://localhost:3000', process.env.CLIENT_URL];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`❌ The CORS policy does not allow access from origin: ${origin}`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Middleware for parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', ordersRoutes);

// Health check route
app.get('/', (req, res) => {
  res.send('✅ API is running...');
});

// Socket.IO setup
io.on('connection', (socket) => {
  console.log('⚡ A client connected');

  socket.on('joinRoom', (email) => {
    if (email) {
      socket.join(email);
      console.log(`🟢 Socket joined room: ${email}`);
    }
  });

  socket.on('leaveRoom', (email) => {
    if (email) {
      socket.leave(email);
      console.log(`🔴 Socket left room: ${email}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 A client disconnected');
  });
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'build')));

  // ✅ FIXED: Use named wildcard for path-to-regexp compatibility
  app.get('/:path(*)', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.message);
  if (err.message.startsWith('❌ The CORS policy')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected');
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
