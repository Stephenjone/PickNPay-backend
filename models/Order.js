const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  quantity: { type: Number, required: true },
  price:    { type: Number, required: true },
});

const orderSchema = new mongoose.Schema({
  username:    { type: String, required: true },
  email:       { type: String, required: true },
  items:       { type: [itemSchema], required: true },
  totalAmount: { type: Number, required: true },
  orderId:     { type: String, required: true },
  token:       { type: String, required: true },
  status:      { type: String, default: "Pending" },
  isReceived:  { type: Boolean, default: null },
  notification:{ type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
