const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');
const cartRoutes = require('./routes/cart');
const uploadRoutes = require('./routes/upload');
const ordersRoutes = require('./routes/orders');

const app = express();

// Allowed origins for CORS (frontend URLs)
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL, // e.g. 'https://picknpay-frontend-application.onrender.com'
];

// Setup CORS middleware
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser tools like Postman
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      const msg = `❌ The CORS policy does not allow access from origin: ${origin}`;
      return callback(new Error(msg), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Parse incoming JSON and urlencoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes registration
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', ordersRoutes);

// Root endpoint for quick health check
app.get('/', (req, res) => {
  res.send('✅ API is running...');
});

// Global error handler (especially for CORS errors)
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
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
