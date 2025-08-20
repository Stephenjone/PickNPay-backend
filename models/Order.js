const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  email: { type: String, required: true },
  items: [
    {
      name: String,
      quantity: Number,
    }
  ],
  totalAmount: { type: Number, required: true },
  orderId: { type: String, required: true }, 
  orderStatus: { type: String, default: 'Pending' }, // ✅ matches backend route
  token: { type: Number, default: null }, // ✅ will store the 3-digit code
  received: { type: String, default: 'No' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
