const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const WebSocket = require('ws'); // WebSocket

dotenv.config();

const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');
const cartRoutes = require('./routes/cart');
const uploadRoutes = require('./routes/upload');
const ordersRoutes = require('./routes/orders');

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000', // Frontend URL (React)
  process.env.CLIENT_URL,  // If you have a production frontend URL
];

// CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`❌ CORS not allowed from ${origin}`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ----------- SSE Setup (for Admin to receive new orders) -----------
let sseClients = [];

app.get('/api/orders/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': allowedOrigins.join(','),
  });

  res.write(':ok\n\n');

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);
  console.log(`🔔 SSE client connected: ${clientId}`);

  req.on('close', () => {
    console.log(`❌ SSE client disconnected: ${clientId}`);
    sseClients = sseClients.filter(client => client.id !== clientId);
  });
});

// Helper to send data to all SSE clients
function sendSseEvent(data) {
  sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// ----------- WebSocket Setup -----------

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('A new WebSocket client connected.');

  // Send a welcome message when a new client connects
  ws.send(JSON.stringify({ message: 'Welcome to the Admin Orders WebSocket!' }));

  // Handle incoming messages (if needed in the future)
  ws.on('message', (message) => {
    console.log('Received:', message);
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log('A WebSocket client disconnected.');
  });
});

// Helper to send data to all WebSocket clients
function sendWsEvent(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Pass sendSseEvent and sendWsEvent to orders routes so they can notify clients on new orders
app.locals.sendSseEvent = sendSseEvent;
app.locals.sendWsEvent = sendWsEvent;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', ordersRoutes);

app.get('/', (req, res) => {
  res.send('✅ API is running...');
});

app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.message.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

// DB + Start server
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected');
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});
