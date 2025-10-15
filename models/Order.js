const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: String,
  price: Number,
  quantity: Number,
  feedback: String,
  rating: Number,
});

const OrderSchema = new mongoose.Schema(
  {
    username: String,
    email: String,
    items: [ItemSchema],
    totalAmount: Number,
    orderId: String,
    token: String,
    userStatus: String,
    adminStatus: String,
    notification: String,

    // ✅ Order-level feedback fields
    rating: { type: Number },
    feedback: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
