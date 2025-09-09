const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true },
  items: [{
    name:     String,
    quantity: Number,
    price:    Number,
  }],
  totalAmount: { type: Number, required: true },
  orderId:     { type: String, required: true },
  token:       { type: String, required: true },
  status:      { type: String, default: "Pending" },
  isReceived:  { type: Boolean, default: null },
  notification:{ type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
